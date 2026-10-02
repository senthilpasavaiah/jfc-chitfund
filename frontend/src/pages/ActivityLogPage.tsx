import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

interface ActivityRow {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  actor_name: string | null;
  actor_phone: string | null;
  actor_role: string | null;
}
interface ActivityResponse {
  data: ActivityRow[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
  filters: { actions: string[]; modules: string[]; users: { id: string; name: string }[] };
}

const ACTION_LABELS: Record<string, string> = {
  USER_LOGIN: 'Signed in', USER_LOGIN_FAILED: 'Failed login', LOGOUT: 'Signed out', PASSWORD_CHANGE: 'Changed password',
  MEMBER_CREATE: 'Created member', MEMBER_UPDATE: 'Updated member', MEMBER_DEACTIVATE: 'Deactivated member', MEMBER_PASSWORD_RESET: 'Reset member password',
  CHIT_CREATE: 'Created chit', CHIT_DELETE: 'Deleted chit', CHIT_REF_UPDATE: 'Updated chit reference', CHIT_MEMBERS_ADD: 'Added chit members', CHIT_MEMBER_REMOVE: 'Removed chit member',
  CHIT_JOIN: 'Joined chit', CHIT_LEAVE: 'Left chit', CHIT_PAYMENT_TOGGLE: 'Updated chit payment', CHIT_PAYMENT_MARK_ALL: 'Marked all payments', CHIT_DRAW_ASSIGN: 'Assigned drawer', CHIT_DRAW_RECALL: 'Changed/recalled drawer', CHIT_SHUFFLE: 'Shuffled drawer',
  PAYMENT_CREATE: 'Recorded payment', PAYMENT_MARK_MANUAL: 'Marked payment manually', PAYMENT_PROOF_SUBMIT: 'Submitted payment proof', PAYMENT_PROOF_REVIEW: 'Reviewed payment proof',
  EXPENSE_CREATE: 'Added expense', EXPENSE_UPDATE: 'Updated expense', EXPENSE_DELETE: 'Deleted expense',
  DONATION_ADD: 'Added donation', DONATION_UPDATE: 'Updated donation', SANTHA_ADD: 'Added Santha', SANTHA_UPDATE: 'Updated Santha', SETTLEMENT_YEAR_ADD: 'Added settlement year',
  NOTIFICATION_CREATE: 'Created notification', NOTIFICATION_DELETE: 'Deleted notification', DOCUMENT_UPLOAD: 'Uploaded document', DOCUMENT_DELETE: 'Deleted document',
  ADMIN_GRANT: 'Granted admin access', ADMIN_REVOKE: 'Revoked admin access',
  PAGE_VIEW: 'Viewed page',
};

function actionLabel(action: string) {
  return ACTION_LABELS[action] || action.replaceAll('_', ' ').toLowerCase().replace(/(^| )\\w/g, (c) => c.toUpperCase());
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
function prettyModule(value: string) {
  return value.replaceAll('_', ' ').replace(/(^| )\\w/g, (c) => c.toUpperCase());
}
function escapeCsv(value: unknown) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}
function riskFor(action: string) {
  if (/(DELETE|DEACTIVATE|PASSWORD_RESET|ADMIN_GRANT|ADMIN_REVOKE|DRAW_RECALL)/.test(action)) return 'HIGH';
  if (/(UPDATE|PAYMENT|PROOF_REVIEW|MARK_ALL|SHUFFLE)/.test(action)) return 'MEDIUM';
  return 'LOW';
}
function riskClass(risk: string) {
  return risk === 'HIGH' ? 'bg-red-50 text-red-700 border-red-200' : risk === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200';
}
function metadataObject(metadata: Record<string, unknown> | null) {
  return metadata && typeof metadata === 'object' ? metadata : {};
}
function durationLabel(ms: unknown) { const n = Math.max(0, Number(ms) || 0); if (n < 1000) return '—'; const total = Math.round(n / 1000); const m = Math.floor(total / 60); const s = total % 60; if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`; return m ? `${m}m ${s}s` : `${s}s`; }
function pagePath(row: ActivityRow) { const m = metadataObject(row.metadata); return String(m.path || row.entity_id || '—'); }
function humanDetails(row: ActivityRow) {
  const metadata = metadataObject(row.metadata);
  const name = metadata.memberName || metadata.member_name || metadata.name;
  const chit = metadata.chitName || metadata.chit_name;
  const month = metadata.monthNumber || metadata.month_number;
  const amount = metadata.amount;
  const page = metadata.path;
  const duration = metadata.durationMs;

  const parts: string[] = [];
  if (page) parts.push(`Page: ${String(page)}`);
  if (duration) parts.push(`Time: ${durationLabel(duration)}`);
  if (name) parts.push(`Member: ${String(name)}`);
  if (chit) parts.push(`Chit: ${String(chit)}`);
  if (month) parts.push(`Month: ${String(month)}`);
  if (amount !== undefined) parts.push(`Amount: ₹${String(amount)}`);

  return parts.length > 0 ? parts.join(' • ') : 'No additional summary was recorded.';
}
function getBeforeAfter(metadata: Record<string, unknown> | null) {
  const m = metadataObject(metadata);
  const before = m.before ?? m.old ?? m.previous ?? null;
  const after = m.after ?? m.new ?? m.current ?? null;
  return { before, after };
}
function jsonBlock(value: unknown) {
  return value == null ? '—' : JSON.stringify(value, null, 2);
}


export default function ActivityLogPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [filters, setFilters] = useState<ActivityResponse['filters']>({ actions: [], modules: [], users: [] });
  const [pagination, setPagination] = useState<ActivityResponse['pagination']>({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [module, setModule] = useState('');
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<ActivityRow | null>(null);

  const query = useMemo(() => ({ search, action, module, userId, from, to, page: pagination.page, pageSize: pagination.pageSize }), [search, action, module, userId, from, to, pagination.page, pagination.pageSize]);

  async function load() {
    setLoading(true); setError('');
    try {
      const res = await client.get<ActivityResponse>('/activity-log', { params: query });
      setRows(res.data.data); setFilters(res.data.filters); setPagination(res.data.pagination);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load activity log.');
    } finally { setLoading(false); }
  }

  useEffect(() => { if (user?.role === 'ADMIN') load(); }, [query, user?.role]);

  function resetFilters() {
    setSearch(''); setAction(''); setModule(''); setUserId(''); setFrom(''); setTo(''); setPagination((p) => ({ ...p, page: 1 }));
  }

  function exportCsv() {
    const header = ['Date & Time', 'User', 'Action', 'Module', 'Page', 'Time Spent', 'Record ID', 'IP Address', 'Details'];
    const lines = rows.map((r) => [formatDate(r.created_at), r.actor_name || r.actor_phone || 'Unknown', actionLabel(r.action), prettyModule(r.entity_type), pagePath(r), durationLabel(metadataObject(r.metadata).durationMs), r.entity_id || '', r.ip_address || '', r.metadata ? JSON.stringify(r.metadata) : ''].map(escapeCsv).join(','));
    const blob = new Blob([[header.map(escapeCsv).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `jfc-activity-log-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  if (user?.role !== 'ADMIN') return <div className="ledger-card p-6"><h2 className="font-bold text-lg">Access restricted</h2><p className="text-sm text-ink-muted mt-1">Activity Log is available to administrators only.</p></div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div><h2 className="text-xl font-bold text-ink">User Activity Log</h2><p className="text-sm text-ink-muted mt-1">See who changed what, when, and where in the system.</p></div>
        <button onClick={exportCsv} disabled={!rows.length} className="border border-line bg-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-paper disabled:opacity-50 cursor-pointer">Export CSV</button>
      </div>

      <div className="ledger-card p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }} placeholder="Search user, action, record..." className="lg:col-span-2 border border-line rounded-lg px-3 py-2 text-sm outline-none focus:border-navy" />
          <select value={module} onChange={(e) => { setModule(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }} className="border border-line rounded-lg px-3 py-2 text-sm bg-white"><option value="">All modules</option>{filters.modules.map((x) => <option key={x}>{x}</option>)}</select>
          <select value={action} onChange={(e) => { setAction(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }} className="border border-line rounded-lg px-3 py-2 text-sm bg-white"><option value="">All actions</option>{filters.actions.map((x) => <option key={x}>{x}</option>)}</select>
          <select value={userId} onChange={(e) => { setUserId(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }} className="border border-line rounded-lg px-3 py-2 text-sm bg-white"><option value="">All users</option>{filters.users.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          <button onClick={resetFilters} className="border border-line rounded-lg px-3 py-2 text-sm font-semibold bg-white hover:bg-paper cursor-pointer">Clear filters</button>
          <label className="text-xs text-ink-muted">From<input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }} className="block w-full border border-line rounded-lg px-3 py-2 text-sm text-ink mt-1" /></label>
          <label className="text-xs text-ink-muted">To<input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }} className="block w-full border border-line rounded-lg px-3 py-2 text-sm text-ink mt-1" /></label>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-ink-muted"><span>{pagination.total.toLocaleString('en-IN')} activities</span><span>Showing {rows.length ? ((pagination.page - 1) * pagination.pageSize + 1).toLocaleString('en-IN') : 0}–{Math.min(pagination.page * pagination.pageSize, pagination.total).toLocaleString('en-IN')}</span></div>

      {error && <div className="ledger-card p-4 text-sm text-danger">{error}</div>}
      <div className="ledger-card overflow-hidden">
        <div className="table-scroll">
          <table className="w-full text-sm min-w-[1080px]"><thead><tr className="border-b border-line bg-paper text-left text-xs uppercase tracking-wide text-ink-muted"><th className="px-4 py-3">Date & Time</th><th className="px-4 py-3">User</th><th className="px-4 py-3">Activity</th><th className="px-4 py-3">Module</th><th className="px-4 py-3">Page</th><th className="px-4 py-3">Time</th><th className="px-4 py-3">Risk</th><th className="px-4 py-3">Record</th><th className="px-4 py-3">IP</th><th className="px-4 py-3 text-right">View</th></tr></thead>
            <tbody>{loading ? <tr><td colSpan={10} className="px-4 py-10 text-center text-ink-muted">Loading activity...</td></tr> : rows.length === 0 ? <tr><td colSpan={10} className="px-4 py-10 text-center text-ink-muted">No activity found for the selected filters.</td></tr> : rows.map((r) => <tr key={r.id} className="border-b border-line last:border-0 hover:bg-paper/70"><td className="px-4 py-3 whitespace-nowrap font-tabular text-xs">{formatDate(r.created_at)}</td><td className="px-4 py-3"><div className="font-semibold">{r.actor_name || r.actor_phone || 'System'}</div><div className="text-xs text-ink-muted">{r.actor_role || ''}</div></td><td className="px-4 py-3 font-medium">{actionLabel(r.action)}</td><td className="px-4 py-3">{prettyModule(r.entity_type)}</td><td className="px-4 py-3 max-w-[220px] truncate text-xs" title={pagePath(r)}>{pagePath(r)}</td><td className="px-4 py-3 text-xs whitespace-nowrap">{durationLabel(metadataObject(r.metadata).durationMs)}</td><td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full border text-[11px] font-semibold ${riskClass(riskFor(r.action))}`}>{riskFor(r.action)}</span></td><td className="px-4 py-3 font-tabular text-xs text-ink-muted max-w-[180px] truncate" title={r.entity_id || ''}>{r.entity_id || '—'}</td><td className="px-4 py-3 font-tabular text-xs">{r.ip_address || '—'}</td><td className="px-4 py-3 text-right"><button onClick={() => setSelected(r)} className="text-navy font-semibold hover:underline cursor-pointer">Details</button></td></tr>)}</tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3"><button disabled={pagination.page <= 1} onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))} className="border border-line bg-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40 cursor-pointer">Previous</button><span className="text-sm text-ink-muted">Page {pagination.page} of {pagination.totalPages}</span><button disabled={pagination.page >= pagination.totalPages} onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))} className="border border-line bg-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40 cursor-pointer">Next</button></div>

      {selected && <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setSelected(null)}><div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}><div className="px-5 py-4 border-b border-line flex items-center justify-between"><div><h3 className="font-bold text-lg">Activity Details</h3><p className="text-xs text-ink-muted mt-0.5">{formatDate(selected.created_at)}</p></div><button onClick={() => setSelected(null)} className="text-ink-muted hover:text-ink text-xl cursor-pointer">×</button></div><div className="p-5"><div className="mb-5 rounded-lg border border-line bg-paper p-4"><div className="flex items-center justify-between gap-3"><div><div className="text-xs text-ink-muted">Activity summary</div><div className="font-semibold mt-1">{actionLabel(selected.action)} — {prettyModule(selected.entity_type)}</div><div className="text-sm text-ink-muted mt-1">{humanDetails(selected)}</div></div><span className={`inline-flex px-2.5 py-1 rounded-full border text-xs font-bold ${riskClass(riskFor(selected.action))}`}>{riskFor(selected.action)} RISK</span></div></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><div className="text-xs text-ink-muted">User</div><div className="font-semibold mt-1">{selected.actor_name || selected.actor_phone || 'System'}</div></div><div><div className="text-xs text-ink-muted">Activity</div><div className="font-semibold mt-1">{actionLabel(selected.action)}</div></div><div><div className="text-xs text-ink-muted">Module</div><div className="mt-1">{prettyModule(selected.entity_type)}</div></div><div><div className="text-xs text-ink-muted">Record ID</div><div className="mt-1 font-tabular text-xs break-all">{selected.entity_id || '—'}</div></div><div><div className="text-xs text-ink-muted">IP Address</div><div className="mt-1 font-tabular text-xs">{selected.ip_address || '—'}</div></div><div><div className="text-xs text-ink-muted">Action Code</div><div className="mt-1 font-tabular text-xs">{selected.action}</div></div></div><div className="px-5 pb-5"><div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4"><div className="border border-line rounded-lg p-4"><div className="text-xs text-ink-muted mb-2">Before</div><pre className="bg-paper rounded-lg p-3 text-xs overflow-auto whitespace-pre-wrap break-words">{jsonBlock(getBeforeAfter(selected.metadata).before)}</pre></div><div className="border border-line rounded-lg p-4"><div className="text-xs text-ink-muted mb-2">After</div><pre className="bg-paper rounded-lg p-3 text-xs overflow-auto whitespace-pre-wrap break-words">{jsonBlock(getBeforeAfter(selected.metadata).after)}</pre></div></div><div className="text-xs text-ink-muted mb-2">Additional Details</div><pre className="bg-paper border border-line rounded-lg p-4 text-xs overflow-auto whitespace-pre-wrap break-words">{selected.metadata ? JSON.stringify(selected.metadata, null, 2) : 'No additional details recorded.'}</pre></div></div></div></div>}
    </div>
  );
}
