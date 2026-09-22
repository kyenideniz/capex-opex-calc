import React, { useState, useEffect } from 'react';
import { ParseResult } from '../types';
import { api } from '../api';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  CheckCircle2,
  X,
  FileUp,
  Layers,
  Copy,
  Check,
  Download,
  Table,
  Search,
} from 'lucide-react';

export const MANUAL_MAINTENANCE_WBS_CODES = [
  'O7941/2513',
  'O7941/2645',
  'O7941/2509/1',
  'O7941/2603',
  'O7942/2602',
  'O7941/2639',
  'O7941/2615',
  'O7941/2620',
  'O7941/2607',
  'O7941/2612',
  'O7941/2611',
  'O7941/2622',
  'O7941/2625',
  'O7941/2623',
  'O7941/2637',
  'O7941/2624',
  'O7941/2624',
  'O7941/2624',
  'O7941/2636',
  'O7941/2640',
  'O7941/2502/2',
  'O7941/2524',
  'O7941/2629',
  'O7941/2635',
  'N7941/2507',
  'O7941/2517',
  'O7941/2643',
  'O7941/2644',
  'O7941/2621',
  'O7941/2604',
  'O7941/2606',
  'O9567/26-002',
  'O9563/2608',
  'O2326/2609',
  'O6300/2603',
  'O7941/2519',
  'O7941/2614',
  'O7941/2642',
  'O7941/2605',
  'O7941/2627',
  'O7941/2609',
  'O7941/2610',
  'O7941/2638',
  'O7941/2628',
  'O7941/2641',
  'O7941/2616',
  'O7941/2633',
  'O7941/2602',
  'O7941/2634',
  'O7941/2631',
  'O7941/2613',
  'O7941/2617',
  'O7941/2618',
  'O7941/2523',
  'O7941/2632',
];

interface AdminUploadModalProps {
  onClose: () => void;
  onSuccess: () => void;
  currentUserId: string;
}

