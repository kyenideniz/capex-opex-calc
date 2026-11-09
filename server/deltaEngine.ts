import {
  ImportedTransaction,
  MonthCloseConfirmation,
  Project,
  ProjectType,
  ReviewWarning,
  VendorMonthlyDelta,
  WBSMonthlySummary,
} from '../src/types.js';
import { includeManualCapex, isInternalHoursOrCost, normalizeNamePattern } from './parser.js';
import { resolveProjectName } from '../src/utils/wbsMap.js';
import { getCarouselOrderIndex, getLinkedWbsCodes } from './planiswareSource.js';

export function getTransactionMonth(t: ImportedTransaction): string {
  if (t.refFiscalYear && t.fromPeriod) {
    const yr = String(t.refFiscalYear).trim();
    const p = String(t.fromPeriod).trim().padStart(2, '0');
    if (yr.length === 4 && !isNaN(Number(p))) {
      return `${yr}-${p}`;
    }
  }
  if (t.postingDate || t.docDate) {
    const raw = String(t.postingDate || t.docDate).trim();
    const num = Number(raw);
    if (!isNaN(num) && num > 30000 && num < 60000) {
      const utc_days = Math.floor(num - 25569);
      const d = new Date(utc_days * 86400 * 1000);
      const yr = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      return `${yr}-${m}`;
    }
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      const yr = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      return `${yr}-${m}`;
    }
  }
  return '2026-10';
}

