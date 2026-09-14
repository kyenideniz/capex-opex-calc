import {
  ImportedTransaction,
  MonthCloseConfirmation,
  Project,
  ReviewWarning,
  VendorMonthlyDelta,
  WBSMonthlySummary,
} from '../src/types.js';

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

  // Filter current active valid external transactions for this WBS
  const currentExternalTx = currentTxList.filter(
    (t) =>
      t.normalizedWbs === wbs &&
      t.classification === 'EXTERNAL_VENDOR' &&
      !t.isExcluded &&
      !(t.userOverride?.isExcluded)
  );

  // Filter previous active valid external transactions for this WBS
  const previousExternalTx = previousTxList.filter(
    (t) =>
      t.normalizedWbs === wbs &&
      t.classification === 'EXTERNAL_VENDOR' &&
      !t.isExcluded &&
      !(t.userOverride?.isExcluded)
  );

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

  // Get set of all vendors across previous and current for this WBS
  const vendorSet = new Set<string>();
  currentExternalTx.forEach((t) => vendorSet.add(t.normalizedVendor));
  previousExternalTx.forEach((t) => vendorSet.add(t.normalizedVendor));

  const vendorDeltas: VendorMonthlyDelta[] = [];

  let totalPrevBalance = 0;
  let totalCurrBalance = 0;

  for (const vendor of vendorSet) {
    const prevTx = previousExternalTx.filter((t) => t.normalizedVendor === vendor);
    const currTx = currentExternalTx.filter((t) => t.normalizedVendor === vendor);

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
        id: `warn-neg-${wbs}-${vendor}-${reportingMonth}`,
        snapshotId: '',
        wbs,
        vendor,
        severity: 'warning',
        type: 'NEGATIVE_ADDITION',
        message: `WBS ${wbs} / Vendor ${vendor}: Negative monthly addition (EUR ${addThisMonth.toFixed(2)}). Reversal or credit note.`,
      });
    }

    // Check if new vendor
    if (prevBal === 0 && currBal > 0) {
      warnings.push({
        id: `warn-newvend-${wbs}-${vendor}`,
        snapshotId: '',
        wbs,
        vendor,
        severity: 'info',
        type: 'NEW_VENDOR',
        message: `WBS ${wbs}: New vendor "${vendor}" appeared in reporting month ${reportingMonth}.`,
      });
    }

    // Show in vendor table if non-zero change or active
    vendorDeltas.push({
      vendor,
      previousBalance: prevBal,
      addThisMonth,
      newBalance: currBal,
      status,
      transactionCount: currTx.length,
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
    projectName: project?.name || `Project ${wbs}`,
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