export const AdminUploadModal: React.FC<AdminUploadModalProps> = ({
  onClose,
  onSuccess,
  currentUserId,
}) => {
  const [activeTab, setActiveTab] = useState<'wbs_ref' | 'upload'>('wbs_ref');

  // WBS List State
  const [opexCodes, setOpexCodes] = useState<string[]>([]);
  const [capexCodes, setCapexCodes] = useState<string[]>([]);
  const [wbsSearchTerm, setWbsSearchTerm] = useState<string>('');
  const [copyToast, setCopyToast] = useState<string | null>(null);

  // Upload State
  const [reportingMonth, setReportingMonth] = useState('2026-09');
  const [file, setFile] = useState<File | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('CAPEX CJI3');
  const [availableSheets, setAvailableSheets] = useState<string[]>(['CAPEX CJI3', 'OPEX CJI3']);
  const [isLoading, setIsLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<ParseResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    // Load projects to classify OPEX vs CAPEX
    api
      .getProjects()
      .then((pList) => {
        const opex = pList
          .filter((p) => p.projectType === 'OPEX' || p.wbs.startsWith('C') || p.wbs.startsWith('C7941/'))
          .map((p) => p.wbs);
        const capex = pList
          .filter((p) => p.projectType === 'CAPEX' || (!p.wbs.startsWith('C') && !p.wbs.startsWith('C7941/')))
          .map((p) => p.wbs);

        // Deduplicate & sort
        setOpexCodes(Array.from(new Set(opex)).sort());
        setCapexCodes(Array.from(new Set(capex)).sort());
      })
      .catch((err) => {
        console.error('Failed to load project list for WBS reference:', err);
      });
  }, []);

  const handleCopyTsvAll = () => {
    const maxRows = Math.max(opexCodes.length, capexCodes.length, MANUAL_MAINTENANCE_WBS_CODES.length);
    const lines = ['OPEX WBS Codes\tCAPEX WBS Codes\tManual Maintenance'];
    for (let i = 0; i < maxRows; i++) {
      lines.push(`${opexCodes[i] || ''}\t${capexCodes[i] || ''}\t${MANUAL_MAINTENANCE_WBS_CODES[i] || ''}`);
    }
    navigator.clipboard.writeText(lines.join('\n'));
    setCopyToast('Copied 3 columns to clipboard! Ready to paste into Excel (Ctrl+V).');
    setTimeout(() => setCopyToast(null), 3500);
  };

  const handleCopyColumn = (colTitle: string, list: string[]) => {
    const lines = [colTitle, ...list];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopyToast(`Copied ${colTitle} (${list.length} codes) to clipboard!`);
    setTimeout(() => setCopyToast(null), 3000);
  };

  const handleExportXlsx = () => {
    const maxRows = Math.max(opexCodes.length, capexCodes.length, MANUAL_MAINTENANCE_WBS_CODES.length);
    const rows = [];
    for (let i = 0; i < maxRows; i++) {
      rows.push({
        'OPEX WBS Codes': opexCodes[i] || '',
        'CAPEX WBS Codes': capexCodes[i] || '',
        'Manual Maintenance': MANUAL_MAINTENANCE_WBS_CODES[i] || '',
      });
    }
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'WBS Code Reference');
    XLSX.writeFile(workbook, 'WBS_Codes_Reference.xlsx');
  };

  // Upload Handlers
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      await runPreview(selectedFile, selectedSheet);
    }
  };

  const handleSheetChange = async (sheet: string) => {
    setSelectedSheet(sheet);
    if (file) {
      await runPreview(file, sheet);
    }
  };

  const runPreview = async (selectedFile: File, sheetName?: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const result = await api.uploadPreview(selectedFile, sheetName);
      setPreviewResult(result);
      if (result.availableSheets && result.availableSheets.length > 0) {
        setAvailableSheets(result.availableSheets);
      }
      if (result.sheetName) {
        setSelectedSheet(result.sheetName);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to parse Excel file.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!file) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await api.commitSnapshot(file, reportingMonth, currentUserId, selectedSheet);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to commit snapshot.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadLocalFile = async (sheet: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await api.loadLocalSnapshot(reportingMonth, sheet);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load local capex-export-CJI3.xlsx file.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatEUR = (val: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(val);
  };

  // Filtered lists for search in Tab 1
  const searchUpper = wbsSearchTerm.trim().toUpperCase();
  const filteredOpex = searchUpper
    ? opexCodes.filter((c) => c.toUpperCase().includes(searchUpper))
    : opexCodes;
  const filteredCapex = searchUpper
    ? capexCodes.filter((c) => c.toUpperCase().includes(searchUpper))
    : capexCodes;
  const filteredManual = searchUpper
    ? MANUAL_MAINTENANCE_WBS_CODES.filter((c) => c.toUpperCase().includes(searchUpper))
    : MANUAL_MAINTENANCE_WBS_CODES;

  const maxDisplayRows = Math.max(
    filteredOpex.length,
    filteredCapex.length,
    filteredManual.length
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 my-8 space-y-5">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <Table className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">WBS Code Reference & CJI3 Source Tools</h3>
              <p className="text-xs text-slate-500">Copy WBS code lists for monthly Excel updates or load raw SAP CJI3 extracts</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between bg-slate-100 p-1 rounded-xl border border-slate-200">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('wbs_ref')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition flex items-center space-x-2 ${
                activeTab === 'wbs_ref'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Copy className="w-3.5 h-3.5" />
              <span>📋 WBS Codes for Excel Copy</span>
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition flex items-center space-x-2 ${
                activeTab === 'upload'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileUp className="w-3.5 h-3.5" />
              <span>📤 Upload / Load CJI3 Source</span>
            </button>
          </div>

          {copyToast && (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg animate-fade-in flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              {copyToast}
            </span>
          )}
        </div>

        {/* TAB 1: WBS CODES REFERENCE & EXCEL COPY */}
        {activeTab === 'wbs_ref' && (
          <div className="space-y-4">
            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Filter WBS codes..."
                  value={wbsSearchTerm}
                  onChange={(e) => setWbsSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopyTsvAll}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
                  title="Copy 3 columns as Tab-Separated Values (TSV) ready for Excel paste"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy 3 Columns (Excel TSV)</span>
                </button>

                <button
                  onClick={handleExportXlsx}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
                  title="Download .xlsx file with OPEX, CAPEX, and Manual Maintenance columns"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export .xlsx</span>
                </button>
              </div>
            </div>

            {/* 3-Column Table View */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs">
              <div className="grid grid-cols-3 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-800 divide-x divide-slate-200">
                {/* Column 1 Header */}
                <div className="p-3 flex items-center justify-between bg-purple-50/50">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-extrabold bg-purple-100 text-purple-800 rounded border border-purple-200">
                      OPEX
                    </span>
                    <span>OPEX Codes ({filteredOpex.length})</span>
                  </div>
                  <button
                    onClick={() => handleCopyColumn('OPEX WBS Codes', filteredOpex)}
                    className="p-1 hover:bg-purple-100 text-purple-700 rounded transition cursor-pointer"
                    title="Copy OPEX Column"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Column 2 Header */}
                <div className="p-3 flex items-center justify-between bg-blue-50/50">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-extrabold bg-blue-100 text-blue-800 rounded border border-blue-200">
                      CAPEX
                    </span>
                    <span>CAPEX Codes ({filteredCapex.length})</span>
                  </div>
                  <button
                    onClick={() => handleCopyColumn('CAPEX WBS Codes', filteredCapex)}
                    className="p-1 hover:bg-blue-100 text-blue-700 rounded transition cursor-pointer"
                    title="Copy CAPEX Column"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Column 3 Header */}
                <div className="p-3 flex items-center justify-between bg-amber-50/50">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-extrabold bg-amber-100 text-amber-800 rounded border border-amber-200">
                      Manual
                    </span>
                    <span>Manual Maintenance ({filteredManual.length})</span>
                  </div>
                  <button
                    onClick={() => handleCopyColumn('Manual Maintenance WBS Codes', filteredManual)}
                    className="p-1 hover:bg-amber-100 text-amber-700 rounded transition cursor-pointer"
                    title="Copy Manual Maintenance Column"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Table Body (Scrollable) */}
              <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
                {maxDisplayRows > 0 ? (
                  Array.from({ length: maxDisplayRows }).map((_, idx) => (
                    <div key={idx} className="grid grid-cols-3 divide-x divide-slate-100 text-xs font-mono hover:bg-slate-50 transition">
                      {/* OPEX */}
                      <div className="p-2 px-3 flex items-center justify-between text-slate-800">
                        <span>{filteredOpex[idx] || ''}</span>
                        {filteredOpex[idx] && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(filteredOpex[idx]);
                              setCopyToast(`Copied ${filteredOpex[idx]}`);
                              setTimeout(() => setCopyToast(null), 2000);
                            }}
                            className="text-slate-300 hover:text-slate-600 transition p-0.5 cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* CAPEX */}
                      <div className="p-2 px-3 flex items-center justify-between text-slate-800">
                        <span>{filteredCapex[idx] || ''}</span>
                        {filteredCapex[idx] && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(filteredCapex[idx]);
                              setCopyToast(`Copied ${filteredCapex[idx]}`);
                              setTimeout(() => setCopyToast(null), 2000);
                            }}
                            className="text-slate-300 hover:text-slate-600 transition p-0.5 cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Manual Maintenance */}
                      <div className="p-2 px-3 flex items-center justify-between text-slate-800 bg-amber-50/20">
                        <span>{filteredManual[idx] || ''}</span>
                        {filteredManual[idx] && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(filteredManual[idx]);
                              setCopyToast(`Copied ${filteredManual[idx]}`);
                              setTimeout(() => setCopyToast(null), 2000);
                            }}
                            className="text-slate-300 hover:text-slate-600 transition p-0.5 cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No WBS codes matching search filter "{wbsSearchTerm}"
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: UPLOAD / LOAD CJI3 FILE */}
        {activeTab === 'upload' && (
          <div className="space-y-4">
            {/* 1-Click Quick Load Option for capex-export-CJI3.xlsx */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800 block">Source File Quick Ingestion</span>
                  <span className="text-[11px] text-slate-500">
                    Load raw data from root file <code className="text-blue-700 bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono">capex-export-CJI3.xlsx</code>
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleLoadLocalFile('CAPEX CJI3')}
                  disabled={isLoading}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs shadow-xs transition flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Load "CAPEX CJI3" Sheet</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleLoadLocalFile('OPEX CJI3')}
                  disabled={isLoading}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs shadow-xs transition flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Load "OPEX CJI3" Sheet</span>
                </button>
              </div>
            </div>

            {/* Reporting Month & Custom File Upload */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">Target Reporting Month</label>
                <input
                  type="month"
                  value={reportingMonth}
                  onChange={(e) => setReportingMonth(e.target.value)}
                  className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Sheet Selector if file uploaded or sheets available */}
              {availableSheets.length > 0 && (
                <div className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                  <span className="text-xs font-medium text-slate-600">Select Worksheet in Excel File:</span>
                  <select
                    value={selectedSheet}
                    onChange={(e) => handleSheetChange(e.target.value)}
                    className="bg-white text-slate-900 border border-slate-300 text-xs font-semibold rounded-lg px-2.5 py-1 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer"
                  >
                    {availableSheets.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Drag & Drop File Upload */}
              <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50/50 rounded-2xl p-6 text-center transition cursor-pointer relative">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <FileUp className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-800">
                  {file ? file.name : 'Or click to upload another Excel file (.xlsx)'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">Supports standard SAP CJI3 export format</p>
              </div>
            </div>

            {/* Error Alert */}
            {errorMsg && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-3.5 rounded-xl text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Loading Spinner */}
            {isLoading && (
              <div className="py-4 text-center text-xs text-slate-500 font-medium">
                Processing CJI3 worksheet and classifying costs...
              </div>
            )}

            {/* Preview Summary */}
            {previewResult && !isLoading && (
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="font-bold text-slate-800">Worksheet Preview Summary</span>
                  <span className="text-blue-700 font-mono font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                    Sheet: {previewResult.sheetName}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                    <span className="text-slate-400 text-[10px] block">Detail Lines</span>
                    <span className="text-sm font-bold text-slate-900">{previewResult.summary.detailCount}</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                    <span className="text-slate-400 text-[10px] block">Subtotals Skipped</span>
                    <span className="text-sm font-bold text-slate-600">{previewResult.summary.subtotalCount}</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                    <span className="text-slate-400 text-[10px] block">Projects (WBS)</span>
                    <span className="text-sm font-bold text-slate-900">{previewResult.summary.wbsCount}</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                    <span className="text-slate-400 text-[10px] block">Vendors</span>
                    <span className="text-sm font-bold text-slate-900">{previewResult.summary.vendorCount}</span>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-1 font-medium">
                  <div className="flex justify-between text-blue-800 font-bold">
                    <span>External Vendor Total (Manual Entry):</span>
                    <span>{formatEUR(previewResult.summary.totalExternalSpend)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 text-[11px]">
                    <span>Internal Employee Hours (Excluded from entry):</span>
                    <span>{formatEUR(previewResult.summary.totalInternalReclass)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            Close
          </button>
          {activeTab === 'upload' && (
            <button
              type="button"
              disabled={!previewResult || isLoading}
              onClick={handleCommit}
              className="px-5 py-2.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-xs disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Commit Selected Sheet</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
