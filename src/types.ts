/**
 * Types and interfaces for Planisware CAPEX Maintenance system
 */

export type UserRole = 'admin' | 'pm';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
}

export type CostClassification =
  | 'EXTERNAL_VENDOR'      // External vendor cost - manually maintained in Planisware
  | 'INTERNAL_RECLASS'     // Internal hour reclassification - not manually entered
  | 'CORRECTION_TRANSFER'  // Correction or accounting transfer - do not enter
  | 'OTHER_NON_PO';        // Other non-PO cost - review only

export interface RawCJI3Row {
  wbs: string;                  // Col A
  docDate?: string;             // Col B
  object?: string;              // Col C
  costElement?: string;         // Col D
  purchasingDoc?: string;       // Col E
  valueObjectCurr: number;      // Col F (Main amount in EUR)
  valueTransCurr?: number;      // Col G
  coAreaCurr?: string;          // Col H
  transCurr?: string;           // Col I
  nameDescription?: string;     // Col J
  refFiscalYear?: string;       // Col K
  fromPeriod?: string;          // Col L
  costElemDesc?: string;        // Col M
  postingDate?: string;         // Col N
  sourceRow: number;
}

export interface ImportedTransaction extends RawCJI3Row {
  id: string;
  snapshotId: string;
  fingerprint: string;
  normalizedWbs: string;
  rawVendor: string;
  normalizedVendor: string;
  classification: CostClassification;
  isSubtotal: boolean;
  isExcluded: boolean;
  exclusionReason?: string;
  userOverride?: {
    classification?: CostClassification;
    isExcluded?: boolean;
    reason?: string;
    updatedBy?: string;
    updatedAt?: string;
  };
}

export interface VendorAlias {
  id: string;
  rawPattern: string;       // Exact match or substring/prefix e.g. "SAP BELGIUM N"
  canonicalVendor: string;   // Normalized name e.g. "SAP BELGIUM NV"
  notes?: string;
  createdBy?: string;
  createdAt?: string;
}

export interface Project {
  wbs: string;
  name: string;
  assignedPmId?: string;
  assignedPmName?: string;
  budgetEUR?: number;
  opexMapping?: string;
}

export type SnapshotStatus = 'DRAFT' | 'COMMITTED' | 'REOPENED';

export interface MonthlySnapshot {
  id: string;
  reportingMonth: string; // "YYYY-MM" e.g., "2026-08"
  version: number;        // 1, 2, ...
  status: SnapshotStatus;
  filename: string;
  uploadedBy: string;
  uploadedAt: string;
  totalRows: number;
  detailRowsCount: number;
  subtotalRowsCount: number;
  wbsCount: number;
  vendorCount: number;
  totalExternalSpend: number;
  totalInternalReclass: number;
  totalCorrectionTransfer: number;
  totalOtherNonPo: number;
}

export type VendorEntryStatus = 'To enter' | 'Processed' | 'Review' | 'No action';

export interface VendorMonthlyDelta {
  vendor: string;
  previousBalance: number;
  addThisMonth: number;
  newBalance: number;
  status: VendorEntryStatus;
  transactionCount: number;
}

export interface WBSMonthlySummary {
  wbs: string;
  projectName: string;
  reportingMonth: string;
  assignedPmId?: string;
  assignedPmName?: string;
  previousBalance: number;
  addThisMonth: number;
  newBalance: number;
  internalReclassTotal: number;
  otherReviewTotal: number;
  correctionTotal: number;
  budgetEUR?: number;
  remainingBudgetEUR?: number;
  latestPostingDate?: string;
  processingStatus: MonthCloseStatus;
  planiswareRef?: string;
  comment?: string;
  processedBy?: string;
  processedAt?: string;
  warningsCount: number;
  vendorDeltas: VendorMonthlyDelta[];
}

export type MonthCloseStatus = 'Not started' | 'To review' | 'Ready to enter' | 'Processed' | 'Reopened';

export interface MonthCloseConfirmation {
  id: string;
  wbs: string;
  reportingMonth: string;
  status: MonthCloseStatus;
  amountConfirmed: number;
  vendorAmounts: Record<string, number>;
  planiswareRef?: string;
  comment?: string;
  confirmedBy: string;
  confirmedAt: string;
}

export type WarningSeverity = 'info' | 'warning' | 'error';

export interface ReviewWarning {
  id: string;
  snapshotId: string;
  wbs: string;
  vendor?: string;
  severity: WarningSeverity;
  type:
    | 'NEGATIVE_ADDITION'
    | 'UNKNOWN_VENDOR'
    | 'NEW_WBS'
    | 'NEW_VENDOR'
    | 'DUPLICATE_TRANSACTION'
    | 'CORRECTION_AFFECTS_BALANCE'
    | 'PROCESSED_AMOUNT_CHANGED'
    | 'BUDGET_EXCEEDED'
    | 'SUBTOTAL_MISMATCH'
    | 'MULTIPLE_ALIASES_MATCH';
  message: string;
  details?: string;
  transactionId?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  target: string;
  details: string;
}

export interface TestCaseResult {
  id: number;
  title: string;
  passed: boolean;
  message: string;
  details?: any;
}

export interface ParseResult {
  filename: string;
  sheetName: string;
  availableSheets?: string[];
  detailRows: ImportedTransaction[];
  subtotalRows: RawCJI3Row[];
  warnings: ReviewWarning[];
  summary: {
    totalRows: number;
    detailCount: number;
    subtotalCount: number;
    wbsCount: number;
    vendorCount: number;
    totalExternalSpend: number;
    totalInternalReclass: number;
    totalCorrectionTransfer: number;
    totalOtherNonPo: number;
    unknownVendorCount: number;
    duplicateCount: number;
  };
}
