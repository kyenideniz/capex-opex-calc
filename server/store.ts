import fs from 'fs';
import path from 'path';
import {
  AuditLogEntry,
  ImportedTransaction,
  MonthCloseConfirmation,
  MonthlySnapshot,
  Project,
  ReviewWarning,
  User,
  VendorAlias,
} from '../src/types.js';
import { parseCJI3Excel } from './parser.js';
import * as XLSX from 'xlsx';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

export interface AppDatabase {
  users: User[];
  projects: Project[];
  vendorAliases: VendorAlias[];
  snapshots: MonthlySnapshot[];
  transactions: ImportedTransaction[];
  subtotalRows: any[];
  monthCloseConfirmations: MonthCloseConfirmation[];
  auditLogs: AuditLogEntry[];
  warnings: ReviewWarning[];
}

// Initial Users
const initialUsers: User[] = [
  { id: 'usr-admin', name: 'Alexander Wright (Admin)', email: 'admin@company.com', role: 'admin' },
  { id: 'usr-pm-sarah', name: 'Sarah Jenkins (PM)', email: 'sarah.pm@company.com', role: 'pm' },
  { id: 'usr-pm-david', name: 'David Chen (PM)', email: 'david.pm@company.com', role: 'pm' },
];

// Initial Projects
const initialProjects: Project[] = [
  { wbs: 'P-1001-CAPEX', name: 'Cloud Infrastructure Modernization', assignedPmId: 'usr-pm-sarah', assignedPmName: 'Sarah Jenkins (PM)', budgetEUR: 250000 },
  { wbs: 'P-1002-CAPEX', name: 'Data Center Core Network Refresh', assignedPmId: 'usr-pm-sarah', assignedPmName: 'Sarah Jenkins (PM)', budgetEUR: 180000 },
  { wbs: 'P-1003-CAPEX', name: 'SAP S/4HANA Enterprise Migration', assignedPmId: 'usr-pm-david', assignedPmName: 'David Chen (PM)', budgetEUR: 350000 },
  { wbs: 'P-1004-CAPEX', name: 'Planisware Integration & Analytics', assignedPmId: 'usr-pm-david', assignedPmName: 'David Chen (PM)', budgetEUR: 120000 },
];

// Initial Vendor Aliases
const initialAliases: VendorAlias[] = [
  { id: 'alias-1', rawPattern: 'SAP BELGIUM N', canonicalVendor: 'SAP BELGIUM NV', notes: 'Truncated SAP Belgium entity' },
  { id: 'alias-2', rawPattern: 'PLANISWARE BELGIUM SR', canonicalVendor: 'PLANISWARE BELGIUM SRL', notes: 'Planisware local entity' },
  { id: 'alias-3', rawPattern: 'ERNST & YOUNG CONSUL', canonicalVendor: 'ERNST & YOUNG CONSULTING', notes: 'EY Consulting truncation' },
  { id: 'alias-4', rawPattern: 'ERNST & YOUNG CONSULTI', canonicalVendor: 'ERNST & YOUNG CONSULTING', notes: 'EY Consulting truncation 2' },
  { id: 'alias-5', rawPattern: 'ERNST & YOUNG CONSULTIN', canonicalVendor: 'ERNST & YOUNG CONSULTING', notes: 'EY Consulting truncation 3' },
  { id: 'alias-6', rawPattern: 'FLEXSO SUPPLY CHAI', canonicalVendor: 'FLEXSO SUPPLY CHAIN NV', notes: 'Flexso partner truncation' },
];

class Store {
  private db: AppDatabase;

  constructor() {
    this.db = this.loadDatabase();
    if (this.db.snapshots.length === 0 || this.db.snapshots[0]?.filename?.includes('OPEX Sheets')) {
      this.seedInitialSnapshots();
    }
  }

  private loadDatabase(): AppDatabase {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.error('Error reading db.json, re-initializing database:', e);
    }

