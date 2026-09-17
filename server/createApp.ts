import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { store } from './store.js';
import { parseCJI3Excel } from './parser.js';
import { calculateWBSMonthlySummary, getTransactionMonth } from './deltaEngine.js';
import {
  generatePlaniswareExportExcel,
  generateReconciliationExportExcel,
} from './excelExport.js';
import { runAllTests } from './tests/suite.js';
import { MonthlySnapshot, MonthCloseConfirmation } from '../src/types.js';

const upload = multer({ storage: multer.memoryStorage() });

export function createExpressApp() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  // Auth
  app.get('/api/auth/me', (req, res) => {
    const userId = (req.headers['x-user-id'] as string) || 'usr-admin';
    const db = store.getDB();
    const user = db.users.find((u) => u.id === userId) || db.users[0];
    res.json(user);
  });

  app.get('/api/auth/users', (req, res) => {
    res.json(store.getDB().users);
  });

  // Snapshots
  app.get('/api/snapshots', (req, res) => {
    res.json(store.getDB().snapshots);
  });

  // Upload Preview (does not commit)
  app.post('/api/snapshots/upload-preview', upload.single('file'), (req, res) => {
    try {
      let fileBuffer: Buffer;
      let filename = 'CJI3_Upload.xlsx';
      const targetSheetName = req.body.sheetName || req.query.sheetName;

      if (req.file) {
        fileBuffer = req.file.buffer;
        filename = req.file.originalname;
      } else if (req.body.base64) {
        fileBuffer = Buffer.from(req.body.base64, 'base64');
        filename = req.body.filename || filename;
      } else {
        return res.status(400).json({ error: 'No file uploaded or provided.' });
      }

      const tempId = `preview-${Date.now()}`;
      const parseResult = parseCJI3Excel(fileBuffer, tempId, filename, store.getDB().vendorAliases, targetSheetName);
      res.json(parseResult);
    } catch (e: any) {
      res.status(400).json({ error: e.message || 'Failed to parse Excel file.' });
    }
  });

  // Commit Snapshot
  app.post('/api/snapshots/commit', upload.single('file'), (req, res) => {
    try {
      const reportingMonth = req.body.reportingMonth;
      const uploadedBy = req.body.uploadedBy || 'usr-admin';
      const targetSheetName = req.body.sheetName;

      if (!reportingMonth) {
        return res.status(400).json({ error: 'Reporting month is required.' });
      }

      let fileBuffer: Buffer;
      let filename = 'SAP_CJI3_Extract.xlsx';

      if (req.file) {
        fileBuffer = req.file.buffer;
        filename = req.file.originalname;
      } else if (req.body.base64) {
        fileBuffer = Buffer.from(req.body.base64, 'base64');
        filename = req.body.filename || filename;
      } else {
        return res.status(400).json({ error: 'No file uploaded.' });
      }

      const db = store.getDB();
      const existingSnaps = db.snapshots.filter((s) => s.reportingMonth === reportingMonth);
      const nextVersion = existingSnaps.length + 1;
      const snapshotId = `snap-${reportingMonth}-v${nextVersion}`;

      const parsed = parseCJI3Excel(fileBuffer, snapshotId, filename, db.vendorAliases, targetSheetName);

      const existingWbs = new Set(db.projects.map((p) => p.wbs));
      parsed.detailRows.forEach((tx) => {
        if (!existingWbs.has(tx.normalizedWbs)) {
          existingWbs.add(tx.normalizedWbs);
          db.projects.push({
            wbs: tx.normalizedWbs,
            name: `Project ${tx.normalizedWbs}`,
            assignedPmId: 'usr-pm-sarah',
            assignedPmName: 'Sarah Jenkins (PM)',
            budgetEUR: 200000,
          });
        }
      });

      const snapshot: MonthlySnapshot = {
        id: snapshotId,
        reportingMonth,
        version: nextVersion,
        status: 'COMMITTED',
        filename,
        uploadedBy,
        uploadedAt: new Date().toISOString(),
        totalRows: parsed.summary.totalRows,
        detailRowsCount: parsed.summary.detailCount,
        subtotalRowsCount: parsed.summary.subtotalCount,
        wbsCount: parsed.summary.wbsCount,
        vendorCount: parsed.summary.vendorCount,
        totalExternalSpend: parsed.summary.totalExternalSpend,
        totalInternalReclass: parsed.summary.totalInternalReclass,
        totalCorrectionTransfer: parsed.summary.totalCorrectionTransfer,
        totalOtherNonPo: parsed.summary.totalOtherNonPo,
      };

      db.snapshots.push(snapshot);
      db.transactions.push(...parsed.detailRows);

      db.auditLogs.unshift({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: uploadedBy,
        userName: 'Administrator',
        action: 'COMMIT_SNAPSHOT',
        target: reportingMonth,
        details: `Uploaded and committed snapshot v${nextVersion} (${filename} - Sheet ${parsed.sheetName}). Imported ${parsed.summary.detailCount} detail rows across ${parsed.summary.wbsCount} WBS elements.`,
      });

      store.save();
      res.json({ snapshot, parseResult: parsed });
    } catch (e: any) {
      res.status(400).json({ error: e.message || 'Failed to commit snapshot.' });
    }
  });

  // Load Local capex-export-CJI3.xlsx File
  app.post('/api/snapshots/load-local', (req, res) => {
    try {
      const reportingMonth = req.body.reportingMonth || '2026-09';
      const sheetName = req.body.sheetName || 'CAPEX CJI3';
      const localFilePath = path.join(process.cwd(), 'capex-export-CJI3.xlsx');

      if (!fs.existsSync(localFilePath)) {
        return res.status(404).json({ error: 'Local capex-export-CJI3.xlsx file not found on server.' });
      }

      const fileBuffer = fs.readFileSync(localFilePath);
      const filename = 'capex-export-CJI3.xlsx';

      const db = store.getDB();
      const existingSnaps = db.snapshots.filter((s) => s.reportingMonth === reportingMonth);
      const nextVersion = existingSnaps.length + 1;
      const snapshotId = `snap-${reportingMonth}-v${nextVersion}`;

      const parsed = parseCJI3Excel(fileBuffer, snapshotId, filename, db.vendorAliases, sheetName);

      const existingWbs = new Set(db.projects.map((p) => p.wbs));
      parsed.detailRows.forEach((tx) => {
        if (!existingWbs.has(tx.normalizedWbs)) {
          existingWbs.add(tx.normalizedWbs);
          db.projects.push({
            wbs: tx.normalizedWbs,
            name: `Project ${tx.normalizedWbs}`,
            assignedPmId: 'usr-pm-sarah',
            assignedPmName: 'Sarah Jenkins (PM)',
            budgetEUR: 250000,
          });
        }
      });

      const snapshot: MonthlySnapshot = {
        id: snapshotId,
        reportingMonth,
        version: nextVersion,
        status: 'COMMITTED',
        filename: `${filename} (${sheetName})`,
        uploadedBy: 'usr-admin',
        uploadedAt: new Date().toISOString(),
        totalRows: parsed.summary.totalRows,
        detailRowsCount: parsed.summary.detailCount,
        subtotalRowsCount: parsed.summary.subtotalCount,
        wbsCount: parsed.summary.wbsCount,
        vendorCount: parsed.summary.vendorCount,
        totalExternalSpend: parsed.summary.totalExternalSpend,
        totalInternalReclass: parsed.summary.totalInternalReclass,
        totalCorrectionTransfer: parsed.summary.totalCorrectionTransfer,
        totalOtherNonPo: parsed.summary.totalOtherNonPo,
      };

      db.snapshots.push(snapshot);
      db.transactions = db.transactions.filter((t) => t.snapshotId !== snapshotId);
      db.transactions.push(...parsed.detailRows);

      db.auditLogs.unshift({
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: 'usr-admin',
        userName: 'Administrator',
        action: 'LOAD_LOCAL_SNAPSHOT',
        target: reportingMonth,
        details: `Loaded local ${filename} (${sheetName}). Imported ${parsed.summary.detailCount} detail rows across ${parsed.summary.wbsCount} WBS elements.`,
      });

      store.save();
      res.json({ snapshot, parseResult: parsed });
    } catch (e: any) {
      res.status(400).json({ error: e.message || 'Failed to load local export file.' });
    }
  });

  // Reopen Snapshot
  app.post('/api/snapshots/reopen', (req, res) => {
    const { snapshotId, userId } = req.body;
    const db = store.getDB();
    const snap = db.snapshots.find((s) => s.id === snapshotId);
    if (!snap) return res.status(404).json({ error: 'Snapshot not found.' });

    snap.status = 'REOPENED';
    db.auditLogs.unshift({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: userId || 'usr-admin',
      userName: 'Administrator',
      action: 'REOPEN_SNAPSHOT',
      target: snap.reportingMonth,
      details: `Reopened snapshot ${snap.id} (${snap.reportingMonth} v${snap.version}).`,
    });

    store.save();
    res.json(snap);
  });

  // Sample CJI3 Download
  app.get('/api/snapshots/sample/:month', (req, res) => {
    const month = req.params.month === '2026-09' ? '2026-09' : '2026-08';
    const buffer = store.createSampleCJI3Buffer(month);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=SAP_CJI3_${month}.xlsx`);
    res.send(buffer);
  });

  // Available Months Endpoint
  app.get('/api/months', (req, res) => {
    const db = store.getDB();
    const monthsSet = new Set<string>();
    db.transactions.forEach((t) => {
      const m = getTransactionMonth(t);
      if (m) monthsSet.add(m);
    });
    monthsSet.add('2026-09');
    if (monthsSet.size === 0) {
      ['2026-09', '2026-08', '2026-07', '2026-06', '2026-05', '2026-04', '2026-03', '2026-02', '2026-01', '2025-12', '2025-11', '2025-10', '2025-09'].forEach((m) => monthsSet.add(m));
    }
    const months = Array.from(monthsSet).sort().reverse();
    res.json(months);
  });

  // PM Summaries Endpoint
  app.get('/api/pm/summary', (req, res) => {
    const month = (req.query.month as string) || '2026-09';
    const pmId = req.query.pmId as string | undefined;

    const db = store.getDB();

    const currentTx = db.transactions.filter((t) => getTransactionMonth(t) <= month);
    const prevTx = db.transactions.filter((t) => getTransactionMonth(t) < month);

    let projects = db.projects;
    if (pmId) {
      projects = projects.filter((p) => p.assignedPmId === pmId);
    }

    const summaries = projects.map((proj) => {
      const monthClose = db.monthCloseConfirmations.find(
        (mc) => mc.wbs === proj.wbs && mc.reportingMonth === month
      );
      const { summary } = calculateWBSMonthlySummary(
        proj.wbs,
        month,
        currentTx,
        prevTx,
        proj,
        monthClose
      );
      return summary;
    });

    res.json({
      reportingMonth: month,
      summaries,
    });
  });

  // PM Process / Confirm Entry
  app.post('/api/pm/process', (req, res) => {
    const { wbs, reportingMonth, planiswareRef, comment, confirmedBy, vendorAmounts } = req.body;

    if (!wbs || !reportingMonth) {
      return res.status(400).json({ error: 'WBS and reportingMonth are required.' });
    }

    const db = store.getDB();

    const currentSnap = db.snapshots
      .filter((s) => s.reportingMonth === reportingMonth && s.status === 'COMMITTED')
      .sort((a, b) => b.version - a.version)[0];

    const currentTx = currentSnap
      ? db.transactions.filter((t) => t.snapshotId === currentSnap.id && t.normalizedWbs === wbs)
      : [];

    const amountConfirmed = currentTx
      .filter((t) => t.classification === 'EXTERNAL_VENDOR' && !t.isExcluded)
      .reduce((sum, t) => sum + t.valueObjectCurr, 0);

    const existingIdx = db.monthCloseConfirmations.findIndex(
      (m) => m.wbs === wbs && m.reportingMonth === reportingMonth
    );

    const confirmation: MonthCloseConfirmation = {
      id: existingIdx >= 0 ? db.monthCloseConfirmations[existingIdx].id : `mc-${Date.now()}`,
      wbs,
      reportingMonth,
      status: 'Processed',
      amountConfirmed,
      vendorAmounts: vendorAmounts || {},
      planiswareRef: planiswareRef || '',
      comment: comment || '',
      confirmedBy: confirmedBy || 'Project Manager',
      confirmedAt: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      db.monthCloseConfirmations[existingIdx] = confirmation;
    } else {
      db.monthCloseConfirmations.push(confirmation);
    }

    db.auditLogs.unshift({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      userId: confirmedBy || 'pm',
      userName: confirmedBy || 'Project Manager',
      action: 'MARK_PROCESSED',
      target: `${wbs} (${reportingMonth})`,
      details: `Marked monthly update as processed. Planisware Ref: ${planiswareRef || 'N/A'}. Confirmed Amount: EUR ${amountConfirmed.toFixed(2)}.`,
    });

    store.save();
    res.json(confirmation);
  });

  // Projects Management
  app.get('/api/projects', (req, res) => {
    res.json(store.getDB().projects);
  });

  app.put('/api/projects/:wbs', (req, res) => {
    const wbs = req.params.wbs;
    const { assignedPmId, assignedPmName, budgetEUR, name } = req.body;
    const db = store.getDB();

    const proj = db.projects.find((p) => p.wbs === wbs);
    if (!proj) return res.status(404).json({ error: 'Project not found.' });

    if (assignedPmId !== undefined) proj.assignedPmId = assignedPmId;
    if (assignedPmName !== undefined) proj.assignedPmName = assignedPmName;
    if (budgetEUR !== undefined) proj.budgetEUR = parseFloat(budgetEUR) || 0;
    if (name !== undefined) proj.name = name;

    store.save();
    res.json(proj);
  });

  // Vendor Aliases
  app.get('/api/vendors/aliases', (req, res) => {
    res.json(store.getDB().vendorAliases);
  });

  app.post('/api/vendors/aliases', (req, res) => {
    const { rawPattern, canonicalVendor, notes, createdBy } = req.body;
    if (!rawPattern || !canonicalVendor) {
      return res.status(400).json({ error: 'rawPattern and canonicalVendor are required.' });
    }

    const db = store.getDB();
    const alias = {
      id: `alias-${Date.now()}`,
      rawPattern: rawPattern.trim(),
      canonicalVendor: canonicalVendor.trim(),
      notes: notes || '',
      createdBy: createdBy || 'usr-admin',
      createdAt: new Date().toISOString(),
    };

    db.vendorAliases.push(alias);
    store.save();
    res.json(alias);
  });

  app.delete('/api/vendors/aliases/:id', (req, res) => {
    const id = req.params.id;
    const db = store.getDB();
    db.vendorAliases = db.vendorAliases.filter((a) => a.id !== id);
    store.save();
    res.json({ success: true });
  });

  // Transactions
  app.get('/api/transactions', (req, res) => {
    const snapshotId = req.query.snapshotId as string | undefined;
    const wbs = req.query.wbs as string | undefined;

    let txs = store.getDB().transactions;
    if (snapshotId) txs = txs.filter((t) => t.snapshotId === snapshotId);
    if (wbs) txs = txs.filter((t) => t.normalizedWbs === wbs);

    res.json(txs);
  });

  app.put('/api/transactions/:id/override', (req, res) => {
    const id = req.params.id;
    const { classification, isExcluded, reason, updatedBy } = req.body;

    const db = store.getDB();
    const tx = db.transactions.find((t) => t.id === id);
    if (!tx) return res.status(404).json({ error: 'Transaction not found.' });

    if (classification) tx.classification = classification;
    if (isExcluded !== undefined) tx.isExcluded = isExcluded;

    tx.userOverride = {
      classification,
      isExcluded,
      reason,
      updatedBy: updatedBy || 'Administrator',
      updatedAt: new Date().toISOString(),
    };

    store.save();
    res.json(tx);
  });

  // Audit Logs
  app.get('/api/audit-logs', (req, res) => {
    res.json(store.getDB().auditLogs);
  });

  // Excel Exports
  app.get('/api/export/excel', (req, res) => {
    const month = (req.query.month as string) || '2026-09';
    const db = store.getDB();

    const currentSnap = db.snapshots
      .filter((s) => s.reportingMonth === month && s.status === 'COMMITTED')
      .sort((a, b) => b.version - a.version)[0];

    const prevMonth = '2026-08';
    const prevSnap = db.snapshots
      .filter((s) => s.reportingMonth === prevMonth && s.status === 'COMMITTED')
      .sort((a, b) => b.version - a.version)[0];

    const currentTx = currentSnap ? db.transactions.filter((t) => t.snapshotId === currentSnap.id) : [];
    const prevTx = prevSnap ? db.transactions.filter((t) => t.snapshotId === prevSnap.id) : [];

    const summaries = db.projects.map((proj) => {
      const monthClose = db.monthCloseConfirmations.find((mc) => mc.wbs === proj.wbs && mc.reportingMonth === month);
      const { summary } = calculateWBSMonthlySummary(proj.wbs, month, currentTx, prevTx, proj, monthClose);
      return summary;
    });

    const buffer = generatePlaniswareExportExcel(month, summaries);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Planisware_Entry_Instructions_${month}.xlsx`);
    res.send(buffer);
  });

  app.get('/api/export/reconciliation', (req, res) => {
    const month = (req.query.month as string) || '2026-09';
    const db = store.getDB();

    const snap = db.snapshots
      .filter((s) => s.reportingMonth === month && s.status === 'COMMITTED')
      .sort((a, b) => b.version - a.version)[0];

    const txs = snap ? db.transactions.filter((t) => t.snapshotId === snap.id) : [];
    const buffer = generateReconciliationExportExcel(month, txs);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=CJI3_Reconciliation_Audit_${month}.xlsx`);
    res.send(buffer);
  });

  // Automated Tests Runner
  app.get('/api/tests/run', (req, res) => {
    const results = runAllTests();
    const passed = results.filter((r) => r.passed).length;
    res.json({
      total: results.length,
      passed,
      failed: results.length - passed,
      results,
    });
  });

  return app;
}
