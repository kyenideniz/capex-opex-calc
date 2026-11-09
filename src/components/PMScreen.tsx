import React, { useState, useRef, useEffect } from 'react';
import { User, WBSMonthlySummary } from '../types';
import { PlaniswareView } from './PlaniswareView';
import { resolveProjectName } from '../utils/wbsMap';
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

  // Filter only projects that require actuals updating (differences from old source, additions in period, or past corrections)
  // Deduplicate updatingSummaries so projects with linked Capex & Opex codes are represented once
  // (preferring the active Capex code that has spend) to maintain the clean queue of 48 projects
  const updatingSummaries = React.useMemo(() => {
    const rawUpdating = summaries.filter(
      (s) =>
        (s.hasDifferenceFromOldSource || Math.abs(s.addThisMonth) > 0.001 || s.hasPastCorrection) &&
        (Math.abs(s.previousBalance) > 0.001 || Math.abs(s.addThisMonth) > 0.001 || s.hasPastCorrection)
    );
    const seen = new Map<string, WBSMonthlySummary>();
    rawUpdating.forEach((s) => {
      const itMatch = s.projectName?.match(/^(IT-[a-zA-Z0-9]+)/);
      const numMatch = (s.projectName + ' ' + s.wbs).match(/\b(2[0-9]{3}|8[0-9]{3})\b/);
      const cleanNum = numMatch && numMatch[1] !== '2026' ? numMatch[1] : undefined;
      const key = cleanNum || (itMatch ? itMatch[1] : s.projectName?.split(' - ')[0] || s.wbs);

      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, s);
      } else {
        if (s.wbs.startsWith('O') && !existing.wbs.startsWith('O')) {
          seen.set(key, s);
        } else if (Math.abs(s.addThisMonth) > Math.abs(existing.addThisMonth)) {
          seen.set(key, s);
        }
      }
    });
    return Array.from(seen.values());
  }, [summaries]);

  // Filter mode for combobox: 'all' or 'updating'
  const [filterMode, setFilterMode] = useState<'all' | 'updating'>('all');

  // Active summary: prioritize currently selected WBS if specified across ALL summaries,
  // falling back to first updating summary, or first overall summary.
  const activeSummary =
    summaries.find((s) => s.wbs === selectedWbs) ||
    updatingSummaries[0] ||
    summaries[0];

  const currentCarouselIndex = updatingSummaries.findIndex((s) => {
    if (s.wbs === activeSummary?.wbs) return true;
    const itMatchA = s.projectName?.match(/^(IT-[a-zA-Z0-9]+)/);
    const itMatchB = activeSummary?.projectName?.match(/^(IT-[a-zA-Z0-9]+)/);
    if (itMatchA && itMatchB && itMatchA[1] === itMatchB[1]) return true;
    const numA = (s.projectName + ' ' + s.wbs).match(/\b(2[0-9]{3}|8[0-9]{3})\b/);
    const numB = (activeSummary?.projectName + ' ' + (activeSummary?.wbs || '')).match(/\b(2[0-9]{3}|8[0-9]{3})\b/);
    if (numA && numB && numA[1] !== '2026' && numA[1] === numB[1]) return true;
    return false;
  });
  const carouselTotal = updatingSummaries.length;
  const isCurrentInUpdating = currentCarouselIndex >= 0;

  // Auto-align selectedWbs ONLY on initial mount when selectedWbs is completely empty
  useEffect(() => {
    if (!selectedWbs && summaries.length > 0) {
      const initialWbs = updatingSummaries[0]?.wbs || summaries[0]?.wbs;
      if (initialWbs) {
        onSelectWbs(initialWbs);
      }
    }
  }, [summaries.length, selectedWbs]);

  const handleNextProject = () => {
    if (carouselTotal === 0) return;
    if (currentCarouselIndex >= 0 && currentCarouselIndex < carouselTotal - 1) {
      onSelectWbs(updatingSummaries[currentCarouselIndex + 1].wbs);
    } else if (currentCarouselIndex === carouselTotal - 1) {
      // Loop seamlessly to first project
      onSelectWbs(updatingSummaries[0].wbs);
    } else {
      // If currently viewing a non-updating project, Next jumps directly into the updating carousel at index 0
      onSelectWbs(updatingSummaries[0].wbs);
    }
  };

  const handlePrevProject = () => {
    if (carouselTotal === 0) return;
    if (currentCarouselIndex > 0) {
      onSelectWbs(updatingSummaries[currentCarouselIndex - 1].wbs);
    } else if (currentCarouselIndex === 0) {
      // Loop seamlessly to last project
      onSelectWbs(updatingSummaries[carouselTotal - 1].wbs);
    } else {
      // If currently viewing a non-updating project, Prev jumps to last update project
      onSelectWbs(updatingSummaries[carouselTotal - 1].wbs);
    }
  };

  const carouselInfo = {
    currentIndex: currentCarouselIndex,
    totalCount: carouselTotal,
    hasPrev: carouselTotal > 0,
    hasNext: carouselTotal > 0,
    isCurrentInUpdating,
    prevProject: carouselTotal > 0 ? {
      wbs: updatingSummaries[
        currentCarouselIndex > 0
          ? currentCarouselIndex - 1
          : carouselTotal - 1
      ].wbs,
      name: resolveProjectName(
        updatingSummaries[
          currentCarouselIndex > 0
            ? currentCarouselIndex - 1
            : carouselTotal - 1
        ].wbs,
        updatingSummaries[
          currentCarouselIndex > 0
            ? currentCarouselIndex - 1
            : carouselTotal - 1
        ].projectName
      ),
    } : undefined,
    nextProject: carouselTotal > 0 ? {
      wbs: updatingSummaries[
        currentCarouselIndex >= 0 && currentCarouselIndex < carouselTotal - 1
          ? currentCarouselIndex + 1
          : 0
      ].wbs,
      name: resolveProjectName(
        updatingSummaries[
          currentCarouselIndex >= 0 && currentCarouselIndex < carouselTotal - 1
            ? currentCarouselIndex + 1
            : 0
        ].wbs,
        updatingSummaries[
          currentCarouselIndex >= 0 && currentCarouselIndex < carouselTotal - 1
            ? currentCarouselIndex + 1
            : 0
        ].projectName
      ),
    } : undefined,
    onPrev: handlePrevProject,
    onNext: handleNextProject,
  };

  const monthOptions = availableMonths.length > 0 ? availableMonths : [
    '2026-10',
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

  const getWbsDisplayString = (s?: WBSMonthlySummary) => {
    if (!s) return '';
    const pName = resolveProjectName(s.wbs, s.projectName);
    return pName ? `${s.wbs} - ${pName}` : s.wbs;
  };

  // Filtered summaries for search
  const basePool = filterMode === 'updating' ? updatingSummaries : summaries;
  const filteredSummaries = searchTerm.trim() === ''
    ? basePool
    : basePool.filter((s) => {
        const term = searchTerm.toLowerCase();
        const pName = resolveProjectName(s.wbs, s.projectName).toLowerCase();
        const wbsCode = s.wbs.toLowerCase();
        return wbsCode.includes(term) || pName.includes(term);
      });

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
              value={isSearchOpen ? searchTerm : (activeSummary ? getWbsDisplayString(activeSummary) : '')}
              placeholder="Search by WBS Element or Project Name (e.g. C7941/8116 or Symphony)..."
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
                  <div className="px-3 py-2 text-[11px] font-semibold text-slate-500 bg-slate-50 border-b border-slate-200 flex flex-wrap justify-between items-center gap-2">
                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFilterMode('all');
                        }}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                          filterMode === 'all'
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        All Projects ({summaries.length})
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFilterMode('updating');
                        }}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer flex items-center space-x-1 ${
                          filterMode === 'updating'
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>Requires Update ({updatingSummaries.length})</span>
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {filteredSummaries.length} showing • Press Enter ↵
                    </span>
                  </div>

                  {filteredSummaries.map((s, idx) => {
                    const isSelected = s.wbs === activeSummary.wbs;
                    const isHighlighted = idx === highlightedIndex;
                    const isOpex = s.projectType === 'OPEX' || s.wbs.startsWith('C') || s.wbs.startsWith('C7941/');
                    const updateIdx = updatingSummaries.findIndex((u) => u.wbs === s.wbs);
                    const isUpdating = updateIdx >= 0;

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
                        <div className="flex items-center space-x-2 truncate">
                          <span
                            className={`text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded border flex-shrink-0 ${
                              isOpex
                                ? 'bg-purple-100 text-purple-800 border-purple-200'
                                : 'bg-blue-100 text-blue-800 border-blue-200'
                            }`}
                          >
                            {isOpex ? 'OPEX' : 'CAPEX'}
                          </span>
                          <span className={`font-mono text-xs px-2 py-0.5 rounded border flex-shrink-0 ${
                            isSelected || isHighlighted
                              ? 'bg-blue-100/80 border-blue-300 text-blue-800 font-bold'
                              : 'bg-slate-100 border-slate-200 text-slate-800 font-semibold'
                          }`}>
                            {s.wbs}
                          </span>
                          <span className="text-xs text-slate-600 font-medium truncate">
                            - {resolveProjectName(s.wbs, s.projectName)}
                          </span>
                          {isUpdating ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 flex-shrink-0">
                              Update #{updateIdx + 1}
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 flex-shrink-0">
                              Up to date
                            </span>
                          )}
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
              This project has {activeSummary.warningsCount} notice(s) require review (e.g., negative additions, vendor alias normalizations, or budget status). 
            </p>
          </div>
        </div>
      )}

      {/* Zero External Spend / Internal Mandays Policy Notice */}
      {Math.abs(activeSummary.previousBalance) < 0.01 && Math.abs(activeSummary.addThisMonth) < 0.01 && Math.abs(activeSummary.newBalance) < 0.01 && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start justify-between gap-4">
          <div className="flex items-start space-x-3 text-xs text-slate-700">
            <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-slate-900">No External Vendor Spend Logged in SAP CJI3 for {activeSummary.wbs}</span>
              <p className="text-slate-600 leading-relaxed">
                This project has <strong>€0.00</strong> in external contractor or consulting spend. Internal labor, mandays, and IT Business Solutions are excluded from manual Planisware entry per cost accounting policy.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onViewCalculationDetails(activeSummary.wbs)}
            className="flex-shrink-0 px-3 py-1.5 bg-white hover:bg-slate-100 text-blue-700 border border-slate-300 rounded-xl text-xs font-bold transition shadow-2xs"
          >
            Inspect SAP Transactions
          </button>
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
            Pre-September 2026 balance in baseline accepted source
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
            Combined additions (Sept + Oct) to enter into Planisware
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
            Resulting cumulative external actual balance through October 31, 2026
          </div>
        </div>
      </div>

      {/* 3. PLANISWARE 1-TO-1 UI ACTUALS ENTRY VIEW */}
      <PlaniswareView
        summary={activeSummary}
        reportingMonth={reportingMonth}
        onViewCalculationDetails={() => onViewCalculationDetails(activeSummary.wbs)}
        carouselInfo={carouselInfo}
        allSummaries={summaries}
        onSelectWbs={onSelectWbs}
      />
    </div>
  );
};
