import {
  AuditLogEntry,
  ImportedTransaction,
  MonthCloseConfirmation,
  MonthlySnapshot,
  ParseResult,
  Project,
  TestCaseResult,
  User,
  VendorAlias,
  WBSMonthlySummary,
} from './types';

const API_BASE = '';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    let msg = 'API request failed';
    try {
      const errData = await res.json();
      msg = errData.error || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  getUsers: () => fetchJson<User[]>(`${API_BASE}/api/auth/users`),
  
  getAvailableMonths: () => fetchJson<string[]>(`${API_BASE}/api/months`),

  getSnapshots: () => fetchJson<MonthlySnapshot[]>(`${API_BASE}/api/snapshots`),

  uploadPreview: async (file: File, sheetName?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (sheetName) formData.append('sheetName', sheetName);
    return fetchJson<ParseResult>(`${API_BASE}/api/snapshots/upload-preview`, {
      method: 'POST',
      body: formData,
    });
  },

  commitSnapshot: async (file: File, reportingMonth: string, uploadedBy: string, sheetName?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('reportingMonth', reportingMonth);
    formData.append('uploadedBy', uploadedBy);
    if (sheetName) formData.append('sheetName', sheetName);

    return fetchJson<{ snapshot: MonthlySnapshot; parseResult: ParseResult }>(
      `${API_BASE}/api/snapshots/commit`,
      {
        method: 'POST',
        body: formData,
      }
    );
  },

  loadLocalSnapshot: async (reportingMonth: string, sheetName: string) => {
    return fetchJson<{ snapshot: MonthlySnapshot; parseResult: ParseResult }>(
      `${API_BASE}/api/snapshots/load-local`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportingMonth, sheetName }),
      }
    );
  },

  reopenSnapshot: (snapshotId: string, userId: string) =>
    fetchJson<MonthlySnapshot>(`${API_BASE}/api/snapshots/reopen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshotId, userId }),
    }),

  getPmSummary: (month: string, pmId?: string) => {
    const query = new URLSearchParams({ month });
    if (pmId) query.append('pmId', pmId);
    return fetchJson<{
      reportingMonth: string;
      previousMonth: string | null;
      currentSnapshotId: string | null;
      previousSnapshotId: string | null;
      summaries: WBSMonthlySummary[];
    }>(`${API_BASE}/api/pm/summary?${query.toString()}`);
  },

  processPmEntry: (data: {
    wbs: string;
    reportingMonth: string;
    planiswareRef?: string;
    comment?: string;
    confirmedBy: string;
    vendorAmounts?: Record<string, number>;
  }) =>
    fetchJson<MonthCloseConfirmation>(`${API_BASE}/api/pm/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  getProjects: () => fetchJson<Project[]>(`${API_BASE}/api/projects`),

  updateProject: (wbs: string, updates: Partial<Project>) =>
    fetchJson<Project>(`${API_BASE}/api/projects/${encodeURIComponent(wbs)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }),

  getVendorAliases: () => fetchJson<VendorAlias[]>(`${API_BASE}/api/vendors/aliases`),

  addVendorAlias: (alias: { rawPattern: string; canonicalVendor: string; notes?: string; createdBy?: string }) =>
    fetchJson<VendorAlias>(`${API_BASE}/api/vendors/aliases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alias),
    }),

  deleteVendorAlias: (id: string) =>
    fetchJson<{ success: boolean }>(`${API_BASE}/api/vendors/aliases/${id}`, {
      method: 'DELETE',
    }),

  getTransactions: (snapshotId?: string, wbs?: string) => {
    const params = new URLSearchParams();
    if (snapshotId) params.append('snapshotId', snapshotId);
    if (wbs) params.append('wbs', wbs);
    return fetchJson<ImportedTransaction[]>(`${API_BASE}/api/transactions?${params.toString()}`);
  },

  overrideTransaction: (
    id: string,
    data: { classification?: string; isExcluded?: boolean; reason?: string; updatedBy?: string }
  ) =>
    fetchJson<ImportedTransaction>(`${API_BASE}/api/transactions/${id}/override`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),

  getAuditLogs: () => fetchJson<AuditLogEntry[]>(`${API_BASE}/api/audit-logs`),

  runTests: () =>
    fetchJson<{
      total: number;
      passed: number;
      failed: number;
      results: TestCaseResult[];
    }>(`${API_BASE}/api/tests/run`),
};
