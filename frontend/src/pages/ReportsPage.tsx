import { useEffect, useMemo, useRef, useState } from 'react';
import client from '../api/client';
import type { ManagementSplit } from '../types';

type Period = 'monthly' | 'quarterly' | 'half-yearly' | 'yearly' | 'historical' | 'custom';

interface IncomeExpenseRow {
  label: string;
  amount: number;
}

interface ChitSummaryRow {
  type: 'live' | 'historical';
  id: string;
  refNumber: string;
  status: string;
  income: number;
  expense: number | null;
  net: number;
  error?: string;
}

interface ReportData {
  period: string;
  association: {
    income: { chitIncome: number; otherIncome: number; total: number };
    expenses: { chitExpenses: number; operatingExpenses: number; total: number };
    netProfit: number;
  };
  incomeBreakdown: IncomeExpenseRow[];
  expenseBreakdown: IncomeExpenseRow[];
  chitSummary: ChitSummaryRow[];
  meta: { historicalRecordsIncluded: boolean };
}

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'monthly', label: 'This Month' },
  { value: 'quarterly', label: 'Last 3 Months' },
  { value: 'half-yearly', label: 'Last 6 Months' },
  { value: 'yearly', label: 'Last 12 Months' },
  { value: 'custom', label: 'Custom Range' },
];

function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}
function Metric({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div>
      <div className="text-xs text-ink-muted">{label}</div>
      <div className={`font-tabular mt-0.5 ${highlight ? 'text-lg font-bold text-navy' : 'text-sm font-medium'}`}>{formatINR(value)}</div>
    </div>
  );
}
function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}
const PERIOD_MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, 'half-yearly': 6, yearly: 12 };
/** Mirrors report.service.js's resolveRange() date math (not its business
 * rules) purely so a Period preset can be intersected with a Management
 * selection on the frontend before sending an explicit range. */
