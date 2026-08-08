import { useEffect, useState } from 'react';
import client from '../api/client';
import type { DashboardSummary } from '../types';

function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="ledger-card p-5">
      <div className="text-xs uppercase tracking-wide text-ink-muted">{label}</div>
      <div className={`font-tabular text-2xl mt-1.5 ${accent ? 'text-gold' : 'text-ink'}`}>{value}</div>
      {sub && <div className="text-xs text-ink-muted mt-1">{sub}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client
      .get('/dashboard/summary')
      .then((res) => setSummary(res.data.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-ink-muted">Loading dashboard…</p>;
  if (!summary) return <p className="text-danger">Could not load dashboard data.</p>;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-display text-2xl">Dashboard</h2>
        <p className="text-ink-muted text-sm mt-1">An overview of every chit, collection, and pending payment.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total members" value={String(summary.totalMembers)} sub={`${summary.activeMembers} active`} />
        <StatCard label="Active chits" value={String(summary.activeChits)} sub={`${summary.closedChits} closed`} />
        <StatCard label="This month's collection" value={formatINR(summary.monthlyCollection)} accent />
        <StatCard
          label="Pending payments"
          value={formatINR(summary.pendingPayments.total)}
          sub={`${summary.pendingPayments.count} installment(s)`}
        />
        <StatCard label="Total collected" value={formatINR(summary.totalCollection)} />
        <StatCard label="Total expenses" value={formatINR(summary.totalExpenses)} />
        <StatCard label="Profit" value={formatINR(summary.profit)} accent={summary.profit >= 0} />
        <StatCard label="Monthly expenses" value={formatINR(summary.monthlyExpenses)} />
      </div>
    </div>
  );
}
