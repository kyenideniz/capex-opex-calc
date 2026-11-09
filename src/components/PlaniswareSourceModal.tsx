import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { PlaniswareSourceStatus } from '../types';
import {
  FileSpreadsheet,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  Search,
  Layers,
  FolderOpen,
  ArrowRight,
  Database,
  Info,
} from 'lucide-react';

interface PlaniswareSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplied?: () => void;
}

export const PlaniswareSourceModal: React.FC<PlaniswareSourceModalProps> = ({
  isOpen,
  onClose,
  onApplied,
}) => {
  const [status, setStatus] = useState<PlaniswareSourceStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadMsg, setUploadMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadStatus();
    }
  }, [isOpen]);

  const loadStatus = async () => {
    setIsLoading(true);
    try {
      const data = await api.getPlaniswareStatus();
      setStatus(data);
    } catch (err: any) {
      setUploadMsg({ type: 'error', text: err.message || 'Failed loading Planisware source status.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsLoading(true);
    setUploadMsg(null);
    try {
      const res = await api.uploadPlaniswareSource(file);
      setUploadMsg({
        type: 'success',
        text: `Successfully processed ${res.filename}! Mapped ${res.totalMapped} WBS codes and updated ${res.updatedProjectsCount} project records.`,
      });
      setStatus(res.status);
      if (onApplied) onApplied();
    } catch (err: any) {
      setUploadMsg({
        type: 'error',
        text: err.message || 'Error processing Planisware export file.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleReload = async () => {
    setIsLoading(true);
    setUploadMsg(null);
    try {
      const res = await api.reloadPlaniswareSource();
      setUploadMsg({
        type: 'success',
        text: `Reloaded ${res.syncResult.filename}. Mapped ${res.syncResult.totalMapped} codes.`,
      });
      setStatus(res.status);
      if (onApplied) onApplied();
    } catch (err: any) {
      setUploadMsg({
        type: 'error',
        text: err.message || 'Failed to scan root directory for Planisware export.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const filteredProjects = (status?.projects || []).filter((p) => {
    const term = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      (p.capexId && p.capexId.toLowerCase().includes(term)) ||
      (p.opexId && p.opexId.toLowerCase().includes(term)) ||
      p.projectId.toLowerCase().includes(term)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in duration-200">
        
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center space-x-2">
                <span>Planisware Projects & Codes Source Mapping</span>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 font-mono px-2 py-0.5 rounded-full border border-blue-400/30">
                  export-809912-2109-20261101-191220.xlsx
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Matches SAP CJI3 WBS actuals against official Planisware Project names & codes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          
          {/* Status & Guidance Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                {status?.fileExists ? (
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="p-2 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-slate-800">Target Source File:</span>
                    <code className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      export-809912-2109-20261101-191220.xlsx
                    </code>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {status?.fileExists
                      ? 'File detected on server root. Project codes and names are actively mapped.'
                      : 'File not yet uploaded to server root. You can upload it below or place it in the workspace root.'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleReload}
                  disabled={isLoading}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl shadow-xs transition flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                  title="Rescan root directory for the file"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>Rescan Server Root</span>
                </button>
              </div>
            </div>

            {/* Path Guidance Banner */}
            <div className="bg-white border border-slate-200 rounded-xl p-3 text-xs text-slate-600 space-y-1.5">
              <div className="flex items-center space-x-1.5 font-bold text-slate-800">
                <FolderOpen className="w-4 h-4 text-blue-600" />
                <span>Where to upload / place the file:</span>
              </div>
              <p className="text-slate-600 leading-relaxed pl-5">
                • <strong>In-Browser Upload (Easiest):</strong> Drag & drop your file into the upload box below.<br />
                • <strong>Server Root:</strong> Place the file at <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-mono">/export-809912-2109-20261101-191220.xlsx</code> (or in <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded font-mono">/data/</code>).
              </p>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Mapped Codes</span>
                <span className="text-lg font-black text-slate-900">{status?.totalMappedCodes || 0}</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Identified Projects</span>
                <span className="text-lg font-black text-blue-600">{status?.totalProjects || 0}</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Active Source</span>
                <span className="text-xs font-bold text-slate-800 truncate block mt-1" title={status?.activeSourceFile}>
                  {status?.activeSourceFile || 'None'}
                </span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Last Synchronized</span>
                <span className="text-xs font-medium text-slate-600 block mt-1">
                  {status?.lastLoadedAt ? new Date(status.lastLoadedAt).toLocaleTimeString() : 'Baseline'}
                </span>
              </div>
            </div>
          </div>

          {/* Upload Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const droppedFiles = e.dataTransfer.files;
              if (droppedFiles.length > 0) {
                handleFileUpload(droppedFiles[0]);
              }
            }}
            className={`border-2 border-dashed rounded-2xl p-6 text-center transition ${
              isDragging
                ? 'border-blue-500 bg-blue-50/50'
                : 'border-slate-300 hover:border-slate-400 bg-white'
            }`}
          >
            <div className="max-w-md mx-auto space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-900 block">
                  Upload Planisware Project Export Excel
                </span>
                <p className="text-xs text-slate-500 mt-1">
                  Drop <strong className="text-slate-800">export-809912-2109-20261101-191220.xlsx</strong> here or click to browse
                </p>
              </div>

              <label className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl shadow-xs transition cursor-pointer">
                <span>Select File from Computer</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />
              </label>
            </div>
          </div>

          {/* Feedback Message */}
          {uploadMsg && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center space-x-2 ${
                uploadMsg.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {uploadMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{uploadMsg.text}</span>
            </div>
          )}

          {/* Mapped Projects Preview */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-slate-900">
                  Preview Matched Projects & Codes ({filteredProjects.length})
                </h4>
                <p className="text-[11px] text-slate-500">
                  WBS Element codes linked to Planisware initiative titles
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search project name or code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3">CAPEX WBS</th>
                    <th className="py-2.5 px-3">OPEX WBS</th>
                    <th className="py-2.5 px-3">Matched Planisware Project Name</th>
                    <th className="py-2.5 px-3 text-right">Budget (EUR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredProjects.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400 text-xs">
                        No projects matching search term "{searchTerm}".
                      </td>
                    </tr>
                  ) : (
                    filteredProjects.slice(0, 100).map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition">
                        <td className="py-2 px-3 font-mono font-bold text-slate-900">
                          {p.capexId || <span className="text-slate-400 font-normal italic">—</span>}
                        </td>
                        <td className="py-2 px-3 font-mono font-semibold text-slate-600">
                          {p.opexId || <span className="text-slate-400 font-normal italic">—</span>}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-800">
                          {p.name}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-700">
                          {p.budgetEUR ? `€${p.budgetEUR.toLocaleString('de-DE')}` : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-1.5 text-xs text-slate-500">
            <Info className="w-4 h-4 text-blue-500" />
            <span>Updates are immediately reflected across PM and Admin screens</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl shadow-xs transition cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
