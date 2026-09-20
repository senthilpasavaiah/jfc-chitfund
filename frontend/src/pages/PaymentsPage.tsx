import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

interface PaymentRow {
  id: string;
  source: 'legacy' | 'chit';
  chitId: string;
  chitRef: string;
  chitName: string;
  memberId: string;
  memberName: string;
  mobileNumber: string;
  monthIndex: number;
  monthLabel: string;
  monthDate: string | null;
  dueDate: string | null;
  expected: number;
  paid: number;
  balance: number;
  status: 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE' | 'UPCOMING';
  installmentId: string | null;
}
interface PaymentOptions {
  chits: { id: string; ref_number: string; name: string; value_lakh: number; total_months: number; start_date: string | null; status: string }[];
  members: { id: string; name: string; mobile_number: string; status: string }[];
}
interface PaymentResponse {
  rows: PaymentRow[];
  summary: { expected: number; collected: number; pending: number; overdue: number; pendingCount: number; paidCount: number };
  options: PaymentOptions;
}

function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}
function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const STATUS_STYLES: Record<PaymentRow['status'], string> = {
  PAID: 'bg-success/10 text-success',
  PARTIAL: 'bg-gold/15 text-gold-dim',
  PENDING: 'bg-line text-ink-muted',
  OVERDUE: 'bg-danger/10 text-danger',
  UPCOMING: 'bg-navy/5 text-navy',
};

