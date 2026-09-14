import React, { useState, useEffect } from 'react';
import { User, WBSMonthlySummary, Project } from './types';
import { api } from './api';
import { Navbar } from './components/Navbar';
import { PMScreen } from './components/PMScreen';
import { AdminProjectsView } from './components/AdminProjectsView';
import { AdminUploadModal } from './components/AdminUploadModal';
import { VendorManagerModal } from './components/VendorManagerModal';
import { TransactionDetailModal } from './components/TransactionDetailModal';
import { TestRunnerModal } from './components/TestRunnerModal';

export default function App() {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-09');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>('CAPEX CJI3');
  const [activeTab, setActiveTab] = useState<'pm' | 'admin'>('pm');

  const [summaries, setSummaries] = useState<WBSMonthlySummary[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedWbs, setSelectedWbs] = useState<string>('');

  // Modals
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [showVendorModal, setShowVendorModal] = useState<boolean>(false);
  const [showTestModal, setShowTestModal] = useState<boolean>(false);
  const [inspectWbs, setInspectWbs] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);

  useEffect(() => {
    initAppData();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadMonthSummaries();
    }
  }, [selectedMonth, currentUser]);

  const initAppData = async () => {
    setIsLoading(true);
    try {
      const uList = await api.getUsers();
      setUsers(uList);
      const defaultUser = uList.find((u) => u.id === 'usr-pm-sarah') || uList[0];
      setCurrentUser(defaultUser);

      const mList = await api.getAvailableMonths();
      setAvailableMonths(mList);
      if (mList.length > 0) {
        setSelectedMonth(mList[0]);
      }

      const pList = await api.getProjects();
      setProjects(pList);
    } catch (e) {
      console.error('Failed to initialize app data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSheet = async (sheet: string) => {
    setActiveSheet(sheet);
    setIsLoading(true);
    try {
      await api.loadLocalSnapshot(selectedMonth, sheet);
      const pList = await api.getProjects();
      setProjects(pList);
      await loadMonthSummaries();
    } catch (e) {
      console.error('Failed to load sheet:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMonthSummaries = async () => {
    if (!currentUser) return;
    setIsCalculating(true);
    try {
      const pmFilter = currentUser.role === 'pm' ? currentUser.id : undefined;
      const res = await api.getPmSummary(selectedMonth, pmFilter);
      setSummaries(res.summaries);

      if (res.summaries.length > 0 && (!selectedWbs || !res.summaries.some((s) => s.wbs === selectedWbs))) {
        setSelectedWbs(res.summaries[0].wbs);
      }
    } catch (e) {
      console.error('Failed to load month summaries:', e);
    } finally {
      setTimeout(() => setIsCalculating(false), 200);
    }
  };

  const handleMarkProcessed = async (data: {
    wbs: string;
    reportingMonth: string;
    planiswareRef?: string;
    comment?: string;
    confirmedBy: string;
  }) => {
    await api.processPmEntry(data);
    await loadMonthSummaries();
  };

  const handleExportExcel = () => {
    window.open(`/api/export/excel?month=${selectedMonth}`, '_blank');
  };

  if (isLoading || !currentUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-bold text-slate-600">Loading Planisware CAPEX System...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans antialiased selection:bg-blue-100 selection:text-blue-900">
      
      {/* Main View Area */}
      <main className="py-6">
        {activeTab === 'pm' ? (
          <PMScreen
            currentUser={currentUser}
            reportingMonth={selectedMonth}
            availableMonths={availableMonths}
            isCalculating={isCalculating}
            onMonthChange={setSelectedMonth}
            summaries={summaries}
            selectedWbs={selectedWbs}
            onSelectWbs={setSelectedWbs}
            onMarkProcessed={handleMarkProcessed}
            onExportExcel={handleExportExcel}
            onOpenUploadModal={() => setShowUploadModal(true)}
            onViewCalculationDetails={(wbs) => setInspectWbs(wbs)}
          />
        ) : (
          <AdminProjectsView
            reportingMonth={selectedMonth}
            summaries={summaries}
            projects={projects}
            users={users}
            onRefresh={loadMonthSummaries}
            onOpenVendorManager={() => setShowVendorModal(true)}
            onOpenUploadModal={() => setShowUploadModal(true)}
            onViewTransactions={(wbs) => setInspectWbs(wbs)}
          />
        )}
      </main>

      {/* MODAL 1: Upload CJI3 Extract */}
      {showUploadModal && (
        <AdminUploadModal
          currentUserId={currentUser.id}
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            loadMonthSummaries();
          }}
        />
      )}

      {/* MODAL 2: Vendor Alias Normalization Master */}
      {showVendorModal && (
        <VendorManagerModal
          onClose={() => setShowVendorModal(false)}
          onAliasesUpdated={loadMonthSummaries}
        />
      )}

      {/* MODAL 3: Transaction Detail Audit Inspector */}
      {inspectWbs && (
        <TransactionDetailModal
          wbs={inspectWbs}
          reportingMonth={selectedMonth}
          isAdmin={currentUser.role === 'admin'}
          onClose={() => setInspectWbs(null)}
          onTransactionUpdated={loadMonthSummaries}
        />
      )}

      {/* MODAL 4: Automated Test Runner */}
      {showTestModal && (
        <TestRunnerModal onClose={() => setShowTestModal(false)} />
      )}

    </div>
  );
}
