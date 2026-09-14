import React, { useState } from 'react';
import { User, WBSMonthlySummary } from '../types';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  HelpCircle,
  Info,
  Layers,
  MessageSquare,
  ShieldAlert,
} from 'lucide-react';

interface PMScreenProps {
  currentUser: User;
  reportingMonth: string;
  availableMonths?: string[];
  isCalculating?: boolean;
  onMonthChange: (month: string) => void;
  summaries: WBSMonthlySummary[];
  selectedWbs: string;
  onSelectWbs: (wbs: string) => void;
  onMarkProcessed: (data: {
    wbs: string;
    reportingMonth: string;
    planiswareRef?: string;
    comment?: string;
    confirmedBy: string;
  }) => Promise<void>;
  onExportExcel: () => void;
  onOpenUploadModal: () => void;
  onViewCalculationDetails: (wbs: string) => void;
}

export const PMScreen: React.FC<PMScreenProps> = ({
  currentUser,
  reportingMonth,
  availableMonths = [],
  isCalculating = false,
  onMonthChange,
  summaries,
  selectedWbs,
  onSelectWbs,
  onMarkProcessed,
  onExportExcel,
  onOpenUploadModal,
  onViewCalculationDetails,
}) => {
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [planiswareRef, setPlaniswareRef] = useState('');
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [wbsSearchTerm, setWbsSearchTerm] = useState('');

  // Active summary
  const activeSummary = summaries.find((s) => s.wbs === selectedWbs) || summaries[0];

  const monthOptions = availableMonths.length > 0 ? availableMonths : [
    '2026-09',
    '2026-08',
    '2026-07',
    '2026-06',
    '2026-05',
    '2026-04',
    '2026-03',
    '2026-02',
    '2026-01',
    '2025-12',
    '2025-11',
    '2025-10',
    '2025-09',
  ];

  // Filtered summaries for search
  const filteredSummaries = summaries.filter(
    (s) =>
      s.wbs.toLowerCase().includes(wbsSearchTerm.toLowerCase()) ||
      s.projectName.toLowerCase().includes(wbsSearchTerm.toLowerCase())
  );

  if (!activeSummary) {
    return (
      <div className="max-w-5xl mx-auto py-12 px-4 text-center">
        <div className="p-8 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <HelpCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-800">No WBS Projects Found</h3>
          <p className="text-sm text-slate-600 mt-1">
            No projects found for reporting month {reportingMonth}.
          </p>
          <button
            onClick={onOpenUploadModal}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-blue-500 transition"
          >
            Upload / Load Excel Data
          </button>
        </div>
      </div>
    );
  }

  // Filter vendor deltas with non-zero change or active
  const vendorRows = activeSummary.vendorDeltas.filter(
    (v) => Math.abs(v.addThisMonth) > 0.001 || v.status === 'Processed' || Math.abs(v.newBalance) > 0
  );

  const formatEUR = (val: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(val);
  };

  const handleProcessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onMarkProcessed({
        wbs: activeSummary.wbs,
        reportingMonth,
        planiswareRef,
        comment,
        confirmedBy: currentUser.name,
      });
      setShowProcessModal(false);
    } catch (e) {
      alert('Failed to mark as processed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Processed':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            Processed
          </span>
        );
      case 'To enter':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
            <Clock className="w-3.5 h-3.5 mr-1 text-blue-600" />
            To enter
          </span>
        );
      case 'Review':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 mr-1 text-amber-600" />
            Review
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
            No action
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      
      {/* 1. PLANISWARE INTEGRATION & ANALYTICS CONTAINER */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5">
        
        {/* Top Title & Month Selector Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center space-x-2.5">
              <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">Planisware Monthly Manual Update Guide</h1>
                <p className="text-xs text-slate-500"></p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Reporting Month Selector */}
            <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
              <span className="text-slate-500 font-semibold">Reporting Month:</span>
              <select
                value={reportingMonth}
                onChange={(e) => onMonthChange(e.target.value)}
                className="bg-white text-slate-900 font-bold border border-slate-300 rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
              >
                {monthOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* Upload File / Extract Button */}
            <button
              onClick={onOpenUploadModal}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-1.5"
            >
              <Download className="w-3.5 h-3.5 rotate-180" />
              <span>Upload / Load CJI3</span>
            </button>
          </div>
        </div>

        {/* WBS Selection & Search Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-1">
            <label className="block text-xs font-bold text-slate-700 mb-1">Search WBS / Project Name</label>
            <input
              type="text"
              placeholder="Search WBS code..."
              value={wbsSearchTerm}
              onChange={(e) => setWbsSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="wbs-select" className="text-xs font-bold text-slate-700">
                Select Project WBS Element ({filteredSummaries.length} available)
              </label>
            </div>
            <select
              id="wbs-select"
              value={activeSummary.wbs}
              onChange={(e) => onSelectWbs(e.target.value)}
              className="w-full bg-slate-50 text-slate-900 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
            >
              {filteredSummaries.map((s) => (
                <option key={s.wbs} value={s.wbs}>
                  {s.wbs} — {s.projectName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Active Selected WBS Status Bar */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <span className="font-mono bg-white px-2.5 py-1 rounded-lg text-slate-900 font-bold text-xs border border-slate-200 shadow-2xs">
              {activeSummary.wbs}
            </span>
            <div>
              <span className="text-xs font-bold text-slate-900 block">{activeSummary.projectName}</span>
              <span className="text-[11px] text-slate-500">Assigned PM: {activeSummary.assignedPmName || 'Unassigned'}</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {getStatusBadge(activeSummary.processingStatus)}

            <button
              onClick={onExportExcel}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-lg border border-slate-200 shadow-2xs transition flex items-center space-x-1"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

      </div>

      {/* Warnings Banner if any */}
      {activeSummary.warningsCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start space-x-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 space-y-1">
            <span className="font-bold">Reconciliation Warnings for WBS {activeSummary.wbs}:</span>
            <p>
              This project has {activeSummary.warningsCount} notice(s) require review (e.g., negative additions, vendor alias normalizations, or budget status). Click "View calculation details" below for complete audit logs.
            </p>
          </div>
        </div>
      )}

      {/* 2. MAIN SUMMARY - THREE LARGE VALUES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: Balance before this month */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            1. Balance Before This Month
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
            {formatEUR(activeSummary.previousBalance)}
          </div>
          <div className="mt-2 text-xs text-slate-400 font-medium">
            Cumulative external actuals in prior accepted SAP snapshot
          </div>
        </div>

        {/* Card 2: Add this month (The Core Question Answer) */}
        <div className={`p-6 rounded-2xl border shadow-xs relative overflow-hidden ${
          activeSummary.addThisMonth < 0
            ? 'bg-amber-50/70 border-amber-200'
            : activeSummary.addThisMonth > 0
            ? 'bg-blue-50/80 border-blue-200 ring-2 ring-blue-500/20'
            : 'bg-white border-slate-200'
        }`}>
          <div className="text-xs font-semibold uppercase tracking-wider text-blue-900 mb-2 flex items-center justify-between">
            <span>2. Add This Month (To Enter into Planisware)</span>
            <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">Primary</span>
          </div>
          <div className={`text-2xl sm:text-3xl font-black tracking-tight ${
            activeSummary.addThisMonth < 0 ? 'text-amber-700' : activeSummary.addThisMonth > 0 ? 'text-blue-700' : 'text-slate-800'
          }`}>
            {activeSummary.addThisMonth > 0 ? `+${formatEUR(activeSummary.addThisMonth)}` : formatEUR(activeSummary.addThisMonth)}
          </div>
          <div className="mt-2 text-xs text-blue-900/80 font-medium">
            Net external vendor addition to enter into Planisware for {reportingMonth}
          </div>
        </div>

        {/* Card 3: New balance after entry */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            3. New Balance After Entry
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {formatEUR(activeSummary.newBalance)}
          </div>
          <div className="mt-2 text-xs text-slate-400 font-medium">
            Resulting cumulative external actual balance in Planisware
          </div>
        </div>
      </div>

      {/* 3. VENDOR ENTRY TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-sm font-bold text-slate-900">External Vendor Entry Instructions</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Breakdown of external vendor amounts to enter into Planisware under {activeSummary.wbs}
            </p>
          </div>
          <div className="flex items-center space-x-3 text-xs text-slate-500">
            {isCalculating && (
              <span className="flex items-center space-x-1.5 text-blue-600 font-bold bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span>Calculating Real-time Deltas...</span>
              </span>
            )}
            <span>Showing <strong className="text-slate-800">{vendorRows.length}</strong> active vendor(s)</span>
          </div>
        </div>

        {isCalculating ? (
          <div className="p-10 text-center space-y-3 bg-slate-50/50">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <div className="text-xs font-bold text-slate-700">
              Processing & Calculating SAP CJI3 Vendor Actuals for {reportingMonth}...
            </div>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
              Extracting historical balances up to previous period and deriving net monthly additions for WBS {activeSummary.wbs}...
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-6">Vendor Name</th>
                  <th className="py-3.5 px-4 text-right">Previous Balance</th>
                  <th className="py-3.5 px-4 text-right bg-blue-50/50 text-blue-900 font-extrabold">Add This Month</th>
                  <th className="py-3.5 px-4 text-right">New Balance</th>
                  <th className="py-3.5 px-6 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {vendorRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No external vendor activity for this month.
                    </td>
                  </tr>
                ) : (
                  vendorRows.map((v, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-4 px-6 font-semibold text-slate-900 text-sm">
                        {v.vendor}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-slate-600">
                        {formatEUR(v.previousBalance)}
                      </td>
                      <td className={`py-4 px-4 text-right font-mono text-sm font-bold bg-blue-50/30 ${
                        v.addThisMonth < 0 ? 'text-amber-700' : v.addThisMonth > 0 ? 'text-blue-700' : 'text-slate-600'
                      }`}>
                        {v.addThisMonth > 0 ? `+${formatEUR(v.addThisMonth)}` : formatEUR(v.addThisMonth)}
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-slate-900 font-bold">
                        {formatEUR(v.newBalance)}
                      </td>
                      <td className="py-4 px-6 text-center">
                        {getStatusBadge(v.status)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-slate-100 font-bold text-slate-900 border-t border-slate-200">
                <tr>
                  <td className="py-3.5 px-6 text-sm">Total External Actuals</td>
                  <td className="py-3.5 px-4 text-right font-mono">{formatEUR(activeSummary.previousBalance)}</td>
                  <td className="py-3.5 px-4 text-right font-mono text-blue-800 text-sm">{formatEUR(activeSummary.addThisMonth)}</td>
                  <td className="py-3.5 px-4 text-right font-mono">{formatEUR(activeSummary.newBalance)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* 4. ACTIONS BAR & PLANISWARE CONFIRMATION */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Status Confirmation Display */}
        <div>
          {activeSummary.processingStatus === 'Processed' ? (
            <div className="flex items-start space-x-3 text-xs text-emerald-900">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-sm">Processed in Planisware</span>
                <span>Ref: <strong className="font-mono">{activeSummary.planiswareRef || 'N/A'}</strong> by {activeSummary.processedBy} on {activeSummary.processedAt ? new Date(activeSummary.processedAt).toLocaleDateString() : ''}</span>
                {activeSummary.comment && <p className="text-slate-600 italic mt-0.5">"{activeSummary.comment}"</p>}
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-xs text-slate-600">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Pending manual entry into Planisware for reporting month {reportingMonth}.</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => onViewCalculationDetails(activeSummary.wbs)}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center space-x-1.5"
          >
            <Layers className="w-4 h-4 text-slate-500" />
            <span>View calculation details</span>
          </button>

          <button
            onClick={onExportExcel}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center space-x-1.5"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export entry instructions</span>
          </button>

          <button
            onClick={() => {
              setPlaniswareRef(activeSummary.planiswareRef || '');
              setComment(activeSummary.comment || '');
              setShowProcessModal(true);
            }}
            className="px-5 py-2.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition flex items-center space-x-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{activeSummary.processingStatus === 'Processed' ? 'Update Planisware Reference' : 'Mark as Processed'}</span>
          </button>
        </div>
      </div>

      {/* MODAL: MARK AS PROCESSED */}
      {showProcessModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Mark Month as Processed in Planisware
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Confirm that you have entered the external actual additions for WBS <strong className="text-slate-800">{activeSummary.wbs}</strong> into Planisware.
            </p>

            <form onSubmit={handleProcessSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Planisware Entry Reference <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PLN-2026-09-1001"
                  value={planiswareRef}
                  onChange={(e) => setPlaniswareRef(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Optional Comment or Note
                </label>
                <textarea
                  rows={2}
                  placeholder="Add any remarks regarding vendor invoices or PO reconciliations..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span>WBS Element:</span>
                  <strong className="font-mono text-slate-800">{activeSummary.wbs}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Reporting Month:</span>
                  <strong className="text-slate-800">{reportingMonth}</strong>
                </div>
                <div className="flex justify-between text-blue-700 font-bold">
                  <span>Total Confirmed Addition:</span>
                  <span>{formatEUR(activeSummary.addThisMonth)}</span>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProcessModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Confirm Processed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