export default function PaymentsPage() {
  const { user } = useAuth();
  const canRecord = user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'COLLECTOR';

  const [options, setOptions] = useState<PaymentOptions>({ chits: [], members: [] });
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [summary, setSummary] = useState<PaymentResponse['summary']>({ expected: 0, collected: 0, pending: 0, overdue: 0, pendingCount: 0, paidCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chitId, setChitId] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [showMembers, setShowMembers] = useState(false);
  const [status, setStatus] = useState('ALL');
  const [month, setMonth] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [payForm, setPayForm] = useState<Record<string, { amount: string; method: string }>>({});

  async function loadOptions() {
    try {
      const res = await client.get('/payments/options');
      setOptions(res.data.data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load payment filters.');
    }
  }

  async function loadPayments() {
    setLoading(true);
    try {
      const res = await client.get('/payments/overview', {
        params: {
          chitId: chitId || undefined,
          memberIds: memberIds.length ? memberIds.join(',') : undefined,
          status,
          month: month || undefined,
          from: from || undefined,
          to: to || undefined,
        },
      });
      const data = res.data.data as PaymentResponse;
      setRows(data.rows);
      setSummary(data.summary);
      setOptions((current) => current.chits.length ? current : data.options);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load payment information.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadOptions(); }, []);
  useEffect(() => { loadPayments(); /* filter changes intentionally reload */ }, [chitId, memberIds.join(','), status, month, from, to]);

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    return options.members.filter((m) => !q || m.name.toLowerCase().includes(q) || m.mobile_number.includes(q));
  }, [options.members, memberSearch]);

  function toggleMember(id: string) {
    setMemberIds((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }

  function clearFilters() {
    setChitId('');
    setMemberIds([]);
    setStatus('ALL');
    setMonth('');
    setFrom('');
    setTo('');
    setMemberSearch('');
  }

  async function recordLegacy(row: PaymentRow) {
    const values = payForm[row.id];
    if (!values?.amount) {
      setError('Enter the payment amount first.');
      return;
    }
    setError(null);
    setRecordingId(row.id);
    try {
      await client.post('/payments', {
        installmentId: row.installmentId,
        amount: Number(values.amount),
        method: values.method || 'CASH',
      });
      setPayForm((current) => ({ ...current, [row.id]: { amount: '', method: 'CASH' } }));
      await loadPayments();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not record payment.');
    } finally {
      setRecordingId(null);
    }
  }

  async function markChitPaid(row: PaymentRow) {
    if (row.status === 'PAID' || row.status === 'UPCOMING') return;
    setError(null);
    setRecordingId(row.id);
    try {
      await client.post(`/chits/${row.chitId}/months/${row.monthIndex}/payment-manual`, { memberId: row.memberId });
      await loadPayments();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not update the chit payment.');
    } finally {
      setRecordingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">Member &amp; Chit Payment Tracking</h2>
        <p className="text-ink-muted text-sm mt-1">Track every member payment by chit and month. Detailed collection data stays here; Fund and Reports use the financial summaries.</p>
      </div>

      {error && <div className="rounded-lg border border-danger/20 bg-danger/5 px-3 py-2 text-sm text-danger">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          ['Expected', summary.expected, 'text-navy'],
          ['Collected', summary.collected, 'text-success'],
          ['Pending', summary.pending, 'text-danger'],
          ['Overdue', summary.overdue, 'text-danger'],
          ['Pending installments', summary.pendingCount, 'text-navy'],
        ].map(([label, value, color]) => (
          <div key={String(label)} className="ledger-card p-3">
            <div className="text-xs text-ink-muted">{label}</div>
            <div className={`font-tabular text-lg font-bold mt-1 ${color}`}>{typeof value === 'number' && label !== 'Pending installments' ? formatINR(value) : value}</div>
          </div>
        ))}
      </div>

      <div className="ledger-card p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-medium text-sm">Payment filters</h3>
          <button type="button" onClick={clearFilters} className="text-xs text-navy underline cursor-pointer">Clear filters</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <label className="text-xs text-ink-muted">
            Chit
            <select value={chitId} onChange={(e) => setChitId(e.target.value)} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink bg-white">
              <option value="">All chits</option>
              {options.chits.map((c) => <option key={c.id} value={c.id}>{c.ref_number} — {c.name}</option>)}
            </select>
          </label>
          <div className="relative text-xs text-ink-muted">
            <span>Members</span>
            <button type="button" onClick={() => setShowMembers((v) => !v)} className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-left text-sm text-ink">
              {memberIds.length ? `${memberIds.length} member${memberIds.length === 1 ? '' : 's'} selected` : 'All members'}
            </button>
            {showMembers && (
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-line bg-white shadow-lg p-2">
                <input value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} placeholder="Search member…" className="w-full rounded border border-line px-2 py-1.5 text-sm mb-2" />
                <div className="max-h-56 overflow-y-auto divide-y divide-line">
                  {filteredMembers.map((m) => (
                    <label key={m.id} className="flex items-center gap-2 px-2 py-2 cursor-pointer hover:bg-paper">
                      <input type="checkbox" checked={memberIds.includes(m.id)} onChange={() => toggleMember(m.id)} />
                      <span className="text-sm text-ink">{m.name}</span>
                    </label>
                  ))}
                </div>
                <button type="button" onClick={() => { setMemberIds([]); setShowMembers(false); }} className="mt-2 text-xs text-navy underline">Clear member selection</button>
              </div>
            )}
          </div>
          <label className="text-xs text-ink-muted">
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink bg-white">
              <option value="ALL">All statuses</option><option value="PAID">Paid</option><option value="PENDING">Pending</option><option value="PARTIAL">Partial</option><option value="OVERDUE">Overdue</option><option value="UPCOMING">Upcoming</option>
            </select>
          </label>
          <label className="text-xs text-ink-muted">
            Month
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink bg-white" />
          </label>
          <label className="text-xs text-ink-muted">
            From
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink bg-white" />
          </label>
          <label className="text-xs text-ink-muted">
            To
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink bg-white" />
          </label>
        </div>
      </div>

      <div className="ledger-card overflow-hidden">
        <div className="px-4 py-3 border-b border-line flex items-center justify-between gap-3">
          <div className="font-medium text-sm">Payment records</div>
          <div className="text-xs text-ink-muted">{rows.length} records</div>
        </div>
        <div className="table-scroll">
          <table className="w-full min-w-[1120px] text-sm">
            <thead className="bg-navy text-white text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Chit</th>
                <th className="text-left px-4 py-3">Member</th>
                <th className="text-left px-4 py-3">Month</th>
                <th className="text-left px-4 py-3">Due</th>
                <th className="text-right px-4 py-3">Expected</th>
                <th className="text-right px-4 py-3">Paid</th>
                <th className="text-right px-4 py-3">Balance</th>
                <th className="text-left px-4 py-3">Status</th>
                {canRecord && <th className="text-left px-4 py-3">Action</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={canRecord ? 9 : 8} className="px-4 py-8 text-center text-ink-muted">Loading payment information…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={canRecord ? 9 : 8} className="px-4 py-8 text-center text-ink-muted">No payment records match the selected filters.</td></tr>
              ) : rows.map((row) => (
                <tr key={row.id} className="border-t border-line align-top">
                  <td className="px-4 py-3"><div className="font-medium">{row.chitRef}</div><div className="text-xs text-ink-muted">{row.chitName}</div></td>
                  <td className="px-4 py-3"><div>{row.memberName}</div><div className="text-xs text-ink-muted">{row.mobileNumber}</div></td>
                  <td className="px-4 py-3 whitespace-nowrap">{row.monthLabel}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-muted">{formatDate(row.dueDate)}</td>
                  <td className="px-4 py-3 text-right font-tabular">{formatINR(row.expected)}</td>
                  <td className="px-4 py-3 text-right font-tabular text-success">{formatINR(row.paid)}</td>
                  <td className="px-4 py-3 text-right font-tabular">{formatINR(row.balance)}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[row.status]}`}>{row.status}</span></td>
                  {canRecord && (
                    <td className="px-4 py-3">
                      {row.source === 'legacy' && row.status !== 'PAID' ? (
                        <div className="flex gap-1.5 items-center">
                          <input type="number" min="0" placeholder="₹" className="w-24 rounded border border-line px-2 py-1.5 text-xs" value={payForm[row.id]?.amount || ''} onChange={(e) => setPayForm((f) => ({ ...f, [row.id]: { amount: e.target.value, method: f[row.id]?.method || 'CASH' } }))} />
                          <select className="rounded border border-line px-2 py-1.5 text-xs" value={payForm[row.id]?.method || 'CASH'} onChange={(e) => setPayForm((f) => ({ ...f, [row.id]: { amount: f[row.id]?.amount || '', method: e.target.value } }))}>
                            <option value="CASH">Cash</option><option value="UPI">UPI</option><option value="BANK_TRANSFER">Bank</option><option value="CHEQUE">Cheque</option>
                          </select>
                          <button disabled={recordingId === row.id} onClick={() => recordLegacy(row)} className="rounded bg-gold text-navy px-2.5 py-1.5 text-xs font-medium disabled:opacity-50">{recordingId === row.id ? 'Saving…' : 'Record'}</button>
                        </div>
                      ) : row.source === 'chit' && row.status !== 'PAID' && row.status !== 'UPCOMING' ? (
                        <button disabled={recordingId === row.id} onClick={() => markChitPaid(row)} className="rounded bg-gold text-navy px-2.5 py-1.5 text-xs font-medium disabled:opacity-50">{recordingId === row.id ? 'Saving…' : 'Mark paid'}</button>
                      ) : row.status === 'PAID' ? <span className="text-xs text-success">Recorded</span> : <span className="text-xs text-ink-muted">Not due yet</span>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
