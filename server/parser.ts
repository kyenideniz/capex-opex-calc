import * as XLSX from 'xlsx';
import crypto from 'crypto';
import {
  CostClassification,
  ImportedTransaction,
  ParseResult,
  RawCJI3Row,
  ReviewWarning,
  VendorAlias,
} from '../src/types.js';

/**
 * Creates a unique deterministic fingerprint string for a transaction row
 */
export function createFingerprint(row: Partial<RawCJI3Row>): string {
  const parts = [
    (row.wbs || '').trim(),
    (row.docDate || '').trim(),
    (row.postingDate || '').trim(),
    (row.costElement || '').trim(),
    (row.purchasingDoc || '').trim(),
    (row.valueObjectCurr || 0).toFixed(2),
    (row.nameDescription || '').trim(),
    (row.refFiscalYear || '').trim(),
    (row.fromPeriod || '').trim(),
  ];
  return crypto.createHash('md5').update(parts.join('|')).digest('hex');
}

/**
 * Extracts and normalizes vendor name from Column J text and alias database
 */
export function normalizeVendor(
  colJRaw: string | undefined,
  purchasingDoc: string | undefined,
  aliases: VendorAlias[]
): { rawVendor: string; normalizedVendor: string; isUnknown: boolean } {
  let text = (colJRaw || '').trim();
  let rawVendor = '';

  if (text) {
    // Text before first '/'
    const slashIdx = text.indexOf('/');
    rawVendor = slashIdx >= 0 ? text.substring(0, slashIdx).trim() : text.trim();
  }

  if (!rawVendor) {
    if (purchasingDoc && purchasingDoc.trim()) {
      rawVendor = 'Unknown vendor';
    } else {
      rawVendor = 'No PO / Unclassified';
    }
  }

  const upperRaw = rawVendor.toUpperCase();

  // Check alias list (exact match or prefix match or fuzzy prefix match)
  const matchedAlias = aliases.find((a) => {
    const pattern = a.rawPattern.trim().toUpperCase();
    return upperRaw === pattern || upperRaw.startsWith(pattern) || pattern.startsWith(upperRaw);
  });

  const normalizedVendor = matchedAlias ? matchedAlias.canonicalVendor : rawVendor;
  const isUnknown = normalizedVendor === 'Unknown vendor' || !rawVendor;

  return { rawVendor, normalizedVendor, isUnknown };
}

/**
 * Classifies a row based on CJI3 business rules
 */
export function classifyRow(
  purchasingDoc: string | undefined,
  nameDesc: string | undefined,
  costElemDesc: string | undefined
): CostClassification {
  const colJ = (nameDesc || '').trim();
  const colM = (costElemDesc || '').trim();
  const fullText = `${colJ} ${colM}`.toUpperCase();

  // 1. Internal reclassification
  if (fullText.includes('RECLASS INTERNAL HOURS') || fullText.includes('INTERNAL HOURS')) {
    return 'INTERNAL_RECLASS';
  }

  // 2. Correction or accounting transfer
  if (
    fullText.includes('WBS CORRECTION') ||
    fullText.includes('RECLASS: WBS CORRECTION') ||
    fullText.startsWith('RECLASS') ||
    fullText.includes('INTERCOMPANY TRANSFER') ||
    fullText.includes('ACCOUNTING TRANSFER') ||
    fullText.includes('REVERSAL')
  ) {
    return 'CORRECTION_TRANSFER';
  }

  // 3. External vendor cost
  if (purchasingDoc && purchasingDoc.trim() !== '') {
    return 'EXTERNAL_VENDOR';
  }

  // 4. Other non-PO cost
  return 'OTHER_NON_PO';
}

/**
 * Parses a CJI3 Excel buffer or workbook
 */
