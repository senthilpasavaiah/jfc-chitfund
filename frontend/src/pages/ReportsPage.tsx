import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';

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
  { value: 'historical', label: 'All-time' },
  { value: 'custom', label: 'Custom Range' },
];

function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}
function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}
/** Mirrors the backend's own period->date-range resolution, purely for display. */
function resolveRangeLabel(period: Period, from: string, to: string): string {
  const today = new Date();
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
  const [period, setPeriod] = useState<Period>('historical');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState(toISODate(new Date()));
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  const rangeLabel = useMemo(() => resolveRangeLabel(period, customFrom, customTo), [period, customFrom, customTo]);
  const queryParams = period === 'custom' ? { from: customFrom, to: customTo } : { period };
  const canQuery = period !== 'custom' || (customFrom && customTo);

  useEffect(() => {
    if (!canQuery) return;
    setLoading(true);
    client.get('/reports', { params: queryParams }).then((res) => {
      setReport(res.data.data);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, customFrom, customTo]);

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
      a.download = `jfc-association-report-${period === 'custom' ? `${customFrom}_to_${customTo}` : period}.${format}`;
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

      <div className="ledger-card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-line overflow-hidden text-sm font-medium">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
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
          Showing: <strong className="text-ink">{rangeLabel}</strong>
        </p>
      </div>

      {loading ? (
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
                Historical (pre-app) chit profit isn't dated per-record, so it only appears under "All-time".
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
                      <td className="px-4 py-2.5">{chitLabel(c)}</td>
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
    </div>
  );
}
