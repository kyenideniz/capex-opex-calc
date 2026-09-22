import {
  ImportedTransaction,
  MonthCloseConfirmation,
  Project,
  ProjectType,
  ReviewWarning,
  VendorMonthlyDelta,
  WBSMonthlySummary,
} from '../src/types.js';
import { includeManualCapex } from './parser.js';

export function getTransactionMonth(t: ImportedTransaction): string {
  if (t.refFiscalYear && t.fromPeriod) {
    const yr = String(t.refFiscalYear).trim();
    const p = String(t.fromPeriod).trim().padStart(2, '0');
    if (yr.length === 4 && !isNaN(Number(p))) {
      return `${yr}-${p}`;
    }
  }
  if (t.postingDate || t.docDate) {
    const d = new Date(t.postingDate || t.docDate);
    if (!isNaN(d.getTime())) {
      const yr = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      return `${yr}-${m}`;
    }
  }
  return '2026-09';
}

export function calculateWBSMonthlySummary(
  wbs: string,
  reportingMonth: string,
  currentTxList: ImportedTransaction[],
  previousTxList: ImportedTransaction[],
  project?: Project,
  monthClose?: MonthCloseConfirmation
): { summary: WBSMonthlySummary; warnings: ReviewWarning[] } {
  const warnings: ReviewWarning[] = [];

  const isOpex = wbs.startsWith('C') || wbs.startsWith('C7941/') || project?.projectType === 'OPEX';
  const projectType: ProjectType = isOpex ? 'OPEX' : 'CAPEX';
  const sourceWbs = isOpex ? (wbs.endsWith('/2/2') ? wbs : `${wbs}/2/2`) : wbs;
  const cutoffDate = '2026-09-05';

  // Transaction filter predicate based on project type
  const filterTx = (t: ImportedTransaction) => {
    if (t.isExcluded || t.userOverride?.isExcluded) return false;

    if (isOpex) {
      // OPEX logic: Match sourceWbs or base wbs with document date present
      const matchesWbs = t.normalizedWbs === sourceWbs || t.normalizedWbs === wbs;
      const hasDate = Boolean((t.docDate || '').trim() || (t.postingDate || '').trim());
      if (!matchesWbs || !hasDate) return false;

      // Filter by cutoff date if present
      if (cutoffDate) {
        const dStr = t.docDate || t.postingDate;
        if (dStr) {
          const txTime = new Date(dStr).getTime();
          const cutoffTime = new Date(cutoffDate).getTime();
          if (!isNaN(txTime) && !isNaN(cutoffTime) && txTime > cutoffTime) {
            return false;
          }
        }
      }
      return true;
    } else {
      // CAPEX logic: Match project code directly using includeManualCapex
      if (t.normalizedWbs !== wbs && t.wbs !== wbs) return false;
      return includeManualCapex(t);
    }
  };

  // Filter current active valid external transactions for this WBS
  const currentExternalTx = currentTxList.filter(filterTx);

  // Filter previous active valid external transactions for this WBS
  const previousExternalTx = previousTxList.filter(filterTx);

  // Internal reclass, correction, and other non-PO totals for current month specifically
  const currentInternalReclass = currentTxList
    .filter(
      (t) =>
        t.normalizedWbs === wbs &&
        t.classification === 'INTERNAL_RECLASS' &&
        !t.isExcluded &&
        getTransactionMonth(t) === reportingMonth
    )
    .reduce((sum, t) => sum + t.valueObjectCurr, 0);

  const currentCorrection = currentTxList
    .filter(
      (t) =>
        t.normalizedWbs === wbs &&
        t.classification === 'CORRECTION_TRANSFER' &&
        !t.isExcluded &&
        getTransactionMonth(t) === reportingMonth
    )
    .reduce((sum, t) => sum + t.valueObjectCurr, 0);

  const currentOtherNonPo = currentTxList
    .filter(
      (t) =>
        t.normalizedWbs === wbs &&
        t.classification === 'OTHER_NON_PO' &&
        !t.isExcluded &&
        getTransactionMonth(t) === reportingMonth
    )
    .reduce((sum, t) => sum + t.valueObjectCurr, 0);

  // Map uppercase key to canonical display name
  const vendorCanonicalMap = new Map<string, string>();

  [...currentExternalTx, ...previousExternalTx].forEach((t) => {
    const raw = (t.normalizedVendor || '').trim();
    if (!raw) return;
    const key = raw.toUpperCase();
    if (!vendorCanonicalMap.has(key)) {
      vendorCanonicalMap.set(key, raw);
    } else {
      // Prefer Title Case / mixed case over all-lowercase if available
      const existing = vendorCanonicalMap.get(key)!;
      if (existing === existing.toLowerCase() && raw !== raw.toLowerCase()) {
        vendorCanonicalMap.set(key, raw);
      }
    }
  });

  const vendorDeltas: VendorMonthlyDelta[] = [];

  let totalPrevBalance = 0;
  let totalCurrBalance = 0;

  for (const [key, vendorDisplay] of vendorCanonicalMap.entries()) {
    const prevTx = previousExternalTx.filter((t) => (t.normalizedVendor || '').toUpperCase() === key);
    const currTx = currentExternalTx.filter((t) => (t.normalizedVendor || '').toUpperCase() === key);

    const prevBal = prevTx.reduce((sum, t) => sum + t.valueObjectCurr, 0);
    const currBal = currTx.reduce((sum, t) => sum + t.valueObjectCurr, 0);
    const addThisMonth = currBal - prevBal;

    totalPrevBalance += prevBal;
    totalCurrBalance += currBal;

    // Status assignment
    let status: VendorMonthlyDelta['status'] = 'To enter';
    if (Math.abs(addThisMonth) < 0.001) {
      status = 'No action';
    } else if (monthClose && monthClose.status === 'Processed') {
      status = 'Processed';
    } else if (addThisMonth < 0) {
      status = 'Review';
      warnings.push({
        id: `warn-neg-${wbs}-${vendorDisplay}-${reportingMonth}`,
        snapshotId: '',
        wbs,
        vendor: vendorDisplay,
        severity: 'warning',
        type: 'NEGATIVE_ADDITION',
        message: `WBS ${wbs} / Vendor ${vendorDisplay}: Negative monthly addition (EUR ${addThisMonth.toFixed(2)}). Reversal or credit note.`,
      });
    }

    // Check if new vendor
    if (prevBal === 0 && currBal > 0) {
      warnings.push({
        id: `warn-newvend-${wbs}-${vendorDisplay}`,
        snapshotId: '',
        wbs,
        vendor: vendorDisplay,
        severity: 'info',
        type: 'NEW_VENDOR',
        message: `WBS ${wbs}: New vendor "${vendorDisplay}" appeared in reporting month ${reportingMonth}.`,
      });
    }

    // Extract document dates for previous transactions
    const prevDateObjs: Date[] = [];
    prevTx.forEach((t) => {
      const rawDate = t.docDate || t.postingDate;
      if (rawDate) {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          prevDateObjs.push(d);
        }
      }
    });

    let prevStartDateStr: string | undefined;
    let prevEndDateStr: string | undefined;

    const formatD = (d: Date) => {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    if (prevDateObjs.length > 0) {
      prevDateObjs.sort((a, b) => a.getTime() - b.getTime());
      prevStartDateStr = formatD(prevDateObjs[0]);
      prevEndDateStr = formatD(prevDateObjs[prevDateObjs.length - 1]);
    }

    // Extract document dates for this vendor in current reporting month or active current transactions
    const monthTx = currTx.filter((t) => getTransactionMonth(t) === reportingMonth);
    const activeCurrTx = monthTx.length > 0 ? monthTx : currTx;
    const currDateObjs: Date[] = [];
    activeCurrTx.forEach((t) => {
      const rawDate = t.docDate || t.postingDate;
      if (rawDate) {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          currDateObjs.push(d);
        }
      }
    });

    let startDateStr: string | undefined;
    let endDateStr: string | undefined;

    if (currDateObjs.length > 0) {
      currDateObjs.sort((a, b) => a.getTime() - b.getTime());
      startDateStr = formatD(currDateObjs[0]);
      endDateStr = formatD(currDateObjs[currDateObjs.length - 1]);
    }

    // Show in vendor table if non-zero change or active
    vendorDeltas.push({
      vendor: vendorDisplay,
      previousBalance: prevBal,
      addThisMonth,
      newBalance: currBal,
      status,
      transactionCount: currTx.length,
      prevStartDate: prevStartDateStr,
      prevEndDate: prevEndDateStr,
      startDate: startDateStr,
      endDate: endDateStr,
    });
  }

  const totalAddThisMonth = totalCurrBalance - totalPrevBalance;

  // Check if new WBS
  if (previousExternalTx.length === 0 && currentExternalTx.length > 0) {
    warnings.push({
      id: `warn-newwbs-${wbs}`,
      snapshotId: '',
      wbs,
      severity: 'info',
      type: 'NEW_WBS',
      message: `New WBS "${wbs}" appeared for the first time in ${reportingMonth}.`,
    });
  }

  // Budget warning
  const budget = project?.budgetEUR;
  let remainingBudget: number | undefined;
  if (budget !== undefined && budget > 0) {
    remainingBudget = budget - totalCurrBalance;
    if (totalCurrBalance > budget) {
      warnings.push({
        id: `warn-budget-${wbs}`,
        snapshotId: '',
        wbs,
        severity: 'error',
        type: 'BUDGET_EXCEEDED',
        message: `WBS ${wbs}: Cumulative spend (EUR ${totalCurrBalance.toFixed(2)}) exceeds configured budget (EUR ${budget.toFixed(2)}).`,
      });
    }
  }

  // Processed amount changed warning
  if (monthClose && monthClose.status === 'Processed') {
    if (Math.abs(monthClose.amountConfirmed - totalCurrBalance) > 0.01) {
      warnings.push({
        id: `warn-proc-change-${wbs}`,
        snapshotId: '',
        wbs,
        severity: 'error',
        type: 'PROCESSED_AMOUNT_CHANGED',
        message: `WBS ${wbs}: Previously processed month total was EUR ${monthClose.amountConfirmed.toFixed(2)}, but current snapshot total is EUR ${totalCurrBalance.toFixed(2)}.`,
      });
    }
  }

  // Get latest posting date
  const allDates = currentExternalTx.map((t) => t.postingDate || t.docDate).filter(Boolean);
  allDates.sort();
  const latestPostingDate = allDates.length > 0 ? allDates[allDates.length - 1] : undefined;

  const summary: WBSMonthlySummary = {
    wbs,
    projectName: project?.name || `${projectType} Project ${wbs}`,
    projectType,
    sourceWbs,
    cutoffDate: isOpex ? cutoffDate : undefined,
    trackerActual: undefined,
    variance: undefined,
    reportingMonth,
    assignedPmId: project?.assignedPmId,
    assignedPmName: project?.assignedPmName,
    previousBalance: totalPrevBalance,
    addThisMonth: totalAddThisMonth,
    newBalance: totalCurrBalance,
    internalReclassTotal: currentInternalReclass,
    otherReviewTotal: currentOtherNonPo,
    correctionTotal: currentCorrection,
    budgetEUR: budget,
    remainingBudgetEUR: remainingBudget,
    latestPostingDate,
    processingStatus: monthClose?.status || 'Ready to enter',
    planiswareRef: monthClose?.planiswareRef,
    comment: monthClose?.comment,
    processedBy: monthClose?.confirmedBy,
    processedAt: monthClose?.confirmedAt,
    warningsCount: warnings.length,
    vendorDeltas,
  };

  return { summary, warnings };
}
