import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  ChevronDown,
  ArrowUp,
  Check,
  ClipboardCheck,
  CheckCircle2,
  Copy,
  Info
} from 'lucide-react';
import { WBSMonthlySummary } from '../types';
import { resolveProjectName } from '../utils/wbsMap';

// Exact Open-In-Window / External Link icon matching SAP & Planisware modal style
function OpenInWindowIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor">
      <path d="M12.5 1.5H8.75a.75.75 0 0 0 0 1.5h2.19L6.22 7.72a.75.75 0 1 0 1.06 1.06L12 4.06v2.19a.75.75 0 0 0 1.5 0V2.5a1 1 0 0 0-1-1z" />
      <path d="M13 8.75a.75.75 0 0 0-1.5 0v4.25a.5.5 0 0 1-.5.5H3a.5.5 0 0 1-.5-.5V5a.5.5 0 0 1 .5-.5h4.25a.75.75 0 0 0 0-1.5H3A2 2 0 0 0 1 5v8a2 2 0 0 0 2-2V8.75z" />
    </svg>
  );
}

// 6 Toolbar Action Icons matching user's exact specification
function CopyIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function PasteIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  );
}

function EditBoxIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function CancelCircleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

function IndentIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="21" y1="6" x2="3" y2="6" />
      <line x1="21" y1="12" x2="9" y2="12" />
      <line x1="21" y1="18" x2="3" y2="18" />
      <polyline points="7 9 4 12 7 15" />
    </svg>
  );
}

function PencilToolIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

/**
 * Format numbers according to Planisware UI standards (space as thousands separator)
 * e.g., 133725.00 -> "133 725.00"
 */
