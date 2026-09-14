import React, { useState, useEffect } from 'react';
import { VendorAlias } from '../types';
import { api } from '../api';
import { Plus, Trash2, X, Building2, CheckCircle2 } from 'lucide-react';

interface VendorManagerModalProps {
  onClose: () => void;
  onAliasesUpdated: () => void;
}

export const VendorManagerModal: React.FC<VendorManagerModalProps> = ({
  onClose,
  onAliasesUpdated,
}) => {
  const [aliases, setAliases] = useState<VendorAlias[]>([]);
  const [rawPattern, setRawPattern] = useState('');
  const [canonicalVendor, setCanonicalVendor] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadAliases();
  }, []);

  const loadAliases = async () => {
    setIsLoading(true);
    try {
      const list = await api.getVendorAliases();
      setAliases(list);
    } catch (e) {
      console.error('Failed to load aliases:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawPattern.trim() || !canonicalVendor.trim()) return;

    try {
      await api.addVendorAlias({
        rawPattern: rawPattern.trim(),
        canonicalVendor: canonicalVendor.trim(),
        notes: notes.trim(),
      });
      setRawPattern('');
      setCanonicalVendor('');
      setNotes('');
      await loadAliases();
      onAliasesUpdated();
    } catch (e) {
      alert('Failed to add vendor alias.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this vendor alias normalization?')) return;
    try {
      await api.deleteVendorAlias(id);
      await loadAliases();
      onAliasesUpdated();
    } catch (e) {
      alert('Failed to delete alias.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8 space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Vendor Alias & Normalization Master</h3>
              <p className="text-xs text-slate-500">Configure canonical vendor names to consolidate SAP truncated strings</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add Form */}
        <form onSubmit={handleAddAlias} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
          <span className="font-bold text-slate-800 block">Add New Vendor Alias Rule</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 font-semibold mb-1">Raw Truncated Pattern (Column J)</label>
              <input
                type="text"
                required
                placeholder="e.g. ERNST & YOUNG CONSUL"
                value={rawPattern}
                onChange={(e) => setRawPattern(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-mono font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-600 font-semibold mb-1">Normalized Canonical Name</label>
              <input
                type="text"
                required
                placeholder="e.g. ERNST & YOUNG CONSULTING"
                value={canonicalVendor}
                onChange={(e) => setCanonicalVendor(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Optional notes or justification..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-xs transition flex items-center space-x-1"
            >
              <Plus className="w-4 h-4" />
              <span>Add Alias</span>
            </button>
          </div>
        </form>

        {/* Existing Aliases Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden text-xs">
          <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 font-bold text-slate-700 flex justify-between items-center">
            <span>Configured Database Normalization Aliases</span>
            <span className="text-slate-500">{aliases.length} Rules Active</span>
          </div>

          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
            {aliases.length === 0 ? (
              <p className="py-6 text-center text-slate-400">No custom vendor alias rules defined.</p>
            ) : (
              aliases.map((a) => (
                <div key={a.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono bg-amber-50 text-amber-800 px-2 py-0.5 rounded text-[11px] font-semibold border border-amber-200">
                        "{a.rawPattern}"
                      </span>
                      <span className="text-slate-400">→</span>
                      <span className="font-bold text-slate-900">{a.canonicalVendor}</span>
                    </div>
                    {a.notes && <p className="text-[11px] text-slate-400">{a.notes}</p>}
                  </div>

                  <button
                    onClick={() => handleDelete(a.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg transition"
                    title="Delete alias rule"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 text-xs shadow-xs"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
