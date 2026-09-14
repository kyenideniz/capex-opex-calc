import React, { useState } from 'react';
import { Project, User, WBSMonthlySummary } from '../types';
import { api } from '../api';
import {
  Building2,
  Download,
  Edit2,
  FileSpreadsheet,
  Layers,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  UserCheck,
  AlertTriangle,
} from 'lucide-react';

interface AdminProjectsViewProps {
  reportingMonth: string;
  summaries: WBSMonthlySummary[];
  projects: Project[];
  users: User[];
  onRefresh: () => void;
  onOpenVendorManager: () => void;
  onOpenUploadModal: () => void;
  onViewTransactions: (wbs: string) => void;
}

export const AdminProjectsView: React.FC<AdminProjectsViewProps> = ({
  reportingMonth,
  summaries,
  projects,
  users,
  onRefresh,
  onOpenVendorManager,
  onOpenUploadModal,
  onViewTransactions,
}) => {
  const [editingWbs, setEditingWbs] = useState<string | null>(null);
  const [editPmId, setEditPmId] = useState<string>('');
  const [editBudget, setEditBudget] = useState<string>('');

  const pmUsers = users.filter((u) => u.role === 'pm' || u.role === 'admin');

  const handleSaveProject = async (wbs: string) => {
    try {
      const targetPm = users.find((u) => u.id === editPmId);
      await api.updateProject(wbs, {
        assignedPmId: editPmId,
        assignedPmName: targetPm ? targetPm.name : undefined,
        budgetEUR: parseFloat(editBudget) || 0,
      });
      setEditingWbs(null);
      onRefresh();
    } catch (e) {
      alert('Failed to update project configuration.');
    }
  };

  const handleReopenMonth = async (snapshotId: string) => {
    if (!confirm(`Are you sure you want to reopen snapshot ${snapshotId}?`)) return;
    try {
      await api.reopenSnapshot(snapshotId, 'usr-admin');
      onRefresh();
    } catch (e) {
      alert('Failed to reopen snapshot.');
    }
  };

  const formatEUR = (val: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(val);
  };

  const handleExportReconciliation = () => {
    window.open(`/api/export/reconciliation?month=${reportingMonth}`, '_blank');
  };

  const handleExportPlanisware = () => {
    window.open(`/api/export/excel?month=${reportingMonth}`, '_blank');
  };

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-6">
      
      {/* Governance Header Bar */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-6 h-6 text-blue-400" />
            <h1 className="text-xl font-bold tracking-tight text-white">Administrator Governance Dashboard</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Global CAPEX WBS controls, PM assignments, budget limits, vendor alias normalizations, and month close control
          </p>
        </div>

        {/* Global Admin Tools */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onOpenVendorManager}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center space-x-1.5"
          >
            <Building2 className="w-4 h-4 text-amber-400" />
            <span>Vendor Aliases</span>
          </button>

          <button
            onClick={handleExportPlanisware}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center space-x-1.5"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export Planisware Instructions</span>
          </button>

          <button
            onClick={handleExportReconciliation}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition flex items-center space-x-1.5"
          >
            <FileSpreadsheet className="w-4 h-4 text-blue-400" />
            <span>Export Reconciliation Audit</span>
          </button>
        </div>
      </div>

      {/* Overview WBS Projects Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">CAPEX WBS Projects & Snapshot Balances</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Reporting Month: <strong className="text-slate-800">{reportingMonth}</strong>
            </p>
          </div>
          <button
            onClick={onRefresh}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center space-x-1 font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Data</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">CAPEX WBS</th>
                <th className="py-3.5 px-4">Project Name</th>
                <th className="py-3.5 px-4">Assigned PM</th>
                <th className="py-3.5 px-4 text-right">Budget (EUR)</th>
                <th className="py-3.5 px-4 text-right">Prev Balance</th>
                <th className="py-3.5 px-4 text-right">Monthly Change</th>
                <th className="py-3.5 px-4 text-right">New Balance</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {summaries.map((s) => {
                const proj = projects.find((p) => p.wbs === s.wbs);
                const isEditing = editingWbs === s.wbs;

                return (
                  <tr key={s.wbs} className="hover:bg-slate-50 transition">
                    <td className="py-4 px-4 font-mono font-bold text-slate-900">{s.wbs}</td>
                    <td className="py-4 px-4 font-semibold text-slate-800">{s.projectName}</td>
                    
                    {/* Assigned PM */}
                    <td className="py-4 px-4">
                      {isEditing ? (
                        <select
                          value={editPmId}
                          onChange={(e) => setEditPmId(e.target.value)}
                          className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">-- Select PM --</option>
                          {pmUsers.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-slate-800 font-semibold">{s.assignedPmName || 'Unassigned'}</span>
                      )}
                    </td>

                    {/* Budget */}
                    <td className="py-4 px-4 text-right font-mono">
                      {isEditing ? (
                        <input
                          type="number"
                          value={editBudget}
                          onChange={(e) => setEditBudget(e.target.value)}
                          className="w-28 bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-right"
                        />
                      ) : (
                        <span>{s.budgetEUR ? formatEUR(s.budgetEUR) : 'Not Set'}</span>
                      )}
                    </td>

                    <td className="py-4 px-4 text-right font-mono text-slate-600">{formatEUR(s.previousBalance)}</td>
                    
                    <td className={`py-4 px-4 text-right font-mono font-bold ${
                      s.addThisMonth < 0 ? 'text-amber-700' : s.addThisMonth > 0 ? 'text-blue-700' : 'text-slate-600'
                    }`}>
                      {s.addThisMonth > 0 ? `+${formatEUR(s.addThisMonth)}` : formatEUR(s.addThisMonth)}
                    </td>

                    <td className="py-4 px-4 text-right font-mono font-bold text-slate-900">{formatEUR(s.newBalance)}</td>

                    <td className="py-4 px-4 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        s.processingStatus === 'Processed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {s.processingStatus}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        {isEditing ? (
                          <button
                            onClick={() => handleSaveProject(s.wbs)}
                            className="px-2.5 py-1 bg-blue-600 text-white rounded-lg font-bold text-[11px]"
                          >
                            Save
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingWbs(s.wbs);
                              setEditPmId(proj?.assignedPmId || '');
                              setEditBudget(String(proj?.budgetEUR || 0));
                            }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg"
                            title="Edit PM assignment & budget"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}

                        <button
                          onClick={() => onViewTransactions(s.wbs)}
                          className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg"
                          title="Inspect raw CJI3 transactions"
                        >
                          <Layers className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