export function parseCJI3Excel(
  buffer: Buffer,
  snapshotId: string,
  filename: string,
  aliases: VendorAlias[],
  targetSheetName?: string
): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const availableSheets = workbook.SheetNames;
  
  // Find CJI3 worksheet (target sheet if specified, or prefer CAPEX CJI3 / CJI3, or first sheet)
  let sheetName = targetSheetName && availableSheets.includes(targetSheetName)
    ? targetSheetName
    : availableSheets.find((s) => s.toUpperCase().includes('CAPEX CJI3')) ||
      availableSheets.find((s) => s.toUpperCase().includes('CJI3')) ||
      availableSheets[0];

  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error('No valid worksheet found in uploaded Excel file.');
  }

  // Convert to JSON row array
  const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  if (rawData.length === 0) {
    throw new Error('Selected worksheet is empty.');
  }

  // Find header row or default to row 0
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(10, rawData.length); i++) {
    const rowStr = rawData[i].map((c) => String(c).toUpperCase()).join(' ');
    if (rowStr.includes('WBS') || rowStr.includes('DOCUMENT DATE') || rowStr.includes('OBJECT')) {
      headerRowIdx = i;
      break;
    }
  }

  const detailRows: ImportedTransaction[] = [];
  const subtotalRows: RawCJI3Row[] = [];
  const warnings: ReviewWarning[] = [];
  const fingerprintMap = new Map<string, string>(); // fingerprint -> transactionId

  let detailCount = 0;
  let subtotalCount = 0;
  let totalExternalSpend = 0;
  let totalInternalReclass = 0;
  let totalCorrectionTransfer = 0;
  let totalOtherNonPo = 0;
  let unknownVendorCount = 0;

  const wbsSet = new Set<string>();
  const vendorSet = new Set<string>();

  for (let i = headerRowIdx + 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;

    const wbs = String(row[0] || '').trim();
    if (!wbs) continue; // Skip blank lines

    const docDate = String(row[1] || '').trim();
    const object = String(row[2] || '').trim();
    const costElement = String(row[3] || '').trim();
    const purchasingDoc = String(row[4] || '').trim();

    // Value in Object Currency (Col F)
    let valObj = row[5];
    let valueObjectCurr = typeof valObj === 'number' ? valObj : parseFloat(String(valObj).replace(/,/g, '')) || 0;

    let valTrans = row[6];
    let valueTransCurr = typeof valTrans === 'number' ? valTrans : parseFloat(String(valTrans).replace(/,/g, '')) || 0;

    const coAreaCurr = String(row[7] || 'EUR').trim();
    const transCurr = String(row[8] || 'EUR').trim();
    const nameDescription = String(row[9] || '').trim();
    const refFiscalYear = String(row[10] || '').trim();
    const fromPeriod = String(row[11] || '').trim();
    const costElemDesc = String(row[12] || '').trim();
    const postingDate = String(row[13] || '').trim();

    const rawRowObj: RawCJI3Row = {
      wbs,
      docDate,
      object,
      costElement,
      purchasingDoc,
      valueObjectCurr,
      valueTransCurr,
      coAreaCurr,
      transCurr,
      nameDescription,
      refFiscalYear,
      fromPeriod,
      costElemDesc,
      postingDate,
      sourceRow: i + 1,
    };

    // Subtotal Row Detection:
    // Subtotal rows contain a WBS and amount, but NO docDate, postingDate, or fiscal year.
    const isSubtotal = !docDate && !postingDate && !refFiscalYear;

    if (isSubtotal) {
      subtotalRows.push(rawRowObj);
      subtotalCount++;
      continue;
    }

    // Detail Row Processing
    wbsSet.add(wbs);

    // Vendor normalization
    const { rawVendor, normalizedVendor, isUnknown } = normalizeVendor(nameDescription, purchasingDoc, aliases);
    if (isUnknown && purchasingDoc) {
      unknownVendorCount++;
      warnings.push({
        id: `warn-unknown-${snapshotId}-${i}`,
        snapshotId,
        wbs,
        vendor: normalizedVendor,
        severity: 'warning',
        type: 'UNKNOWN_VENDOR',
        message: `WBS ${wbs}: Vendor description in Col J is blank or unknown for PO ${purchasingDoc}.`,
        details: `Row ${i + 1}`,
      });
    }

    // Classification
    const classification = classifyRow(purchasingDoc, nameDescription, costElemDesc);

    if (classification === 'EXTERNAL_VENDOR') {
      vendorSet.add(normalizedVendor);
      totalExternalSpend += valueObjectCurr;
    } else if (classification === 'INTERNAL_RECLASS') {
      totalInternalReclass += valueObjectCurr;
    } else if (classification === 'CORRECTION_TRANSFER') {
      totalCorrectionTransfer += valueObjectCurr;
      warnings.push({
        id: `warn-corr-${snapshotId}-${i}`,
        snapshotId,
        wbs,
        vendor: normalizedVendor,
        severity: 'info',
        type: 'CORRECTION_AFFECTS_BALANCE',
        message: `WBS ${wbs}: Correction/transfer line detected ("${nameDescription}"). Excluded from manual entry.`,
        details: `Row ${i + 1}, Amount: EUR ${valueObjectCurr.toFixed(2)}`,
      });
    } else {
      totalOtherNonPo += valueObjectCurr;
    }

    // Fingerprint for duplicate detection
    const fingerprint = createFingerprint(rawRowObj);
    const id = `tx-${snapshotId}-${i + 1}`;

    if (fingerprintMap.has(fingerprint)) {
      warnings.push({
        id: `warn-dup-${snapshotId}-${i}`,
        snapshotId,
        wbs,
        vendor: normalizedVendor,
        severity: 'warning',
        type: 'DUPLICATE_TRANSACTION',
        message: `WBS ${wbs}: Duplicate transaction fingerprint detected.`,
        details: `Row ${i + 1} matches previous row in same file. Fingerprint: ${fingerprint}`,
        transactionId: id,
      });
    } else {
      fingerprintMap.set(fingerprint, id);
    }

    const tx: ImportedTransaction = {
      ...rawRowObj,
      id,
      snapshotId,
      fingerprint,
      normalizedWbs: wbs,
      rawVendor,
      normalizedVendor,
      classification,
      isSubtotal: false,
      isExcluded: false,
    };

    detailRows.push(tx);
    detailCount++;
  }

  return {
    filename,
    sheetName,
    availableSheets,
    detailRows,
    subtotalRows,
    warnings,
    summary: {
      totalRows: detailCount + subtotalCount,
      detailCount,
      subtotalCount,
      wbsCount: wbsSet.size,
      vendorCount: vendorSet.size,
      totalExternalSpend,
      totalInternalReclass,
      totalCorrectionTransfer,
      totalOtherNonPo,
      unknownVendorCount,
      duplicateCount: warnings.filter((w) => w.type === 'DUPLICATE_TRANSACTION').length,
    },
  };
}
