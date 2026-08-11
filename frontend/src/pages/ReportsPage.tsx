import { useEffect, useState } from 'react';
import client from '../api/client';

type Period = 'monthly' | 'quarterly' | 'half-yearly' | 'yearly' | 'historical';

interface ReportData {
  period: string;
  summary: { totalCollected: number; paymentCount: number; totalExpenses: number; expenseCount: number; net: number };
  monthlyBreakdown: { month: string; collected: number }[];
  chitBreakdown: { id: string; refNumber: string; name: string; status: string; collected: number; paymentCount: number }[];
  memberBreakdown: { id: string; name: string; mobileNumber: string; totalPaid: number; paymentCount: number }[];
}

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: '3 Months' },
  { value: 'half-yearly', label: '6 Months' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'historical', label: 'Historical (all-time)' },
];

function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>('monthly');
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    client.get('/reports', { params: { period } }).then((res) => {
      setReport(res.data.data);
      setLoading(false);
    });
  }, [period]);

  async function handleDownload(format: 'csv' | 'xlsx' | 'pdf') {
    setDownloading(format);
    try {
      const res = await client.get('/reports/export', {
        params: { period, format },
        responseType: 'blob',
      });
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jfc-report-${period}.${format}`;
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
      <div>
        <h2 className="text-2xl font-bold">Reports</h2>
        <p className="text-ink-muted text-sm mt-1">Collections and expenses across any time period, ready to export.</p>
      </div>

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
              disabled={downloading === fmt || loading}
              className="rounded-lg bg-gold text-navy px-3 py-2 text-xs font-medium cursor-pointer disabled:opacity-50 uppercase"
            >
              {downloading === fmt ? 'Preparing…' : `↓ ${fmt}`}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-ink-muted">Loading…</p>
      ) : !report ? (
        <p className="text-danger">Could not load report.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="ledger-card p-5">
              <div className="text-xs uppercase tracking-wide text-ink-muted">Collected</div>
              <div className="font-tabular text-2xl mt-1.5 text-gold-dim bg-navy inline-block px-2 rounded">{formatINR(report.summary.totalCollected)}</div>
              <div className="text-xs text-ink-muted mt-1">{report.summary.paymentCount} payment(s)</div>
            </div>
            <div className="ledger-card p-5">
              <div className="text-xs uppercase tracking-wide text-ink-muted">Expenses</div>
              <div className="font-tabular text-2xl mt-1.5">{formatINR(report.summary.totalExpenses)}</div>
              <div className="text-xs text-ink-muted mt-1">{report.summary.expenseCount} entrie(s)</div>
            </div>
            <div className="ledger-card p-5">
              <div className="text-xs uppercase tracking-wide text-ink-muted">Net</div>
              <div className="font-tabular text-2xl mt-1.5">{formatINR(report.summary.net)}</div>
            </div>
            <div className="ledger-card p-5">
              <div className="text-xs uppercase tracking-wide text-ink-muted">Active chits reporting</div>
              <div className="font-tabular text-2xl mt-1.5">{report.chitBreakdown.length}</div>
            </div>
          </div>

          <div className="ledger-card overflow-hidden">
            <div className="px-5 py-3 border-b border-line font-medium">By Chit</div>
            <table className="w-full text-sm">
              <thead className="bg-paper text-ink-muted text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2">Reference</th>
                  <th className="text-left px-4 py-2">Name</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-right px-4 py-2">Collected</th>
                  <th className="text-right px-4 py-2">Payments</th>
                </tr>
              </thead>
              <tbody>
                {report.chitBreakdown.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-ink-muted">No data for this period.</td></tr>
                ) : (
                  report.chitBreakdown.map((c) => (
                    <tr key={c.id} className="border-t border-line">
                      <td className="px-4 py-2.5 font-tabular text-xs">{c.refNumber}</td>
                      <td className="px-4 py-2.5">{c.name}</td>
                      <td className="px-4 py-2.5">{c.status}</td>
                      <td className="px-4 py-2.5 text-right font-tabular">{formatINR(c.collected)}</td>
                      <td className="px-4 py-2.5 text-right font-tabular">{c.paymentCount}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="ledger-card overflow-hidden">
            <div className="px-5 py-3 border-b border-line font-medium">By Member</div>
            <table className="w-full text-sm">
              <thead className="bg-paper text-ink-muted text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2">Name</th>
                  <th className="text-left px-4 py-2">Mobile</th>
                  <th className="text-right px-4 py-2">Total paid</th>
                  <th className="text-right px-4 py-2">Payments</th>
                </tr>
              </thead>
              <tbody>
                {report.memberBreakdown.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-ink-muted">No payments recorded in this period.</td></tr>
                ) : (
                  report.memberBreakdown.map((m) => (
                    <tr key={m.id} className="border-t border-line">
                      <td className="px-4 py-2.5">{m.name}</td>
                      <td className="px-4 py-2.5 font-tabular text-xs">{m.mobileNumber}</td>
                      <td className="px-4 py-2.5 text-right font-tabular">{formatINR(m.totalPaid)}</td>
                      <td className="px-4 py-2.5 text-right font-tabular">{m.paymentCount}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