export function calculateWBSMonthlySummary(
  wbs: string,
  reportingMonth: string,
  currentTxList: ImportedTransaction[],
  previousTxList: ImportedTransaction[],
  project?: Project,
  monthClose?: MonthCloseConfirmation,
  baselineTxList?: ImportedTransaction[]
): { summary: WBSMonthlySummary; warnings: ReviewWarning[] } {

  const warnings: ReviewWarning[] = [];

  const isOpex = wbs.startsWith('C') || wbs.startsWith('C7941/') || project?.projectType === 'OPEX';
  const projectType: ProjectType = isOpex ? 'OPEX' : 'CAPEX';
  const sourceWbs = isOpex ? (wbs.endsWith('/2/2') ? wbs : `${wbs}/2/2`) : wbs;

  // Retrieve all linked WBS codes (both Capex and Opex counterparts from Planisware export)
  const candidateCodes = getLinkedWbsCodes(wbs);

  // Transaction filter predicate: strictly enforce external vendor costs only
  const filterTx = (t: ImportedTransaction) => {
    if (t.isExcluded || t.userOverride?.isExcluded) return false;

    // Check subtotal rows
    if (t.isSubtotal) return false;

    // Match this project, its sub-WBS elements, or any of its paired Capex/Opex codes
    const matchesWbs =
      candidateCodes.some((code) => {
        return (
          t.normalizedWbs === code ||
          t.normalizedWbs?.startsWith(code + '/') ||
          t.wbs === code ||
          t.wbs?.startsWith(code + '/')
        );
      }) ||
      t.normalizedWbs === wbs ||
      t.normalizedWbs?.startsWith(wbs + '/') ||
      (sourceWbs && (t.normalizedWbs === sourceWbs || t.normalizedWbs?.startsWith(sourceWbs + '/'))) ||
      t.wbs === wbs ||
      t.wbs?.startsWith(wbs + '/');
    if (!matchesWbs) return false;

    const activeClass = t.userOverride?.classification || t.classification;
    if (activeClass === 'CORRECTION_TRANSFER' || activeClass === 'INTERNAL_RECLASS') {
      return false;
    }

    // Strictly exclude internal labor, internal hours, IT Business Solutions, and mandays
    if (isInternalHoursOrCost(t)) {
      return false;
    }

    const rawName = String(t.nameDescription || '');
    const normName = normalizeNamePattern(rawName).toLowerCase();

    // Exclude pure cross-reclassification transfer lines
    if (normName.includes('opex to capex') || normName.includes('reclass: wbs correction')) {
      return false;
    }

    const hasDate = Boolean((t.docDate || '').trim() || (t.postingDate || '').trim());
    const hasPo = Boolean((t.purchasingDoc || '').trim());

    // External cost must have a valid date or purchasing doc, or have explicit EXTERNAL_VENDOR classification
    if (!hasDate && !hasPo && activeClass !== 'EXTERNAL_VENDOR') {
      return false;
    }

    return true;
  };

  // Filter current active valid external transactions for this WBS
  const currentExternalTx = currentTxList.filter(filterTx);

  // Filter previous active valid external transactions for this WBS
  const previousExternalTx = previousTxList.filter(filterTx);

  // Filter baseline external transactions from old source for comparison
  const baselineExternalTx = baselineTxList ? baselineTxList.filter(filterTx) : [];

  const isTargetTx = (t: ImportedTransaction) => {
    return (
      candidateCodes.some(
        (c) =>
          t.normalizedWbs === c ||
          t.normalizedWbs?.startsWith(c + '/') ||
          t.wbs === c ||
          t.wbs?.startsWith(c + '/')
      ) ||
      t.normalizedWbs === wbs ||
      t.wbs === wbs
    );
  };

  // Internal reclass, correction, and other non-PO totals for current month specifically
  const currentInternalReclass = currentTxList
    .filter(
      (t) =>
        isTargetTx(t) &&
        t.classification === 'INTERNAL_RECLASS' &&
        !t.isExcluded &&
        getTransactionMonth(t) === reportingMonth
    )
    .reduce((sum, t) => sum + t.valueObjectCurr, 0);

  const currentCorrection = currentTxList
    .filter(
      (t) =>
        isTargetTx(t) &&
        t.classification === 'CORRECTION_TRANSFER' &&
        !t.isExcluded &&
        getTransactionMonth(t) === reportingMonth
    )
    .reduce((sum, t) => sum + t.valueObjectCurr, 0);

  const currentOtherNonPo = currentTxList
    .filter(
      (t) =>
        isTargetTx(t) &&
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

    // Check retrospective correction against old baseline source (pre-Sept entries)
    let hasCorrection = false;
    let correctionDiff: number | undefined;
    let oldBalance: number | undefined;

    if (baselineExternalTx.length > 0) {
      const baseVendorTx = baselineExternalTx.filter((t) => (t.normalizedVendor || '').toUpperCase() === key);
      const baseBal = baseVendorTx.reduce((sum, t) => sum + t.valueObjectCurr, 0);
      if (baseBal !== 0 && Math.abs(prevBal - baseBal) > 0.01) {
        hasCorrection = true;
        correctionDiff = prevBal - baseBal;
        oldBalance = baseBal;
        warnings.push({
          id: `warn-corr-${wbs}-${vendorDisplay}`,
          snapshotId: '',
          wbs,
          vendor: vendorDisplay,
          severity: 'warning',
          type: 'PAST_CORRECTION',
          message: `WBS ${wbs} / Vendor ${vendorDisplay}: Retrospective correction detected in past entries (baseline EUR ${oldBalance.toFixed(2)}, current past balance EUR ${prevBal.toFixed(2)}, diff EUR ${correctionDiff.toFixed(2)}).`,
        });
      }
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
      hasCorrection,
      correctionDiff,
      oldBalance,
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

  const hasPastCorrection = vendorDeltas.some((v) => v.hasCorrection);

  const hasSeptOctActivity = currentExternalTx.some((t) => {
    const m = getTransactionMonth(t);
    return m === '2026-09' || m === '2026-10';
  });

  let hasDifferenceFromOldSource = false;
  const hasSpendOrCorrection = Math.abs(totalCurrBalance) > 0.01 || Math.abs(totalPrevBalance) > 0.01 || hasPastCorrection;

  if (hasSpendOrCorrection) {
    if (baselineTxList && baselineTxList.length > 0) {
      const baseTotal = baselineExternalTx.reduce((sum, t) => sum + t.valueObjectCurr, 0);
      const diffFromOld = Math.abs(totalCurrBalance - baseTotal) > 0.01 || currentExternalTx.length !== baselineExternalTx.length;
      const hasMonthlySpend = Math.abs(totalAddThisMonth) > 0.01;
      hasDifferenceFromOldSource =
        diffFromOld ||
        hasMonthlySpend ||
        hasPastCorrection ||
        hasSeptOctActivity ||
        (baselineExternalTx.length === 0 && currentExternalTx.length > 0);
    } else {
      hasDifferenceFromOldSource = Math.abs(totalAddThisMonth) > 0.01 || hasSeptOctActivity;
    }
  }

  const carouselOrderIndex = getCarouselOrderIndex(wbs);

  const summary: WBSMonthlySummary = {
    wbs,
    projectName: resolveProjectName(wbs, project?.name || `${projectType} Project ${wbs}`),
    projectType,
    sourceWbs,
    cutoffDate: undefined,
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
    hasDifferenceFromOldSource,
    hasPastCorrection,
    carouselOrderIndex,
  };

  return { summary, warnings };
}
