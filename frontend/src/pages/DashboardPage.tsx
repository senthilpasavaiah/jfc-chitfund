import { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { DashboardSummary } from '../types';

function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

function StatCard({
  label,
  value,
  sub,
  accentBorder,
}: {
  label: string;
  value: string;
  sub?: string;
  accentBorder: string;
}) {
  return (
    <div className="ledger-card p-5 flex flex-col" style={{ borderLeft: `4px solid ${accentBorder}` }}>
      <div className="text-xs uppercase tracking-wide text-ink-muted leading-snug min-h-[2rem]">{label}</div>
      <div className="font-tabular text-2xl mt-1.5 text-navy font-bold">{value}</div>
      {sub && <div className="text-xs text-success mt-1">{sub}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
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
        <h2 className="text-2xl font-bold">Overview</h2>
        <p className="text-ink-muted text-sm mt-1">Welcome, {user?.role === 'ADMIN' ? 'Admin' : user?.phone}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-stretch">
        <StatCard label="Total members" value={String(summary.totalMembers)} sub="Registered in JFC" accentBorder="#FFD700" />
        <StatCard label="Income via Chit" value={formatINR(summary.incomeViaChit)} sub="Recorded profit, all years" accentBorder="#2563eb" />
        <StatCard label="Income via Donation" value={formatINR(summary.incomeViaDonation)} sub="From Funds page" accentBorder="#16a34a" />
        <StatCard label="Income via Santha" value={formatINR(summary.incomeViaSantha)} sub="From Funds page" accentBorder="#9333ea" />
        <StatCard label="Expenses" value={formatINR(summary.totalExpenses)} sub="From Funds page" accentBorder="#c0392b" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-stretch">
        <StatCard label="Total income" value={formatINR(summary.totalIncome)} sub="Chit + Donation + Santha" accentBorder="#0d9488" />
        <StatCard label="Currently in hand (principal)" value={formatINR(summary.currentlyInHand)} sub="Income − Expenses" accentBorder="#003366" />
        <StatCard label="Accrued profit (6% PA)" value={formatINR(summary.accruedProfit)} sub="From settlement, all years" accentBorder="#e6c200" />
        <StatCard label="Final settlement value" value={formatINR(summary.finalSettlementValue)} sub="Principal + Profit" accentBorder="#16a34a" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="ledger-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">Chit activity</h3>
          </div>
          <div className="flex justify-between text-sm border-b border-line pb-2">
            <span className="text-ink-muted">Active chits</span>
            <span className="font-tabular">{summary.activeChits}</span>
          </div>
          <div className="flex justify-between text-sm pt-2">
            <span className="text-ink-muted">Closed chits</span>
            <span className="font-tabular">{summary.closedChits}</span>
          </div>
        </div>
        <div className="ledger-card p-5">
          <h3 className="font-medium mb-3">Pending payments</h3>
          <div className="flex justify-between text-sm border-b border-line pb-2">
            <span className="text-ink-muted">Total pending</span>
            <span className="font-tabular text-danger">{formatINR(summary.pendingPayments.total)}</span>
          </div>
          <div className="flex justify-between text-sm pt-2">
            <span className="text-ink-muted">Installments</span>
            <span className="font-tabular">{summary.pendingPayments.count}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