function periodBound(period: Period | null, customFrom: string, customTo: string): { from: string | null; to: string | null } {
  if (!period || period === 'historical') return { from: null, to: null };
  if (period === 'custom') return { from: customFrom || null, to: customTo || null };
  const months = PERIOD_MONTHS[period];
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - months);
  return { from: toISODate(from), to: toISODate(to) };
}
function managementBound(management: 'previous' | 'new' | null, boundary: string, dayBeforeBoundary: string, today: string): { from: string | null; to: string | null } {
  if (management === 'previous') return { from: null, to: dayBeforeBoundary };
  if (management === 'new') return { from: boundary, to: today };
  return { from: null, to: null };
}
/** Later `from` wins, earlier `to` wins - null on a side means "no constraint from this side". */
function intersectBounds(a: { from: string | null; to: string | null }, b: { from: string | null; to: string | null }) {
  const froms = [a.from, b.from].filter((v): v is string => !!v);
  const tos = [a.to, b.to].filter((v): v is string => !!v);
  return { from: froms.length ? froms.sort().pop()! : null, to: tos.length ? tos.sort()[0] : null };
}
/** Mirrors the backend's own period->date-range resolution, purely for display. */
function resolveRangeLabel(period: Period | null, from: string, to: string): string {
  const today = new Date();
  if (!period) return 'No period selected';
  if (period === 'custom') {
    if (!from || !to) return 'Select a start and end date';
    return `${new Date(from).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} → ${new Date(to).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }
  if (period === 'historical') return 'Every record since the club started';
  const months = { monthly: 1, quarterly: 3, 'half-yearly': 6, yearly: 12 }[period] || 1;
  const start = new Date(today);
  start.setMonth(start.getMonth() - months);
  return `${start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} → ${today.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

function chitLabel(c: ChitSummaryRow) {
  return c.type === 'historical' ? `${c.refNumber} (${c.status})` : c.refNumber;
}

export default function ReportsPage() {
  // New Management is selected by default whenever this page opens; no
  // other filter/tab is pre-selected — the user picks those explicitly.
  const [management, setManagement] = useState<'previous' | 'new' | null>('new');
  const [period, setPeriod] = useState<Period | null>(null);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [mgmt, setMgmt] = useState<ManagementSplit | null>(null);
  // Once a Custom Range fetch succeeds, the From/To inputs are cleared back
  // to blank (per product requirement) but the report and this label stay
  // on screen — this remembers what was actually queried, purely for
  // display, independent of the now-blank input state.
  const [appliedCustomRange, setAppliedCustomRange] = useState<{ from: string; to: string } | null>(null);
  // Set right before we programmatically blank the custom-date inputs after
  // a successful fetch, so the effect below doesn't mistake that blanking
  // for the user clearing the fields and wipe the just-displayed report.
  const skipNextClearRef = useRef(false);

  // Management (Previous/New) and Period (This Month/.../Custom Range) are
  // two independent selections - each its own state, each freely
  // selectable or de-selectable, never forcing or overriding the other.
  // When only one is picked, its own bound applies. When both are picked,
  // they're intersected (e.g. Previous Management + Custom Range = whichever
  // is narrower). When neither is picked, there's nothing to query yet.
  // Previous Management is frozen, view-only data (shown in its own summary
  // card above) - it never drives this date-filtered report section.
  const boundary = mgmt?.boundaryDate || '2026-07-01';
  const dayBeforeBoundary = useMemo(() => {
    const d = new Date(boundary);
    d.setDate(d.getDate() - 1);
    return toISODate(d);
  }, [boundary]);
  const today = useMemo(() => toISODate(new Date()), []);

  const customIncomplete = period === 'custom' && (!customFrom || !customTo);
  const canQuery = management !== 'previous' && (management !== null || period !== null) && !customIncomplete;

  let queryParams: Record<string, string> = {};
  if (canQuery) {
    if (management === null) {
      // No management filter selected - behaves exactly as it always has.
      queryParams = period === 'custom' ? { from: customFrom, to: customTo } : { period: period as Period };
    } else {
      const eff = intersectBounds(
        periodBound(period, customFrom, customTo),
        managementBound(management, boundary, dayBeforeBoundary, today)
      );
      queryParams = { from: eff.from || '2000-01-01', to: eff.to || today };
    }
  }

  function toggleManagement(value: 'previous' | 'new') {
    setManagement((cur) => (cur === value ? null : value));
  }
  function togglePeriod(value: Period) {
    setPeriod((cur) => (cur === value ? null : value));
    setAppliedCustomRange(null);
  }
  const rangeLabel = useMemo(() => {
    if (period === 'custom' && !customFrom && !customTo && appliedCustomRange) {
      return resolveRangeLabel(period, appliedCustomRange.from, appliedCustomRange.to);
    }
    return resolveRangeLabel(period, customFrom, customTo);
  }, [period, customFrom, customTo, appliedCustomRange]);

  useEffect(() => {
    if (!canQuery) {
      if (skipNextClearRef.current) {
        // We just blanked the custom-date fields ourselves after a
        // successful fetch - keep the report on screen, don't clear it.
        skipNextClearRef.current = false;
        return;
      }
      setReport(null);
      return;
    }
    setLoading(true);
    client.get('/reports', { params: queryParams }).then((res) => {
      setReport(res.data.data);
      setLoading(false);
      if (period === 'custom' && customFrom && customTo) {
        // Custom-period data has displayed successfully - reset the date
        // fields to blank so the user must pick fresh dates next time.
        setAppliedCustomRange({ from: customFrom, to: customTo });
        skipNextClearRef.current = true;
        setCustomFrom('');
        setCustomTo('');
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [management, period, customFrom, customTo]);


  useEffect(() => {
    // Fetched independently of the date-range report above - if this fails
    // (e.g. a fresh deploy that hasn't run migration 016 yet), the rest of
    // the Report page - which already worked before this feature existed -
    // must keep working; this section just quietly doesn't render.
    client
      .get('/funds/management-split')
      .then((res) => setMgmt(res.data.data))
      .catch(() => setMgmt(null));
  }, []);

  async function handleDownload(format: 'csv' | 'xlsx' | 'pdf') {
    if (!canQuery) return;
    setDownloading(format);
    try {
      const res = await client.get('/reports/export', {
        params: { ...queryParams, format },
        responseType: 'blob',
      });
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jfc-association-report-${period === 'custom' ? `${customFrom}_to_${customTo}` : period || 'filtered'}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-ink-muted text-sm">
        Where the Association's money came from, where it was spent, and what's left over — for any time period.
      </p>

      {mgmt && (
        <div className="space-y-3">
          <div className="flex rounded-lg border border-line overflow-hidden text-sm font-medium w-fit">
            {([
              { key: 'previous', label: 'Previous Management' },
              { key: 'new', label: 'New Management' },
            ] as const).map((p) => (
              <button
                key={p.key}
                onClick={() => toggleManagement(p.key)}
                className={`px-4 py-2 transition-colors cursor-pointer ${management === p.key ? 'bg-navy text-white' : 'bg-white text-ink-muted hover:bg-paper'}`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {management === 'previous' && (
            <div className="ledger-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold">Previous Management</h3>
                <span className="text-xs text-ink-muted">Up to 30 Jun 2026 — frozen, read-only</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Metric label="Santha" value={mgmt.previousManagement.santha} />
                <Metric label="Donation" value={mgmt.previousManagement.donation} />
                <Metric label="Unclassified Contribution" value={mgmt.previousManagement.unclassifiedContribution} />
                <Metric label="Chit Profit" value={mgmt.previousManagement.chitProfit} />
                <Metric label="Expenses" value={mgmt.previousManagement.expenses} />
                <Metric label="Principal" value={mgmt.previousManagement.principal} />
                <Metric label="Profit (6% p.a.)" value={mgmt.previousManagement.profit} />
                <Metric label="Final Settlement (Handover)" value={mgmt.previousManagement.finalSettlement} highlight />
              </div>
            </div>
          )}

          {management === 'new' && (
            <div className="ledger-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold">New Management</h3>
                <span className="text-xs text-ink-muted">Since 1 Jul 2026</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Metric label="Opening Principal" value={mgmt.newManagement.openingBalance} />
                <Metric label="New Santha" value={mgmt.newManagement.santha} />
                <Metric label="New Donations" value={mgmt.newManagement.donations} />
                <Metric label="New Chit Income" value={mgmt.newManagement.chitIncome} />
                <Metric label="New Expenses" value={mgmt.newManagement.expenses} />
                <Metric label="Current Balance" value={mgmt.newManagement.currentBalance} highlight />
              </div>
            </div>
          )}

          {management === 'new' && period !== null && (
            <p className="text-xs text-ink-muted px-1">
              Combined with the date filter below ({rangeLabel}) — showing whichever is narrower.
            </p>
          )}
        </div>
      )}

      {management === 'previous' ? (
        <p className="text-ink-muted ledger-card p-5 text-center text-sm">
          Previous Management figures are shown above and are frozen, view-only records. Switch to New Management to filter by date range.
        </p>
      ) : (
      <>
      <div className="ledger-card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-line overflow-hidden text-sm font-medium">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => togglePeriod(opt.value)}
                className={`px-3 py-2 whitespace-nowrap cursor-pointer transition-colors ${period === opt.value ? 'bg-navy text-white' : 'bg-white text-ink-muted hover:bg-paper'}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2 ml-auto">
            {(['csv', 'xlsx', 'pdf'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => handleDownload(fmt)}
                disabled={downloading === fmt || loading || !canQuery}
                className="rounded-lg bg-gold text-navy px-3 py-2 text-xs font-medium cursor-pointer disabled:opacity-50 uppercase"
              >
                {downloading === fmt ? 'Preparing…' : `↓ ${fmt}`}
              </button>
            ))}
          </div>
        </div>

        {period === 'custom' ? (
          <div className="flex flex-wrap items-end gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">From</label>
              <input type="date" value={customFrom} max={customTo || undefined} onChange={(e) => setCustomFrom(e.target.value)} className="rounded-lg border border-line px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-muted mb-1">To</label>
              <input type="date" value={customTo} min={customFrom || undefined} max={toISODate(new Date())} onChange={(e) => setCustomTo(e.target.value)} className="rounded-lg border border-line px-3 py-2 text-sm" />
            </div>
          </div>
        ) : null}

        <p className="text-xs text-ink-muted pt-1 border-t border-line">
          Showing: <strong className="text-ink">
            {!canQuery
              ? 'Nothing selected yet'
              : period
              ? rangeLabel
              : queryParams.from && queryParams.to
              ? `${new Date(queryParams.from).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} → ${new Date(queryParams.to).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
              : rangeLabel}
          </strong>
        </p>
      </div>

      {!canQuery ? (
        <p className="text-ink-muted ledger-card p-5 text-center text-sm">
          Pick a Management period and/or a date range above to see the report.
        </p>
      ) : loading ? (
        <p className="text-ink-muted">Loading…</p>
      ) : !report ? (
        <p className="text-danger">Could not load report.</p>
      ) : (
        <>
          {/* Headline: Income, Expenses, Net at a glance */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="ledger-card p-5">
              <div className="text-xs uppercase tracking-wide text-ink-muted">Association Income</div>
              <div className="font-tabular text-2xl mt-1.5 text-gold-dim bg-navy inline-block px-2 rounded">{formatINR(report.association.income.total)}</div>
            </div>
            <div className="ledger-card p-5">
              <div className="text-xs uppercase tracking-wide text-ink-muted">Association Expenses</div>
              <div className="font-tabular text-2xl mt-1.5">{formatINR(report.association.expenses.total)}</div>
            </div>
            <div className="ledger-card p-5">
              <div className="text-xs uppercase tracking-wide text-ink-muted">Net Profit / Surplus</div>
              <div className={`font-tabular text-2xl mt-1.5 ${report.association.netProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                {formatINR(report.association.netProfit)}
              </div>
            </div>
          </div>

          {/* 1. Association Income - where the money came from */}
          <div className="ledger-card overflow-hidden">
            <div className="px-5 py-3 border-b border-line font-medium">Association Income — where the money came from</div>
            <table className="w-full text-sm">
              <tbody>
                {report.incomeBreakdown.map((row) => (
                  <tr key={row.label} className="border-t border-line">
                    <td className="px-4 py-2.5">{row.label}</td>
                    <td className="px-4 py-2.5 text-right font-tabular">{formatINR(row.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t border-line bg-paper font-medium">
                  <td className="px-4 py-2.5">Total Income</td>
                  <td className="px-4 py-2.5 text-right font-tabular">{formatINR(report.association.income.total)}</td>
                </tr>
              </tbody>
            </table>
            {!report.meta.historicalRecordsIncluded && (
              <p className="px-4 py-2 text-xs text-ink-muted border-t border-line">
                Historical (pre-app) chit profit isn't dated per-record, so it doesn't appear in date-filtered reports.
              </p>
            )}
          </div>

          {/* 2. Association Expenses - where the money went */}
          <div className="ledger-card overflow-hidden">
            <div className="px-5 py-3 border-b border-line font-medium">Association Expenses — where the money went</div>
            <table className="w-full text-sm">
              <tbody>
                {report.expenseBreakdown.map((row) => (
                  <tr key={row.label} className="border-t border-line">
                    <td className="px-4 py-2.5">{row.label}</td>
                    <td className="px-4 py-2.5 text-right font-tabular">{formatINR(row.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t border-line bg-paper font-medium">
                  <td className="px-4 py-2.5">Total Expenses</td>
                  <td className="px-4 py-2.5 text-right font-tabular">{formatINR(report.association.expenses.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* 3. Net Profit / Surplus is already shown as a headline card above. */}

          {/* 4. Chit-wise financial summary */}
          <div className="ledger-card overflow-hidden">
            <div className="px-5 py-3 border-b border-line font-medium">Chit-wise Financial Summary</div>
            <table className="w-full text-sm">
              <thead className="bg-paper text-ink-muted text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2">Chit</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-right px-4 py-2">Income</th>
                  <th className="text-right px-4 py-2">Expenses</th>
                  <th className="text-right px-4 py-2">Net Result</th>
                </tr>
              </thead>
              <tbody>
                {report.chitSummary.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-ink-muted">No chit activity for this period.</td></tr>
                ) : (
                  report.chitSummary.map((c) => (
                    <tr key={`${c.type}-${c.id}`} className="border-t border-line">
                      <td className="px-4 py-2.5">
                        {chitLabel(c)}
                        {c.error && (
                          <span className="ml-2 text-xs text-danger" title={c.error}>⚠ Data issue — figures unavailable</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 capitalize">{c.status}</td>
                      <td className="px-4 py-2.5 text-right font-tabular">{formatINR(c.income)}</td>
                      <td className="px-4 py-2.5 text-right font-tabular">{c.expense === null ? '—' : formatINR(c.expense)}</td>
                      <td className={`px-4 py-2.5 text-right font-tabular ${c.net >= 0 ? '' : 'text-danger'}`}>{formatINR(c.net)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <p className="px-4 py-2 text-xs text-ink-muted border-t border-line">
              Member-by-member payment status for a chit is on that chit's own detail page, not here.
            </p>
          </div>
        </>
      )}
      </>
      )}
    </div>
  );
}