    return {
      users: initialUsers,
      projects: initialProjects,
      vendorAliases: initialAliases,
      snapshots: [],
      transactions: [],
      subtotalRows: [],
      monthCloseConfirmations: [],
      auditLogs: [
        {
          id: 'log-1',
          timestamp: new Date().toISOString(),
          userId: 'usr-admin',
          userName: 'Alexander Wright',
          action: 'SYSTEM_INIT',
          target: 'Database',
          details: 'Initialized Planisware CAPEX system database with seed configuration.',
        },
      ],
      warnings: [],
    };
  }

  public save() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.db, null, 2), 'utf-8');
    } catch (e) {
      console.error('Failed to write db.json:', e);
    }
  }

  public getDB(): AppDatabase {
    return this.db;
  }

  /**
   * Helper to build sample CJI3 Excel file buffer for Month 1 (August 2026) and Month 2 (September 2026)
   */
  public createSampleCJI3Buffer(monthStr: '2026-08' | '2026-09'): Buffer {
    const isM1 = monthStr === '2026-08';

    const headers = [
      'WBS Element',
      'Document Date',
      'Object',
      'Cost Element',
      'Purchasing Document',
      'Value in Object Currency',
      'Value in Transaction Currency',
      'CO Area Currency',
      'Transaction Currency',
      'Name / vendor or accounting description',
      'Reference Fiscal Year',
      'From Period',
      'Cost Element Description',
      'Posting Date',
    ];

    let rows: any[][] = [headers];

    if (isM1) {
      // Month 1 - August 2026
      rows.push(
        // P-1001-CAPEX
        ['P-1001-CAPEX', '2026-08-05', 'WBS P-1001', '500100', '45001001', 15000, 15000, 'EUR', 'EUR', 'SAP BELGIUM N / Inv 9812', '2026', '08', 'External Services', '2026-08-05'],
        ['P-1001-CAPEX', '2026-08-12', 'WBS P-1001', '500100', '45001002', 8500, 8500, 'EUR', 'EUR', 'PLANISWARE BELGIUM SR / License A', '2026', '08', 'External Software', '2026-08-12'],
        ['P-1001-CAPEX', '2026-08-20', 'WBS P-1001', '500200', '', 4200, 4200, 'EUR', 'EUR', 'Reclass internal hours from OPEX to Capex', '2026', '08', 'Internal Hours Reclass', '2026-08-20'],
        ['P-1001-CAPEX', '', '', '', '', 27700, 27700, '', '', '', '', '', '', ''], // Subtotal row

        // P-1002-CAPEX
        ['P-1002-CAPEX', '2026-08-10', 'WBS P-1002', '500100', '45002001', 12000, 12000, 'EUR', 'EUR', 'ERNST & YOUNG CONSUL / Audit Services', '2026', '08', 'Consulting', '2026-08-10'],
        ['P-1002-CAPEX', '2026-08-15', 'WBS P-1002', '500100', '45002002', 6000, 6000, 'EUR', 'EUR', 'FLEXSO SUPPLY CHAI / Module Config', '2026', '08', 'Implementation', '2026-08-15'],
        ['P-1002-CAPEX', '', '', '', '', 18000, 18000, '', '', '', '', '', '', ''], // Subtotal row

        // P-1003-CAPEX
        ['P-1003-CAPEX', '2026-08-18', 'WBS P-1003', '500100', '45003001', 35000, 35000, 'EUR', 'EUR', 'SAP BELGIUM NV / S4HANA License', '2026', '08', 'Software License', '2026-08-18'],
        ['P-1003-CAPEX', '2026-08-22', 'WBS P-1003', '500300', '', 1500, 1500, 'EUR', 'EUR', 'WBS Correction / Shift to CAPEX', '2026', '08', 'Accounting Adjustment', '2026-08-22'],
        ['P-1003-CAPEX', '', '', '', '', 36500, 36500, '', '', '', '', '', '', ''] // Subtotal row
      );
    } else {
      // Month 2 - September 2026 (Includes additions, late postings, new invoices, reversals)
      rows.push(
        // P-1001-CAPEX (M1 carryovers + new September additions)
        ['P-1001-CAPEX', '2026-08-05', 'WBS P-1001', '500100', '45001001', 15000, 15000, 'EUR', 'EUR', 'SAP BELGIUM N / Inv 9812', '2026', '08', 'External Services', '2026-08-05'],
        ['P-1001-CAPEX', '2026-08-12', 'WBS P-1001', '500100', '45001002', 8500, 8500, 'EUR', 'EUR', 'PLANISWARE BELGIUM SR / License A', '2026', '08', 'External Software', '2026-08-12'],
        ['P-1001-CAPEX', '2026-09-04', 'WBS P-1001', '500100', '45001001', 7500, 7500, 'EUR', 'EUR', 'SAP BELGIUM NV / Inv 9920 - Phase 2', '2026', '09', 'External Services', '2026-09-04'], // New SAP invoice
        ['P-1001-CAPEX', '2026-08-20', 'WBS P-1001', '500200', '', 4200, 4200, 'EUR', 'EUR', 'Reclass internal hours from OPEX to Capex', '2026', '08', 'Internal Hours Reclass', '2026-08-20'],
        ['P-1001-CAPEX', '2026-09-15', 'WBS P-1001', '500200', '', 3100, 3100, 'EUR', 'EUR', 'Reclass internal hours from OPEX to Capex', '2026', '09', 'Internal Hours Reclass', '2026-09-15'],
        ['P-1001-CAPEX', '', '', '', '', 38300, 38300, '', '', '', '', '', '', ''],

        // P-1002-CAPEX (Includes truncated name variation + new Ernst & Young invoice)
        ['P-1002-CAPEX', '2026-08-10', 'WBS P-1002', '500100', '45002001', 12000, 12000, 'EUR', 'EUR', 'ERNST & YOUNG CONSUL / Audit Services', '2026', '08', 'Consulting', '2026-08-10'],
        ['P-1002-CAPEX', '2026-08-15', 'WBS P-1002', '500100', '45002002', 6000, 6000, 'EUR', 'EUR', 'FLEXSO SUPPLY CHAI / Module Config', '2026', '08', 'Implementation', '2026-08-15'],
        ['P-1002-CAPEX', '2026-09-10', 'WBS P-1002', '500100', '45002001', 9500, 9500, 'EUR', 'EUR', 'ERNST & YOUNG CONSULTIN / Advisory Q3', '2026', '09', 'Consulting', '2026-09-10'],
        ['P-1002-CAPEX', '', '', '', '', 27500, 27500, '', '', '', '', '', '', ''],

        // P-1003-CAPEX (Includes negative reversal -2000)
        ['P-1003-CAPEX', '2026-08-18', 'WBS P-1003', '500100', '45003001', 35000, 35000, 'EUR', 'EUR', 'SAP BELGIUM NV / S4HANA License', '2026', '08', 'Software License', '2026-08-18'],
        ['P-1003-CAPEX', '2026-09-02', 'WBS P-1003', '500100', '45003001', -2000, -2000, 'EUR', 'EUR', 'SAP BELGIUM NV / Credit Note Overcharge', '2026', '09', 'Software License', '2026-09-02'],
        ['P-1003-CAPEX', '2026-08-22', 'WBS P-1003', '500300', '', 1500, 1500, 'EUR', 'EUR', 'WBS Correction / Shift to CAPEX', '2026', '08', 'Accounting Adjustment', '2026-08-22'],
        ['P-1003-CAPEX', '', '', '', '', 34500, 34500, '', '', '', '', '', '', ''],

        // P-1004-CAPEX (New WBS appearing in Month 2!)
        ['P-1004-CAPEX', '2026-09-12', 'WBS P-1004', '500100', '45004001', 14200, 14200, 'EUR', 'EUR', 'PLANISWARE BELGIUM SR / Enterprise Addon', '2026', '09', 'Software', '2026-09-12'],
        ['P-1004-CAPEX', '', '', '', '', 14200, 14200, '', '', '', '', '', '', '']
      );
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'CJI3 Extract');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
   * Automatically seed initial CJI3 snapshots for Month 1 (2026-08) and Month 2 (2026-09)
   */
  private seedInitialSnapshots() {
    try {
      const localFilePath = path.join(process.cwd(), 'capex-export-CJI3.xlsx');
      if (fs.existsSync(localFilePath)) {
        console.log('Seeding initial database directly from local capex-export-CJI3.xlsx file...');
        const fileBuf = fs.readFileSync(localFilePath);
        const wb = XLSX.read(fileBuf, { type: 'buffer' });

        // Map WBS to Project Names using codes match sheet if available
        const codeMap = new Map<string, string>();
        if (wb.Sheets['codes match']) {
          const matchRows = XLSX.utils.sheet_to_json(wb.Sheets['codes match']) as any[];
          for (const row of matchRows) {
            const projName = row['Project ID'];
            const capexWbs = row['Project CAPEX ID'];
            const opexWbs = row['Project OPEX ID'];
            if (projName) {
              if (capexWbs && capexWbs !== 'Not needed') codeMap.set(String(capexWbs).trim(), String(projName).trim());
              if (opexWbs && opexWbs !== 'Not needed') codeMap.set(String(opexWbs).trim(), String(projName).trim());
            }
          }
        }

        const snapId = 'snap-source-excel-v1';
        const capexParsed = parseCJI3Excel(fileBuf, snapId, 'capex-export-CJI3.xlsx', this.db.vendorAliases, 'CAPEX CJI3');

        // Strictly use CAPEX CJI3 transactions for the CAPEX system
        const allTransactions = capexParsed.detailRows;

        // Extract accurate project budgets from CAPEX Tables if available
        const budgetMap = new Map<string, number>();
        if (wb.Sheets['CAPEX Tables']) {
          const tableRows = XLSX.utils.sheet_to_json(wb.Sheets['CAPEX Tables'], { header: 1 }) as any[][];
          for (let i = 6; i < tableRows.length; i++) {
            const r = tableRows[i];
            if (!r || !r[0]) continue;
            const wbs = String(r[0]).trim();
            const b = typeof r[14] === 'number' ? r[14] : parseFloat(r[14]);
            if (wbs && !isNaN(b) && b > 0) {
              budgetMap.set(wbs, b);
            }
          }
        }

        // Unique WBS elements
        const wbsSet = new Map<string, string>();
        allTransactions.forEach((tx) => {
          const wbs = tx.normalizedWbs;
          if (!wbsSet.has(wbs)) {
            const mappedName = codeMap.get(wbs) || (tx.nameDescription ? tx.nameDescription.split('/')[1] || tx.nameDescription.split('/')[0] : `Project ${wbs}`);
            wbsSet.set(wbs, mappedName);
          }
        });

        const projectList: Project[] = Array.from(wbsSet.entries()).map(([wbs, name]) => ({
          wbs,
          name,
          assignedPmId: 'usr-pm-sarah',
          assignedPmName: 'Sarah Jenkins (PM)',
          budgetEUR: budgetMap.get(wbs) || 350000,
        }));

        this.db.projects = projectList;
        this.db.transactions = allTransactions;

        const snapshot: MonthlySnapshot = {
          id: snapId,
          reportingMonth: '2026-09',
          version: 1,
          status: 'COMMITTED',
          filename: 'capex-export-CJI3.xlsx (CAPEX CJI3)',
          uploadedBy: 'usr-admin',
          uploadedAt: new Date().toISOString(),
          totalRows: capexParsed.summary.totalRows,
          detailRowsCount: allTransactions.length,
          subtotalRowsCount: capexParsed.summary.subtotalCount,
          wbsCount: wbsSet.size,
          vendorCount: capexParsed.summary.vendorCount,
          totalExternalSpend: capexParsed.summary.totalExternalSpend,
          totalInternalReclass: capexParsed.summary.totalInternalReclass,
          totalCorrectionTransfer: capexParsed.summary.totalCorrectionTransfer,
          totalOtherNonPo: capexParsed.summary.totalOtherNonPo,
        };

        this.db.snapshots = [snapshot];
        this.save();
        console.log(`Successfully seeded ${allTransactions.length} detail transactions across ${projectList.length} WBS projects.`);
        return;
      }

      console.log('Seeding initial CJI3 monthly snapshots for Month 1 (2026-08) and Month 2 (2026-09)...');

      // Month 1
      const bufM1 = this.createSampleCJI3Buffer('2026-08');
      const snap1Id = 'snap-2026-08-v1';
      const parsedM1 = parseCJI3Excel(bufM1, snap1Id, 'SAP_CJI3_2026_08.xlsx', this.db.vendorAliases);

      const snapshot1: MonthlySnapshot = {
        id: snap1Id,
        reportingMonth: '2026-08',
        version: 1,
        status: 'COMMITTED',
        filename: 'SAP_CJI3_2026_08.xlsx',
        uploadedBy: 'usr-admin',
        uploadedAt: '2026-08-01T09:00:00.000Z',
        totalRows: parsedM1.summary.totalRows,
        detailRowsCount: parsedM1.summary.detailCount,
        subtotalRowsCount: parsedM1.summary.subtotalCount,
        wbsCount: parsedM1.summary.wbsCount,
        vendorCount: parsedM1.summary.vendorCount,
        totalExternalSpend: parsedM1.summary.totalExternalSpend,
        totalInternalReclass: parsedM1.summary.totalInternalReclass,
        totalCorrectionTransfer: parsedM1.summary.totalCorrectionTransfer,
        totalOtherNonPo: parsedM1.summary.totalOtherNonPo,
      };

      this.db.snapshots.push(snapshot1);
      this.db.transactions.push(...parsedM1.detailRows);

      // Month 1 Closures (Processed by Sarah and David for 2026-08)
      this.db.monthCloseConfirmations.push(
        {
          id: 'mc-2026-08-P1001',
          wbs: 'P-1001-CAPEX',
          reportingMonth: '2026-08',
          status: 'Processed',
          amountConfirmed: 23500,
          vendorAmounts: { 'SAP BELGIUM NV': 15000, 'PLANISWARE BELGIUM SRL': 8500 },
          planiswareRef: 'PLN-2026-08-1001',
          comment: 'August CAPEX actuals entered into Planisware module.',
          confirmedBy: 'Sarah Jenkins (PM)',
          confirmedAt: '2026-08-15T14:30:00.000Z',
        },
        {
          id: 'mc-2026-08-P1002',
          wbs: 'P-1002-CAPEX',
          reportingMonth: '2026-08',
          status: 'Processed',
          amountConfirmed: 18000,
          vendorAmounts: { 'ERNST & YOUNG CONSULTING': 12000, 'FLEXSO SUPPLY CHAIN NV': 6000 },
          planiswareRef: 'PLN-2026-08-1002',
          comment: 'Consulting & partner actuals verified.',
          confirmedBy: 'Sarah Jenkins (PM)',
          confirmedAt: '2026-08-16T11:20:00.000Z',
        },
        {
          id: 'mc-2026-08-P1003',
          wbs: 'P-1003-CAPEX',
          reportingMonth: '2026-08',
          status: 'Processed',
          amountConfirmed: 35000,
          vendorAmounts: { 'SAP BELGIUM NV': 35000 },
          planiswareRef: 'PLN-2026-08-1003',
          comment: 'Initial S/4HANA software license logged.',
          confirmedBy: 'David Chen (PM)',
          confirmedAt: '2026-08-18T16:45:00.000Z',
        }
      );

      // Month 2
      const bufM2 = this.createSampleCJI3Buffer('2026-09');
      const snap2Id = 'snap-2026-09-v1';
      const parsedM2 = parseCJI3Excel(bufM2, snap2Id, 'SAP_CJI3_2026_09.xlsx', this.db.vendorAliases);

      const snapshot2: MonthlySnapshot = {
        id: snap2Id,
        reportingMonth: '2026-09',
        version: 1,
        status: 'COMMITTED',
        filename: 'SAP_CJI3_2026_09.xlsx',
        uploadedBy: 'usr-admin',
        uploadedAt: '2026-09-01T08:30:00.000Z',
        totalRows: parsedM2.summary.totalRows,
        detailRowsCount: parsedM2.summary.detailCount,
        subtotalRowsCount: parsedM2.summary.subtotalCount,
        wbsCount: parsedM2.summary.wbsCount,
        vendorCount: parsedM2.summary.vendorCount,
        totalExternalSpend: parsedM2.summary.totalExternalSpend,
        totalInternalReclass: parsedM2.summary.totalInternalReclass,
        totalCorrectionTransfer: parsedM2.summary.totalCorrectionTransfer,
        totalOtherNonPo: parsedM2.summary.totalOtherNonPo,
      };

      this.db.snapshots.push(snapshot2);
      this.db.transactions.push(...parsedM2.detailRows);

      this.save();
      console.log('Seeded initial CJI3 snapshots successfully!');
    } catch (e) {
      console.error('Failed to seed initial snapshots:', e);
    }
  }
}

export const store = new Store();
