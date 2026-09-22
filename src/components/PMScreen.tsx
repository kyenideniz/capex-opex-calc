import React, { useState, useRef, useEffect } from 'react';
import { User, WBSMonthlySummary } from '../types';
import { PlaniswareView } from './PlaniswareView';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  ExternalLink,
  FileUp,
  HelpCircle,
  Info,
  Layers,
  MessageSquare,
  Search,
  ShieldAlert,
  X,
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

  // Search & Combobox State
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchDropdownRef = useRef<HTMLDivElement>(null);

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
  const filteredSummaries = searchTerm.trim() === ''
    ? summaries
    : summaries.filter(
        (s) =>
          s.wbs.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.projectName.toLowerCase().includes(searchTerm.toLowerCase())
      );

  // Reset highlighted item when search term changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchTerm]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchDropdownRef.current &&
        !searchDropdownRef.current.contains(e.target as Node)
      ) {
        setIsSearchOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectProject = (wbs: string) => {
    onSelectWbs(wbs);
    setIsSearchOpen(false);
    setSearchTerm('');
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isSearchOpen) {
        setIsSearchOpen(true);
      } else {
        setHighlightedIndex((prev) =>
          prev < filteredSummaries.length - 1 ? prev + 1 : 0
        );
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isSearchOpen) {
        setIsSearchOpen(true);
      } else {
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredSummaries.length - 1
        );
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredSummaries.length > 0) {
        const target = filteredSummaries[highlightedIndex] || filteredSummaries[0];
        if (target) {
          handleSelectProject(target.wbs);
        }
      }
    } else if (e.key === 'Escape') {
      setIsSearchOpen(false);
      setSearchTerm('');
      searchInputRef.current?.blur();
    }
  };

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

            {/* Upload File / WBS Code Reference Button */}
            <button
              onClick={onOpenUploadModal}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
              title="Copy WBS codes for Excel or load SAP CJI3 source files"
            >
              <FileUp className="w-3.5 h-3.5" />
              <span>WBS Reference & Upload</span>
            </button>
          </div>
        </div>

        {/* Unified Search & Select WBS Combobox */}
        <div ref={searchDropdownRef} className="relative">
          <div className="flex justify-between items-center mb-1.5">
            <label htmlFor="wbs-search-select" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <span>Select or Search WBS Element</span>
              <span className="text-[11px] font-normal text-slate-400">
                (Type WBS code, press Enter or click to choose)
              </span>
            </label>
            <div className="flex items-center space-x-3">
              <button
                onClick={onExportExcel}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-[11px] rounded-lg border border-slate-200 shadow-2xs transition flex items-center space-x-1"
                title="Export current reconciliation to Excel"
              >
                <Download className="w-3 h-3 text-slate-500" />
                <span>Export Excel</span>
              </button>
              <span className="text-[11px] text-slate-500 font-medium">
                {summaries.length} available projects
              </span>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>

            <input
              id="wbs-search-select"
              ref={searchInputRef}
              type="text"
              autoComplete="off"
              value={isSearchOpen ? searchTerm : activeSummary.wbs}
              placeholder="Type WBS code (e.g. C7941/2036 or O7941/2519)..."
              onFocus={() => {
                setIsSearchOpen(true);
                setSearchTerm('');
              }}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (!isSearchOpen) setIsSearchOpen(true);
              }}
              onKeyDown={handleInputKeyDown}
              className={`w-full pl-10 pr-20 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white text-slate-900 border rounded-xl text-xs font-bold transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-text ${
                isSearchOpen ? 'border-blue-400 ring-2 ring-blue-500/20' : 'border-slate-300'
              }`}
            />

            <div className="absolute inset-y-0 right-0 pr-2 flex items-center space-x-1">
              {isSearchOpen && searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    searchInputRef.current?.focus();
                  }}
                  className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-lg transition cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (isSearchOpen) {
                    setIsSearchOpen(false);
                    setSearchTerm('');
                  } else {
                    setIsSearchOpen(true);
                    searchInputRef.current?.focus();
                  }
                }}
                className="p-1.5 hover:bg-slate-200 text-slate-500 rounded-lg transition cursor-pointer"
                title={isSearchOpen ? "Close menu" : "Open projects menu"}
              >
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isSearchOpen ? 'rotate-180 text-blue-600' : ''}`} />
              </button>
            </div>
          </div>

          {/* Floating Dropdown Results Menu */}
          {isSearchOpen && (
            <div className="absolute z-40 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-72 overflow-y-auto">
              {filteredSummaries.length > 0 ? (
                <div className="p-1 space-y-0.5">
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider bg-slate-50/80 border-b border-slate-100 flex justify-between items-center">
                    <span>{filteredSummaries.length} project(s)</span>
                    <span className="text-[10px] text-slate-400 font-normal">Press Enter ↵ to select</span>
                  </div>

                  {filteredSummaries.map((s, idx) => {
                    const isSelected = s.wbs === activeSummary.wbs;
                    const isHighlighted = idx === highlightedIndex;
                    const isOpex = s.projectType === 'OPEX' || s.wbs.startsWith('C') || s.wbs.startsWith('C7941/');

                    return (
                      <div
                        key={s.wbs}
                        onClick={() => handleSelectProject(s.wbs)}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        className={`px-3 py-2 rounded-lg cursor-pointer transition flex items-center justify-between gap-3 text-xs ${
                          isHighlighted
                            ? 'bg-blue-50 text-blue-900 font-semibold'
                            : isSelected
                            ? 'bg-slate-100 font-semibold text-slate-900'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 truncate">
                          <span
                            className={`text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded border ${
                              isOpex
                                ? 'bg-purple-100 text-purple-800 border-purple-200'
                                : 'bg-blue-100 text-blue-800 border-blue-200'
                            }`}
                          >
                            {isOpex ? 'OPEX' : 'CAPEX'}
                          </span>
                          <span className={`font-mono text-xs px-2 py-0.5 rounded border ${
                            isSelected || isHighlighted
                              ? 'bg-blue-100/80 border-blue-300 text-blue-800 font-bold'
                              : 'bg-slate-100 border-slate-200 text-slate-800 font-semibold'
                          }`}>
                            {s.wbs}
                          </span>
                        </div>

                        <div className="flex items-center space-x-2 flex-shrink-0">
                          <span className={`text-[11px] font-bold ${
                            s.addThisMonth > 0 ? 'text-blue-700' : s.addThisMonth < 0 ? 'text-amber-700' : 'text-slate-400'
                          }`}>
                            {s.addThisMonth > 0 ? `+${formatEUR(s.addThisMonth)}` : formatEUR(s.addThisMonth)}
                          </span>
                          {isSelected && (
                            <Check className="w-3.5 h-3.5 text-blue-600 stroke-[2.5]" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-6 px-4 text-center text-xs text-slate-500 space-y-1">
                  <p className="font-semibold text-slate-700">No projects matching "{searchTerm}"</p>
                  <p className="text-[11px] text-slate-400">Try searching with a partial WBS number (e.g. "C7941/2036" or "2519")</p>
                </div>
              )}
            </div>
          )}
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
