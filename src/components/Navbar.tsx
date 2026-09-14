import React from 'react';
import { User } from '../types';
import { FileSpreadsheet, FlaskConical, ShieldCheck, UserCheck, Download } from 'lucide-react';

interface NavbarProps {
  users: User[];
  currentUser: User;
  onSelectUser: (user: User) => void;
  selectedMonth: string;
  onChangeMonth: (month: string) => void;
  activeSheet: string;
  onSelectSheet: (sheet: string) => void;
  onOpenTestRunner: () => void;
  onOpenUploadModal: () => void;
  activeTab: 'pm' | 'admin';
  onTabChange: (tab: 'pm' | 'admin') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  users,
  currentUser,
  onSelectUser,
  selectedMonth,
  onChangeMonth,
  activeSheet,
  onSelectSheet,
  onOpenTestRunner,
  onOpenUploadModal,
  activeTab,
  onTabChange,
}) => {
  const months = ['2026-08', '2026-09', '2026-10', '2026-11', '2026-12'];

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Application Title */}
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-lg text-white font-bold flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-white block">Planisware Actuals</span>
              <span className="text-xs text-slate-400 font-medium block">Monthly CJI3 Engine</span>
            </div>
          </div>

          {/* Sheet Selector Pills (CAPEX CJI3 vs OPEX CJI3) */}
          <div className="flex items-center space-x-1.5 bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => onSelectSheet('CAPEX CJI3')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                activeSheet === 'CAPEX CJI3'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              CAPEX CJI3
            </button>
            <button
              onClick={() => onSelectSheet('OPEX CJI3')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                activeSheet === 'OPEX CJI3'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              OPEX CJI3
            </button>
          </div>

          {/* Controls: Month Selector, Upload, Role Switcher */}
          <div className="flex items-center space-x-3">
            {/* Reporting Month Selector */}
            <div className="flex items-center space-x-1.5 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
              <span className="text-slate-400 font-medium">Month:</span>
              <select
                value={selectedMonth}
                onChange={(e) => onChangeMonth(e.target.value)}
                className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
              >
                {months.map((m) => (
                  <option key={m} value={m} className="bg-slate-900 text-white">
                    {m} {m === '2026-08' ? '(M1)' : m === '2026-09' ? '(M2)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Upload CJI3 Button */}
            <button
              onClick={onOpenUploadModal}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-xs transition flex items-center space-x-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Upload / Load File</span>
            </button>

            {/* View Switcher (PM vs Admin) */}
            <div className="flex items-center space-x-1 bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs">
              <button
                onClick={() => onTabChange('pm')}
                className={`px-2.5 py-1 font-semibold rounded-lg transition ${
                  activeTab === 'pm' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                PM
              </button>
              {currentUser.role === 'admin' && (
                <button
                  onClick={() => onTabChange('admin')}
                  className={`px-2.5 py-1 font-semibold rounded-lg transition ${
                    activeTab === 'admin' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Admin
                </button>
              )}
            </div>

            {/* Test Runner */}
            <button
              onClick={onOpenTestRunner}
              className="bg-purple-950/80 hover:bg-purple-900 text-purple-200 border border-purple-800 text-xs font-semibold px-2.5 py-1.5 rounded-xl transition flex items-center space-x-1"
              title="Run Automated Tests"
            >
              <FlaskConical className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Tests</span>
            </button>

            {/* User Switcher */}
            <select
              value={currentUser.id}
              onChange={(e) => {
                const target = users.find((u) => u.id === e.target.value);
                if (target) {
                  onSelectUser(target);
                  if (target.role === 'pm' && activeTab === 'admin') {
                    onTabChange('pm');
                  }
                }
              }}
              className="bg-slate-800 text-xs text-slate-200 border border-slate-700 rounded-xl px-2.5 py-1.5 font-medium focus:outline-none cursor-pointer"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id} className="bg-slate-900 text-white">
                  {u.name} ({u.role.toUpperCase()})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </header>
  );
};