function formatPlaniswareQty(num: number): string {
  if (isNaN(num)) return '0.00';
  const isNegative = num < 0;
  const absNum = Math.abs(num);
  const parts = absNum.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${isNegative ? '-' : ''}${parts[0]}.${parts[1]}`;
}

/**
 * Get readable month name e.g. "August 2026" from "2026-08"
 */
function getReportingMonthTitle(reportingMonth: string): string {
  const parts = reportingMonth.split('-');
  const year = parseInt(parts[0], 10) || 2026;
  const monthNum = parseInt(parts[1], 10) || 8;
  const monthName = new Date(year, monthNum - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
  return monthName;
}

/**
 * Helper to compute default previous period dates
 */
function getPreviousPeriodDates(reportingMonth: string) {
  const parts = reportingMonth.split('-');
  const year = parseInt(parts[0], 10) || 2026;
  const monthNum = parseInt(parts[1], 10) || 8;

  let prevYear = year;
  let prevMonthNum = monthNum - 1;
  if (prevMonthNum < 1) {
    prevMonthNum = 12;
    prevYear -= 1;
  }
  const prevLastDay = new Date(prevYear, prevMonthNum, 0).getDate();
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

  const prevStartDate = `01/01/${year}`;
  const prevEndDate = `${pad(prevLastDay)}/${pad(prevMonthNum)}/${prevYear}`;

  return { prevStartDate, prevEndDate };
}

export interface PlaniswareRow {
  id: string | number;
  quantity: string;
  unit: string;
  sapWbsElement: string;
  label: string;
  type: string;
  startDate: string;
  endDate: string;
  isUpdate?: boolean;
}

interface PlaniswareViewProps {
  summary: WBSMonthlySummary;
  reportingMonth: string;
  onViewCalculationDetails?: () => void;
}

// Columns strictly configured to: Quantity, Unit, SAP WBS Element, Label, Type, Start date, End date
const COLUMNS_BY_TAB = {
  Actual: [
    { key: 'quantity', label: 'Quantity', width: '15%' },
    { key: 'unit', label: 'Unit', width: '5%' },
    { key: 'sapWbsElement', label: 'SAP WBS Element', width: '18%' },
    { key: 'label', label: 'Label', width: '26%' },
    { key: 'type', label: 'Type', width: '10%' },
    { key: 'startDate', label: 'Start date', width: '13%', sortDir: 'up' },
    { key: 'endDate', label: 'End date', width: '13%' },
  ],
  Planned: [],
  Budget: [],
};

export const PlaniswareView: React.FC<PlaniswareViewProps> = ({
  summary,
  reportingMonth,
  onViewCalculationDetails,
}) => {
  const [activeTab] = useState<'Actual' | 'Planned' | 'Budget'>('Actual');

  const isOpex = summary.projectType === 'OPEX' || summary.wbs.startsWith('C') || summary.wbs.startsWith('C7941/');

  // Shared Identification Fields
  const [taskWbs, setTaskWbs] = useState(`${summary.wbs} - ${resolveProjectName(summary.wbs, summary.projectName)}`);
  const [costAccount, setCostAccount] = useState(
    isOpex
      ? 'OPEX-OPEX-External consultants/contractors'
      : 'CAPEX-CAPEX-External consultants/contractors'
  );
  const [resource, setResource] = useState('');

  // Keep form fields synced with selected WBS
  useEffect(() => {
    const opex = summary.projectType === 'OPEX' || summary.wbs.startsWith('C') || summary.wbs.startsWith('C7941/');
    setTaskWbs(`${summary.wbs} - ${resolveProjectName(summary.wbs, summary.projectName)}`);
    setCostAccount(
      opex
        ? 'OPEX-OPEX-External consultants/contractors'
        : 'CAPEX-CAPEX-External consultants/contractors'
    );
    setResource('');
  }, [summary.wbs, summary.projectName, summary.projectType]);

  // Active Tab rows & columns
  const currentColumns = COLUMNS_BY_TAB.Actual;

  // Build the rows matching user's exact specification:
  // Top entries: previous cumulative sum per vendor
  // Bottom entries: this month's update sum per vendor with document dates
  const [currentRows, setCurrentRows] = useState<PlaniswareRow[]>([]);

  useEffect(() => {
    const { prevStartDate, prevEndDate } = getPreviousPeriodDates(reportingMonth);
    const rows: PlaniswareRow[] = [];

    // Filter active vendors
    const activeVendors = summary.vendorDeltas.filter(
      (v) => Math.abs(v.previousBalance) > 0.001 || Math.abs(v.addThisMonth) > 0.001 || Math.abs(v.newBalance) > 0.001
    );

    // 1. TOP ENTRIES: Cumulative totals for previous month(s) per vendor (READ ONLY)
    activeVendors.forEach((v, idx) => {
      const startDate = v.prevStartDate || v.startDate || prevStartDate;
      const endDate = v.prevEndDate || v.endDate || prevEndDate;

      rows.push({
        id: `prev-${idx}-${v.vendor}`,
        quantity: formatPlaniswareQty(v.previousBalance),
        unit: '€',
        sapWbsElement: '',
        label: v.vendor,
        type: 'Standard',
        startDate: startDate,
        endDate: endDate,
        isUpdate: false,
      });
    });

    // 2. THIS MONTH'S UPDATE ENTRIES: Net additions for reporting month
    const updateVendors = activeVendors.filter((v) => Math.abs(v.addThisMonth) > 0.001);

    updateVendors.forEach((v, idx) => {
      // Use document dates from transactions if available
      const startDate = v.startDate || prevEndDate;
      const endDate = v.endDate || v.startDate || prevEndDate;

      rows.push({
        id: `update-${idx}-${v.vendor}`,
        quantity: formatPlaniswareQty(v.addThisMonth),
        unit: '€',
        sapWbsElement: '',
        label: v.vendor,
        type: 'Standard',
        startDate: startDate,
        endDate: endDate,
        isUpdate: true,
      });
    });

    // Fallback if no vendors exist at all
    if (rows.length === 0) {
      rows.push({
        id: 'default-row',
        quantity: '0.00',
        unit: '€',
        sapWbsElement: '',
        label: summary.wbs,
        type: 'Standard',
        startDate: prevStartDate,
        endDate: prevEndDate,
        isUpdate: false,
      });
    }

    setCurrentRows(rows);
  }, [summary, reportingMonth]);

  // Table selection state
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string | number>>(new Set());
  const [activeCell, setActiveCell] = useState<{ rowIdx: number; colIdx: number } | null>(null);
  const [selectionRange, setSelectionRange] = useState<{
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Clipboard & UI feedback
  const [lastCopiedString, setLastCopiedString] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  const navItems = [
    { name: 'Definition', disabled: true },
    { name: 'Planned', disabled: true },
    { name: 'Actual', disabled: false },
    { name: 'Budget', disabled: true },
  ];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2400);
  };

  const fallbackCopyText = (text: string) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '-9999px';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      return false;
    }
  };

  // COPY PASTE LOGIC: Strictly restricted to This Month's Update Rows
  const copySelectionToClipboard = useCallback(async () => {
    if (currentRows.length === 0) return;

    const sanitizeVal = (val: any) => {
      if (val === null || val === undefined) return '';
      return String(val).replace(/[\t\r\n]/g, ' ');
    };

    // Filter to ONLY this month's update rows so previous subtotals are never copied
    const updateRowsOnly = currentRows.filter((r) => r.isUpdate);
    const candidateRows = updateRowsOnly.length > 0 ? updateRowsOnly : currentRows.slice(-1);

    let tsvOutput = '';
    let htmlOutput = '<table>';

    if (selectedRowIds.size > 0) {
      const selectedRowsList = candidateRows.filter((r) => selectedRowIds.has(r.id));
      const targetRows = selectedRowsList.length > 0 ? selectedRowsList : candidateRows;
      const rowLines = targetRows.map((r) => {
        const values = currentColumns.map((col) => sanitizeVal((r as any)[col.key]));
        htmlOutput += `<tr>${values.map((v) => `<td>${v}</td>`).join('')}</tr>`;
        return values.join('\t');
      });
      tsvOutput = rowLines.join('\r\n');
    } else if (selectionRange) {
      const minR = Math.max(0, Math.min(selectionRange.startRow, selectionRange.endRow));
      const maxR = Math.min(currentRows.length - 1, Math.max(selectionRange.startRow, selectionRange.endRow));
      const minC = Math.max(0, Math.min(selectionRange.startCol, selectionRange.endCol));
      const maxC = Math.min(currentColumns.length - 1, Math.max(selectionRange.startCol, selectionRange.endCol));

      const lines = [];
      for (let r = minR; r <= maxR; r++) {
        const rowData = currentRows[r];
        if (!rowData || !rowData.isUpdate) continue; // Skip non-update rows
        const cellVals = [];
        htmlOutput += '<tr>';
        for (let c = minC; c <= maxC; c++) {
          const colKey = currentColumns[c].key;
          const val = sanitizeVal((rowData as any)[colKey]);
          cellVals.push(val);
          htmlOutput += `<td>${val}</td>`;
        }
        htmlOutput += '</tr>';
        lines.push(cellVals.join('\t'));
      }
      tsvOutput = lines.join('\r\n');
      if (!tsvOutput) {
        // Fallback to all candidate update rows if selection contained no update rows
        const rowLines = candidateRows.map((r) => {
          const values = currentColumns.map((col) => sanitizeVal((r as any)[col.key]));
          return values.join('\t');
        });
        tsvOutput = rowLines.join('\r\n');
      }
    } else {
      const rowLines = candidateRows.map((r) => {
        const values = currentColumns.map((col) => sanitizeVal((r as any)[col.key]));
        htmlOutput += `<tr>${values.map((v) => `<td>${v}</td>`).join('')}</tr>`;
        return values.join('\t');
      });
      tsvOutput = rowLines.join('\r\n');
    }
    htmlOutput += '</table>';

    setLastCopiedString(tsvOutput);

    let copiedSuccessfully = false;

    if (navigator.clipboard && (window as any).ClipboardItem && navigator.clipboard.write) {
      try {
        const blobText = new Blob([tsvOutput], { type: 'text/plain' });
        const blobHtml = new Blob([htmlOutput], { type: 'text/html' });
        await navigator.clipboard.write([
          new (window as any).ClipboardItem({
            'text/plain': blobText,
            'text/html': blobHtml,
          }),
        ]);
        copiedSuccessfully = true;
      } catch (err) {}
    }

    if (!copiedSuccessfully && navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(tsvOutput);
        copiedSuccessfully = true;
      } catch (err) {}
    }

    if (!copiedSuccessfully) {
      copiedSuccessfully = fallbackCopyText(tsvOutput);
    }

    if (copiedSuccessfully) {
      showToast(`Copied update values to clipboard (Planisware format)`);
    } else {
      setShowCopyModal(true);
    }
  }, [activeTab, currentRows, currentColumns, selectedRowIds, selectionRange]);

  // EXACT PASTE DATA LOGIC FROM USER'S CODE
  const handlePasteData = useCallback(
    (textData: string) => {
      if (!textData) return;
      const lines = textData.trim().split(/\r?\n/).filter((line) => line.length > 0);
      const isTabular = lines.some((l) => l.includes('\t'));

      if (isTabular) {
        const newRows: PlaniswareRow[] = lines.map((line, idx) => {
          const parts = line.split('\t');
          const rowObj: any = { id: Date.now() + idx, isUpdate: true };
          currentColumns.forEach((col, cIdx) => {
            rowObj[col.key] = parts[cIdx] || '';
          });
          return rowObj;
        });

        setCurrentRows((prev) => [...prev, ...newRows]);
        setSelectedRowIds(new Set());
        setActiveCell({ rowIdx: 0, colIdx: 0 });
        setSelectionRange({
          startRow: 0,
          startCol: 0,
          endRow: 0,
          endCol: currentColumns.length - 1,
        });
        showToast(`Pasted ${newRows.length} record(s) into ${activeTab}`);
      } else {
        showToast('Pasted content is not valid Planisware TSV data');
      }
    },
    [activeTab, currentColumns]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === 'input' && (e.target as HTMLInputElement).type === 'text') return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        copySelectionToClipboard();
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v') {
        try {
          if (navigator.clipboard && navigator.clipboard.readText) {
            navigator.clipboard
              .readText()
              .then((text) => handlePasteData(text))
              .catch(() => {});
          }
        } catch (err) {}
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
        const updateRows = currentRows.filter((r) => r.isUpdate);
        if (updateRows.length > 0) {
          e.preventDefault();
          const updateIds = new Set(updateRows.map((r) => r.id));
          setSelectedRowIds(updateIds);
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [copySelectionToClipboard, handlePasteData, currentRows, currentColumns]);

  const handleCellMouseDown = (rIdx: number, cIdx: number, e: React.MouseEvent) => {
    const row = currentRows[rIdx];
    // Prevent interaction with previous months' subtotal rows
    if (!row || !row.isUpdate) return;
    if (e.button !== 0) return;
    e.preventDefault();

    setIsDragging(true);
    setActiveCell({ rowIdx: rIdx, colIdx: cIdx });
    setSelectedRowIds(new Set());

    if (e.shiftKey && selectionRange) {
      setSelectionRange((prev) => ({
        ...prev!,
        endRow: rIdx,
        endCol: cIdx,
      }));
    } else {
      setSelectionRange({
        startRow: rIdx,
        startCol: cIdx,
        endRow: rIdx,
        endCol: cIdx,
      });
    }
  };

  const handleCellMouseEnter = (rIdx: number, cIdx: number) => {
    if (!isDragging) return;
    const row = currentRows[rIdx];
    if (!row || !row.isUpdate) return;
    setSelectionRange((prev) => ({
      startRow: prev ? prev.startRow : rIdx,
      startCol: prev ? prev.startCol : cIdx,
      endRow: rIdx,
      endCol: cIdx,
    }));
  };

  const handleRowCheckboxToggle = (rowId: string | number, rIdx: number) => {
    const row = currentRows[rIdx];
    if (!row || !row.isUpdate) return; // Prevent toggling previous subtotal rows

    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
        setSelectionRange(null);
        setActiveCell(null);
      } else {
        next.add(rowId);
        setActiveCell({ rowIdx: rIdx, colIdx: 0 });
        setSelectionRange({
          startRow: rIdx,
          startCol: 0,
          endRow: rIdx,
          endCol: currentColumns.length - 1,
        });
      }
      return next;
    });
  };

  const handleSelectAllHeader = () => {
    const updateRows = currentRows.filter((r) => r.isUpdate);
    if (updateRows.length === 0) return;

    if (selectedRowIds.size === updateRows.length) {
      setSelectedRowIds(new Set());
      setSelectionRange(null);
      setActiveCell(null);
    } else {
      const updateIds = new Set(updateRows.map((r) => r.id));
      setSelectedRowIds(updateIds);
    }
  };

  const getCellMeta = (rIdx: number, cIdx: number) => {
    const row = currentRows[rIdx];
    if (!row || !row.isUpdate) {
      return { isSelected: false, isAnchor: false };
    }

    const isRowChecked = selectedRowIds.has(row.id);
    const isAnchor = activeCell?.rowIdx === rIdx && activeCell?.colIdx === cIdx;

    if (isRowChecked) {
      return {
        isSelected: true,
        isAnchor,
        isTop: true,
        isBottom: true,
        isLeft: cIdx === 0,
        isRight: cIdx === currentColumns.length - 1,
        showHandle: isAnchor,
      };
    }

    if (!selectionRange) {
      return { isSelected: false, isAnchor: false };
    }

    const minR = Math.min(selectionRange.startRow, selectionRange.endRow);
    const maxR = Math.max(selectionRange.startRow, selectionRange.endRow);
    const minC = Math.min(selectionRange.startCol, selectionRange.endCol);
    const maxC = Math.max(selectionRange.startCol, selectionRange.endCol);

    const isSelected = rIdx >= minR && rIdx <= maxR && cIdx >= minC && cIdx <= maxC;
    if (!isSelected) {
      return { isSelected: false, isAnchor: false };
    }

    const isTop = rIdx === minR;
    const isBottom = rIdx === maxR;
    const isLeft = cIdx === minC;
    const isRight = cIdx === maxC;
    const showHandle = isAnchor || (rIdx === maxR && cIdx === minC);

    return {
      isSelected: true,
      isAnchor,
      isTop,
      isBottom,
      isLeft,
      isRight,
      showHandle,
    };
  };

  const renderToolbar = () => (
    <div className="inline-flex items-center bg-[#DBE5F9] rounded-lg px-2.5 py-1.5 gap-3.5 border border-[#CCD8F2] text-[#92A1B6] cursor-not-allowed">
      <button
        type="button"
        onClick={copySelectionToClipboard}
        className="text-[#92A1B6] p-0.5 cursor-not-allowed"
        title="Copy selected values (Planisware TSV)"
      >
        <CopyIcon className="w-[17px] h-[17px]" />
      </button>

      <button
        type="button"
        onClick={() => {
          try {
            if (navigator.clipboard && navigator.clipboard.readText) {
              navigator.clipboard
                .readText()
                .then((text) => handlePasteData(text))
                .catch(() => {
                  showToast('Please press Cmd+V / Ctrl+V to paste');
                });
            } else {
              showToast('Please press Cmd+V / Ctrl+V to paste');
            }
          } catch (err) {
            showToast('Please press Cmd+V / Ctrl+V to paste');
          }
        }}
        className="text-[#92A1B6] p-0.5 cursor-not-allowed"
        title="Paste TSV values into table"
      >
        <PasteIcon className="w-[17px] h-[17px]" />
      </button>

      <button type="button" className="text-[#92A1B6] p-0.5 cursor-not-allowed" title="Edit row disabled">
        <EditBoxIcon className="w-[17px] h-[17px]" />
      </button>

      <button
        type="button"
        onClick={() => {
          setSelectedRowIds(new Set());
          setSelectionRange(null);
          setActiveCell(null);
          showToast('Selection cleared');
        }}
        className="text-[#92A1B6] p-0.5 cursor-not-allowed"
        title="Clear selection"
      >
        <CancelCircleIcon className="w-[17px] h-[17px]" />
      </button>

      <button type="button" className="text-[#92A1B6] p-0.5 cursor-not-allowed" title="Indent disabled">
        <IndentIcon className="w-[17px] h-[17px]" />
      </button>

      <button type="button" className="text-[#92A1B6] p-0.5 cursor-not-allowed" title="Format disabled">
        <PencilToolIcon className="w-[17px] h-[17px]" />
      </button>
    </div>
  );

  const monthTitle = getReportingMonthTitle(reportingMonth);
  const formattedUpdateTotal = `€${Math.abs(summary.addThisMonth).toLocaleString('de-DE', { minimumFractionDigits: 2 })}`;

  return (
    <div className="w-full flex flex-col items-center justify-center font-sans antialiased text-slate-800 select-none my-2">
      {/* Floating Status Notification */}
      {toastMessage && (
        <div className="fixed top-5 z-50 bg-[#2D313F] text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-2xl flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-top-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Dialog Window - Exact User Replicate */}
      <div
        className="w-full max-w-[1040px] bg-white rounded-2xl shadow-[0_25px_65px_-15px_rgba(0,0,0,0.35)] overflow-hidden border border-slate-200/90 flex flex-col relative"
        style={{ minHeight: '540px' }}
      >
        {/* Header Bar - Periwinkle Gradient */}
        <div className="h-[48px] bg-gradient-to-r from-[#627ED8] via-[#637ED9] to-[#607BD5] flex items-center justify-between px-5 text-white flex-shrink-0">
          <h1 className="text-[16px] font-medium tracking-tight flex items-center gap-2">
            <span>Hours and expenditures summary</span>
            <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-md font-semibold tracking-normal border border-white/20">
              ( Manually Maintained Costs Only )
            </span>
          </h1>
          <button
            type="button"
            className="text-white/80 transition-colors p-1 rounded hover:bg-white/10 cursor-not-allowed"
            title="Window close disabled"
          >
            <X className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>

        {/* Modal Body: Left Sidebar + Right Main Workspace */}
        <div className="flex flex-1 min-h-[490px]">
          {/* Left Navigation Sidebar */}
          <nav className="w-[168px] flex-shrink-0 pt-7 border-r border-[#627ED8]/30 flex flex-col">
            <ul className="space-y-0.5 text-[15px]">
              {navItems.map((item) => {
                return (
                  <li key={item.name}>
                    {item.disabled ? (
                      <div
                        title="Tab not available"
                        className="w-full text-left py-2.5 px-6 font-normal text-[#8A94A6] cursor-not-allowed select-none opacity-60 hover:bg-slate-100/50 flex items-center justify-between"
                      >
                        <span>{item.name}</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="w-full text-left py-2.5 px-6 transition-colors relative flex items-center cursor-default bg-[#EAEAF8] text-[#2D313F] font-medium"
                      >
                        <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-[#6366F1]" />
                        <span>{item.name}</span>
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Right Main Content Area */}
          <div className="flex-1 p-5 md:p-6 flex flex-col justify-between overflow-x-hidden">
            <div className="space-y-4">
              {/* Section: Identification */}
              <div>
                <h2 className="text-[15px] font-bold text-[#202733] mb-3">Identification</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-3 max-w-[800px]">
                  <div className="flex items-center justify-between gap-2 cursor-not-allowed" title="Field read-only">
                    <div className="flex items-center gap-1.5 text-[13.5px] text-[#252D3A] whitespace-nowrap cursor-not-allowed">
                      <span>Task or WBS element *</span>
                      <OpenInWindowIcon className="w-3.5 h-3.5 text-[#9CA3AF]" />
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-300 pb-0.5 w-[185px] bg-slate-50/60 rounded-t px-1 select-none cursor-not-allowed">
                      <input
                        type="text"
                        readOnly
                        disabled
                        tabIndex={-1}
                        value={taskWbs}
                        className="text-[13px] text-[#202733] bg-transparent focus:outline-none w-full truncate cursor-not-allowed select-none font-medium"
                      />
                      <ChevronDown className="w-4 h-4 text-slate-400 cursor-not-allowed flex-shrink-0" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 cursor-not-allowed" title="Field read-only">
                    <div className="flex items-center gap-1.5 text-[13.5px] text-[#252D3A] whitespace-nowrap cursor-not-allowed">
                      <span>Resource</span>
                      <OpenInWindowIcon className="w-3.5 h-3.5 text-[#9CA3AF]" />
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-300 pb-0.5 w-[185px] bg-slate-50/60 rounded-t px-1 select-none cursor-not-allowed">
                      <input
                        type="text"
                        value=""
                        placeholder=""
                        readOnly
                        disabled
                        tabIndex={-1}
                        className="text-[13px] text-[#202733] bg-transparent focus:outline-none w-full truncate cursor-not-allowed select-none"
                      />
                      <ChevronDown className="w-4 h-4 text-slate-400 cursor-not-allowed flex-shrink-0" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 cursor-not-allowed" title="Field read-only">
                    <div className="flex items-center gap-1.5 text-[13.5px] text-[#252D3A] whitespace-nowrap cursor-not-allowed">
                      <span>Cost account</span>
                      <OpenInWindowIcon className="w-3.5 h-3.5 text-[#9CA3AF]" />
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-300 pb-0.5 w-[185px] bg-slate-50/60 rounded-t px-1 select-none cursor-not-allowed">
                      <input
                        type="text"
                        readOnly
                        disabled
                        tabIndex={-1}
                        value={costAccount}
                        title={costAccount}
                        className="text-[13px] text-[#202733] truncate bg-transparent focus:outline-none w-full cursor-not-allowed select-none font-medium"
                      />
                      <ChevronDown className="w-4 h-4 text-slate-400 cursor-not-allowed flex-shrink-0" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Instruction Banner - Dynamic Green for zero updates / Indigo for active updates */}
              {Math.abs(summary.addThisMonth) > 0.001 ? (
                <div className="bg-[#EEF2FF] border border-[#C7D2FE] rounded-lg p-3 text-xs text-[#312E81] flex items-center justify-between gap-2 shadow-xs">
                  <div className="flex items-center space-x-2">
                    <Info className="w-4 h-4 text-[#4338CA] flex-shrink-0" />
                    <span>
                      Copy and paste all cells for this month in Planisware with the row that says{' '}
                      <strong className="font-bold text-[#1E1B4B]">{formattedUpdateTotal}</strong> for{' '}
                      <strong className="font-bold text-[#1E1B4B]">{monthTitle}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={copySelectionToClipboard}
                    className="bg-[#4338CA] hover:bg-[#3730A3] text-white text-[11px] font-bold px-3.5 py-1.5 rounded transition-colors flex-shrink-0 cursor-pointer shadow-xs"
                  >
                    Copy This Month Values
                  </button>
                </div>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200/90 rounded-lg p-3 text-xs text-emerald-900 flex items-center justify-between gap-2 shadow-xs">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>
                      No updates for the period of <strong className="font-bold text-emerald-950">{monthTitle}</strong>. Nothing to be added in Planisware.
                    </span>
                  </div>
                  <span className="bg-emerald-100/80 text-emerald-800 text-[11px] font-bold px-3 py-1 rounded border border-emerald-200/60 flex-shrink-0">
                    0.00 €
                  </span>
                </div>
              )}

              {/* Actual Tab Grid & Controls */}
              <div className="pt-1 space-y-2.5">
                {/* Crimson button & Toolbar */}
                <div className="space-y-2.5">
                  <div>
                    <button
                      type="button"
                      className="bg-[#E20054] text-white text-[13px] font-bold px-7 py-1.5 rounded-[4px] shadow-sm cursor-not-allowed"
                      title="Actual view active"
                    >
                      Actual *
                    </button>
                  </div>
                  <div>{renderToolbar()}</div>
                </div>

                {/* Table containing strictly: Quantity, Unit, SAP WBS Element, Label, Type, Start date, End date */}
                <div ref={tableRef} className="pt-1 select-none w-full">
                  <table className="w-full table-fixed text-left border-collapse text-[12px]">
                    {/* Table Headers */}
                    <thead>
                      <tr className="border-b border-[#E1E8F5] text-[#334155] bg-white">
                        <th className="py-2 px-1 w-8 text-center border-r border-[#DFE7F6]">
                          <button
                            type="button"
                            onClick={handleSelectAllHeader}
                            className={`w-4 h-4 rounded-[3px] border flex items-center justify-center transition-colors mx-auto cursor-pointer ${
                              selectedRowIds.size > 0 ? 'bg-[#D81B60] border-[#D81B60] text-white' : 'border-[#BAC7D5] bg-white'
                            }`}
                            title="Select all update rows"
                          >
                            {selectedRowIds.size > 0 && <Check className="w-3 h-3 stroke-[3]" />}
                          </button>
                        </th>

                        {currentColumns.map((col, idx) => {
                          const isLast = idx === currentColumns.length - 1;
                          return (
                            <th
                              key={col.key}
                              style={{ width: col.width }}
                              className={`py-2 px-1.5 font-bold text-[#3B485C] whitespace-nowrap overflow-hidden text-ellipsis ${
                                !isLast ? 'border-r border-[#DFE7F6]' : ''
                              }`}
                            >
                              {col.sortDir ? (
                                <div className="inline-flex items-center gap-1 truncate">
                                  <ArrowUp className="w-3.5 h-3.5 text-[#3B485C] stroke-[2.5] flex-shrink-0" />
                                  <span className="truncate">{col.label}</span>
                                </div>
                              ) : (
                                <span className="truncate">{col.label}</span>
                              )}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>

                    {/* Table Body */}
                    <tbody>
                      {currentRows.map((row, rIdx) => {
                        const isRowSelected = selectedRowIds.has(row.id);
                        const isUpdateRow = row.isUpdate;

                        return (
                          <tr
                            key={row.id}
                            className={`border-b border-[#EDF2F7] transition-colors ${
                              isUpdateRow
                                ? 'bg-blue-50/50 hover:bg-blue-100/50 font-semibold cursor-pointer'
                                : 'bg-slate-50/70 hover:bg-slate-100/80 cursor-not-allowed opacity-85'
                            }`}
                            title={
                              isUpdateRow
                                ? "This Month's Update Entry (Click / Drag to select, or copy with Copy button)"
                                : 'Previous Months Subtotal (Read-Only reference, cannot be selected or copied)'
                            }
                          >
                            <td
                              className={`py-2 px-2 text-center transition-colors ${
                                isUpdateRow ? 'cursor-pointer' : 'cursor-not-allowed bg-slate-100/60'
                              } ${isRowSelected ? 'bg-[#BFCEF5]' : isUpdateRow ? 'bg-blue-50/70' : ''}`}
                              onClick={() => isUpdateRow && handleRowCheckboxToggle(row.id, rIdx)}
                            >
                              <button
                                type="button"
                                disabled={!isUpdateRow}
                                className={`w-4 h-4 rounded-[3px] border flex items-center justify-center transition-colors mx-auto ${
                                  isRowSelected
                                    ? 'bg-[#D81B60] border-[#D81B60] text-white shadow-sm'
                                    : isUpdateRow
                                    ? 'border-[#BAC7D5] bg-white cursor-pointer'
                                    : 'border-slate-300 bg-slate-200/50 cursor-not-allowed'
                                }`}
                              >
                                {isRowSelected && <Check className="w-3 h-3 stroke-[3]" />}
                              </button>
                            </td>

                            {currentColumns.map((col, cIdx) => {
                              const meta = getCellMeta(rIdx, cIdx);
                              const val = (row as any)[col.key];

                              return (
                                <td
                                  key={col.key}
                                  onMouseDown={(e) => handleCellMouseDown(rIdx, cIdx, e)}
                                  onMouseEnter={() => handleCellMouseEnter(rIdx, cIdx)}
                                  className={`py-2 px-1.5 whitespace-nowrap overflow-hidden text-ellipsis relative text-[#1F2937] transition-colors ${
                                    isUpdateRow
                                      ? 'cursor-cell hover:bg-blue-100/70'
                                      : 'cursor-not-allowed bg-slate-100/40 text-slate-600 select-none'
                                  } ${meta.isSelected ? 'bg-[#BFCEF5]' : isUpdateRow ? 'bg-blue-50/50 font-semibold' : ''}`}
                                >
                                  {meta.isSelected && isUpdateRow && (
                                    <div
                                      className={`absolute inset-0 pointer-events-none z-10 ${
                                        meta.isTop ? 'border-t-2 border-[#5473E8]' : ''
                                      } ${meta.isBottom ? 'border-b-2 border-[#5473E8]' : ''} ${
                                        meta.isLeft ? 'border-l-2 border-[#5473E8]' : ''
                                      } ${meta.isRight ? 'border-r-2 border-[#5473E8]' : ''}`}
                                    >
                                      {meta.showHandle && meta.isLeft && meta.isBottom && (
                                        <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-[#5473E8] rounded-[1px]" />
                                      )}
                                    </div>
                                  )}

                                  <div className="flex items-center justify-between space-x-1.5 truncate">
                                    {col.key === 'sapWbsElement' ? (
                                      <>
                                        <span className="truncate">{val}</span>
                                        {isUpdateRow ? (
                                          <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded font-sans font-bold uppercase tracking-tight flex-shrink-0">
                                            This Month
                                          </span>
                                        ) : (
                                          <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.2 rounded font-sans font-medium uppercase tracking-tight flex-shrink-0">
                                            Previous Total
                                          </span>
                                        )}
                                      </>
                                    ) : (
                                      <span className="truncate">{val}</span>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}

                      {/* Ghost Row for adding new items */}
                      <tr className="border-b border-[#EDF2F7] bg-white cursor-not-allowed opacity-60">
                        <td className="py-2 px-2.5 text-center cursor-not-allowed">
                          <svg className="w-4 h-4 mx-auto text-slate-400" viewBox="0 0 16 16" fill="currentColor">
                            <path
                              fillRule="evenodd"
                              d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2z"
                            />
                          </svg>
                        </td>
                        <td className="py-2 px-2.5">
                          <span className="italic text-slate-500 font-normal">New actual...</span>
                        </td>
                        <td className="py-2 px-2.5">
                          <span className="text-[#00B050] font-bold text-sm">€</span>
                        </td>
                        <td className="py-2 px-2.5"></td>
                        <td className="py-2 px-2.5"></td>
                        <td className="py-2 px-2.5 text-[#00B050] font-normal">Standard</td>
                        <td className="py-2 px-2.5"></td>
                        <td className="py-2 px-2.5"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Bottom Modal Footer with Action Buttons */}
            <div className="pt-6 pb-1 flex items-center justify-between gap-3 mt-auto border-t border-slate-100">
              <div>
                {onViewCalculationDetails && (
                  <button
                    type="button"
                    onClick={onViewCalculationDetails}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    View underlying SAP CJI3 transaction details
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="bg-[#5E77D3]/80 text-white text-[14px] font-medium px-5 py-2 rounded-lg transition-colors shadow-xs cursor-not-allowed"
                  title="Button disabled in mock view"
                >
                  Save & close
                </button>

                <button
                  type="button"
                  className="border-2 border-[#5E77D3]/80 text-[#5E77D3]/80 text-[14px] font-medium px-7 py-1.5 rounded-lg transition-colors cursor-not-allowed"
                  title="Button disabled in mock view"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Diagonal Window Resize Corner Grip */}
        <div className="absolute bottom-1.5 right-1.5 pointer-events-none opacity-45">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <line x1="11" y1="3" x2="3" y2="11" stroke="#64748B" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="11" y1="6.5" x2="6.5" y2="11" stroke="#64748B" strokeWidth="1.2" strokeLinecap="round" />
            <line x1="11" y1="10" x2="10" y2="11" stroke="#64748B" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* Sandboxed Iframe Fallback Modal */}
      {showCopyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl p-5 max-w-md w-full border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 text-base">Copy Planisware Row</h3>
              <button
                type="button"
                onClick={() => setShowCopyModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Press <kbd className="bg-slate-100 px-1 py-0.5 border rounded text-slate-800 font-mono">Cmd+C</kbd> or{' '}
              <kbd className="bg-slate-100 px-1 py-0.5 border rounded text-slate-800 font-mono">Ctrl+C</kbd> on the
              highlighted text below to copy directly:
            </p>
            <textarea
              readOnly
              value={lastCopiedString}
              onFocus={(e) => e.target.select()}
              className="w-full h-20 p-2 font-mono text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 select-all"
              autoFocus
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowCopyModal(false)}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium rounded-lg cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
