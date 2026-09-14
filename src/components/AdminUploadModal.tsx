import React, { useState } from 'react';
import { ParseResult } from '../types';
import { api } from '../api';
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Upload,
  X,
  FileUp,
  Download,
  Layers,
} from 'lucide-react';

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
  const [reportingMonth, setReportingMonth] = useState('2026-09');
  const [file, setFile] = useState<File | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('CAPEX CJI3');
  const [availableSheets, setAvailableSheets] = useState<string[]>(['CAPEX CJI3', 'OPEX CJI3']);
  const [isLoading, setIsLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<ParseResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8 space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Upload / Load CJI3 Excel Extract</h3>
              <p className="text-xs text-slate-500">Import SAP CJI3 Excel file or parse the source capex-export-CJI3.xlsx</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1-Click Quick Load Option for capex-export-CJI3.xlsx */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-800 block">Source File Quick Ingestion</span>
              <span className="text-[11px] text-slate-500">Load raw data from root file <code className="text-blue-700 bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono">capex-export-CJI3.xlsx</code></span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleLoadLocalFile('CAPEX CJI3')}
              disabled={isLoading}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs shadow-xs transition flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Load "CAPEX CJI3" Sheet</span>
            </button>

            <button
              type="button"
              onClick={() => handleLoadLocalFile('OPEX CJI3')}
              disabled={isLoading}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs shadow-xs transition flex items-center justify-center space-x-2 disabled:opacity-50"
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
            <p className="text-[11px] text-slate-400 mt-1">
              Supports standard SAP CJI3 export format
            </p>
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

        {/* Modal Footer */}
        <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!previewResult || isLoading}
            onClick={handleCommit}
            className="px-5 py-2.5 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-xs disabled:opacity-50 flex items-center space-x-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Commit Selected Sheet</span>
          </button>
        </div>

      </div>
    </div>
  );
};
