import * as XLSX from 'xlsx';
import { ImportedTransaction, WBSMonthlySummary } from '../src/types.js';

/**
 * Generates an Excel workbook buffer for Planisware Entry Instructions
 */
export function generatePlaniswareExportExcel(
  reportingMonth: string,
  summaries: WBSMonthlySummary[]
): Buffer {
  const exportRows: any[] = [];

  for (const s of summaries) {
    for (const v of s.vendorDeltas) {
      if (Math.abs(v.addThisMonth) > 0.001 || v.status === 'Processed') {
        exportRows.push({
          'Reporting Month': reportingMonth,
          'Project Name': s.projectName,
          'CAPEX WBS Element': s.wbs,
          'External Vendor Name': v.vendor,
          'Previous Balance (EUR)': v.previousBalance,
          'Amount to Add in Planisware (EUR)': v.addThisMonth,
          'New Cumulative Balance (EUR)': v.newBalance,
          'Status': v.status,
          'Planisware Reference': s.planiswareRef || '',
          'Comment / Notes': s.comment || '',
        });
      }
    }
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(exportRows);

  // Set column widths
  ws['!cols'] = [
    { wch: 15 }, // Month
    { wch: 25 }, // Project
    { wch: 20 }, // WBS
    { wch: 30 }, // Vendor
    { wch: 20 }, // Previous
    { wch: 22 }, // Add
    { wch: 22 }, // New
    { wch: 15 }, // Status
    { wch: 20 }, // Reference
    { wch: 30 }, // Comment
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Planisware Entry Instructions');

  // Convert to Buffer
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Generates a full Reconciliation Audit Excel export containing raw source rows
 */
export function generateReconciliationExportExcel(
  reportingMonth: string,
  transactions: ImportedTransaction[]
): Buffer {
  const rows = transactions.map((t) => ({
    'WBS Element': t.wbs,
    'Doc Date': t.docDate,
    'Cost Element': t.costElement,
    'Purchasing Doc': t.purchasingDoc,
    'Value in Object Currency (EUR)': t.valueObjectCurr,
    'Name / Vendor Description': t.nameDescription,
    'Normalized Vendor': t.normalizedVendor,
    'Classification': t.classification,
    'Is Subtotal': t.isSubtotal ? 'YES' : 'NO',
    'Is Excluded': t.isExcluded ? 'YES' : 'NO',
    'Fiscal Year': t.refFiscalYear,
    'Period': t.fromPeriod,
    'Posting Date': t.postingDate,
    'Source File Line': t.sourceRow,
    'Transaction Fingerprint': t.fingerprint,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  ws['!cols'] = [
    { wch: 20 },
    { wch: 12 },
    { wch: 15 },
    { wch: 18 },
    { wch: 22 },
    { wch: 35 },
    { wch: 28 },
    { wch: 20 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
    { wch: 15 },
    { wch: 35 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Raw CJI3 Reconciliation Audit');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
