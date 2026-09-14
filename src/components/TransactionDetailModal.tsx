import React, { useState, useEffect } from 'react';
import { CostClassification, ImportedTransaction } from '../types';
import { api } from '../api';
import { X, Search, Filter, Layers, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

interface TransactionDetailModalProps {
  wbs: string;
  snapshotId?: string;
  reportingMonth: string;
  onClose: () => void;
  onTransactionUpdated: () => void;
  isAdmin: boolean;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  wbs,
  snapshotId,
  reportingMonth,
  onClose,
  onTransactionUpdated,
  isAdmin,
}) => {
  const [transactions, setTransactions] = useState<ImportedTransaction[]>([]);
  const [filterClass, setFilterClass] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [overrideTxId, setOverrideTxId] = useState<string | null>(null);

  // Form state for override
  const [overrideClass, setOverrideClass] = useState<CostClassification>('EXTERNAL_VENDOR');
  const [overrideExclude, setOverrideExclude] = useState<boolean>(false);
  const [overrideReason, setOverrideReason] = useState<string>('');

  useEffect(() => {
    loadTransactions();
  }, [wbs, snapshotId]);

  const loadTransactions = async () => {
    setIsLoading(true);
    try {
      const list = await api.getTransactions(snapshotId, wbs);
      setTransactions(list);
    } catch (e) {
      console.error('Failed to load transactions:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveOverride = async (txId: string) => {
    try {
      await api.overrideTransaction(txId, {
        classification: overrideClass,
        isExcluded: overrideExclude,
        reason: overrideReason,
        updatedBy: 'Administrator',
      });
      setOverrideTxId(null);
      await loadTransactions();
      onTransactionUpdated();
    } catch (e) {
      alert('Failed to override transaction classification.');
    }
  };

  const filtered = transactions.filter((t) => {
    if (filterClass !== 'ALL' && t.classification !== filterClass) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchWbs = t.wbs.toLowerCase().includes(q);
      const matchVendor = (t.normalizedVendor || '').toLowerCase().includes(q);
      const matchDesc = (t.nameDescription || '').toLowerCase().includes(q);
      const matchPo = (t.purchasingDoc || '').toLowerCase().includes(q);
      return matchWbs || matchVendor || matchDesc || matchPo;
    }
    return true;
  });

  const formatEUR = (val: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-5xl w-full p-6 shadow-2xl border border-slate-200 my-8 space-y-4 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Calculation & Raw SAP CJI3 Line Item Audit
              </h3>
              <p className="text-xs text-slate-500">
                Inspecting raw source transactions for CAPEX WBS <strong className="text-slate-800">{wbs}</strong> ({reportingMonth})
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200 flex-shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by vendor, PO number, or line description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="ALL">All Classifications</option>
              <option value="EXTERNAL_VENDOR">External Vendor Cost (Planisware Entry)</option>
              <option value="INTERNAL_RECLASS">Internal Hours Reclass (Excluded)</option>
              <option value="CORRECTION_TRANSFER">Correction / Transfer (Excluded)</option>
              <option value="OTHER_NON_PO">Other Non-PO Cost (Review)</option>
            </select>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-y-auto flex-1 border border-slate-200 rounded-xl bg-white">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="py-3 px-3">Row #</th>
                <th className="py-3 px-3">Posting Date</th>
                <th className="py-3 px-3">Purchasing Doc</th>
                <th className="py-3 px-3">Col J Description / Vendor</th>
                <th className="py-3 px-3">Normalized Vendor</th>
                <th className="py-3 px-3 text-right">Amount (EUR)</th>
                <th className="py-3 px-3">Classification</th>
                {isAdmin && <th className="py-3 px-3 text-center">Admin Override</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    Loading CJI3 raw transactions...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No transactions matching filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-3 font-mono text-slate-400">{t.sourceRow}</td>
                    <td className="py-3 px-3 font-mono text-slate-600">{t.postingDate || t.docDate || 'N/A'}</td>
                    <td className="py-3 px-3 font-mono text-slate-800 font-semibold">
                      {t.purchasingDoc || <span className="text-slate-300">No PO</span>}
                    </td>
                    <td className="py-3 px-3 max-w-xs truncate text-slate-800" title={t.nameDescription}>
                      {t.nameDescription}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-900">{t.normalizedVendor}</td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                      {formatEUR(t.valueObjectCurr)}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold border ${
                        t.classification === 'EXTERNAL_VENDOR'
                          ? 'bg-blue-50 text-blue-800 border-blue-200'
                          : t.classification === 'INTERNAL_RECLASS'
                          ? 'bg-slate-100 text-slate-600 border-slate-200'
                          : t.classification === 'CORRECTION_TRANSFER'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-purple-50 text-purple-800 border-purple-200'
                      }`}>
                        {t.classification}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => {
                            setOverrideTxId(t.id);
                            setOverrideClass(t.classification);
                            setOverrideExclude(t.isExcluded);
                            setOverrideReason(t.userOverride?.reason || '');
                          }}
                          className="text-blue-600 hover:text-blue-800 font-bold hover:underline"
                        >
                          Override
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Override Form Popup if active */}
        {overrideTxId && (
          <div className="bg-slate-900 text-white p-4 rounded-xl space-y-3 text-xs animate-in fade-in flex-shrink-0">
            <div className="flex justify-between items-center font-bold">
              <span>Admin Override for Transaction ID: {overrideTxId}</span>
              <button onClick={() => setOverrideTxId(null)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Reclassify As</label>
                <select
                  value={overrideClass}
                  onChange={(e) => setOverrideClass(e.target.value as CostClassification)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 focus:outline-none"
                >
                  <option value="EXTERNAL_VENDOR">EXTERNAL_VENDOR (Manual Entry)</option>
                  <option value="INTERNAL_RECLASS">INTERNAL_RECLASS (Excluded)</option>
                  <option value="CORRECTION_TRANSFER">CORRECTION_TRANSFER (Excluded)</option>
                  <option value="OTHER_NON_PO">OTHER_NON_PO (Review Only)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Exclusion Status</label>
                <select
                  value={overrideExclude ? 'YES' : 'NO'}
                  onChange={(e) => setOverrideExclude(e.target.value === 'YES')}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 focus:outline-none"
                >
                  <option value="NO">Include in calculations</option>
                  <option value="YES">Exclude from calculations</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Audit Justification</label>
                <input
                  type="text"
                  placeholder="Reason for manual classification override..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-1">
              <button
                onClick={() => setOverrideTxId(null)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveOverride(overrideTxId)}
                className="px-4 py-1.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-500"
              >
                Save Override
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 text-xs shadow-xs"
          >
            Close Audit Inspector
          </button>
        </div>

      </div>
    </div>
  );
};
