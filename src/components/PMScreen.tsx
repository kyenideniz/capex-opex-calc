import React, { useState } from 'react';
import { User, WBSMonthlySummary } from '../types';
import { PlaniswareView } from './PlaniswareView';
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

      {/* 3. PLANISWARE 1-TO-1 UI ACTUALS ENTRY VIEW */}
      <PlaniswareView
        summary={activeSummary}
        reportingMonth={reportingMonth}
      />
    </div>
  );
};
