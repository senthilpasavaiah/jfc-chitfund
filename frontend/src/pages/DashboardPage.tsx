import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import type { DashboardSummary, ManagementSplit } from '../types';

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
    <div className="ledger-card p-3 flex flex-col" style={{ borderLeft: `3px solid ${accentBorder}` }}>
      <div className="text-[11px] uppercase tracking-wide text-ink-muted leading-snug">{label}</div>
      <div className="font-tabular text-base mt-1 text-navy font-bold truncate">{value}</div>
      {sub && <div className="text-[10px] text-success mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [mgmt, setMgmt] = useState<ManagementSplit | null>(null);
  const [loading, setLoading] = useState(true);
  // Same selector as the Fund and Report pages, reading the same backend
  // data - so whichever period is picked here shows the identical figures
  // a user would see there too. New Management is selected by default.
  const [mgmtView, setMgmtView] = useState<'previous' | 'new' | null>('new');

  useEffect(() => {
    client
      .get('/dashboard/summary')
      .then((res) => setSummary(res.data.data))
      .finally(() => setLoading(false));
    // Fetched and failed independently of the main summary above - if
    // migration 016 hasn't been run yet, the rest of the Dashboard (which
    // already worked before this feature existed) must keep working; this
    // section just quietly doesn't render.
    client
      .get('/funds/management-split')
      .then((res) => setMgmt(res.data.data))
      .catch(() => setMgmt(null));
  }, []);

  if (loading) return <p className="text-ink-muted">Loading dashboard…</p>;
  if (!summary) return <p className="text-danger">Could not load dashboard data.</p>;

  return (
    <div className="space-y-5">
      {mgmt && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg border border-line overflow-hidden text-xs font-medium w-fit">
            {([
              { key: 'previous', label: 'Previous Management' },
              { key: 'new', label: 'New Management' },
            ] as const).map((p) => (
              <button
                key={p.key}
                onClick={() => setMgmtView((cur) => (cur === p.key ? null : p.key))}
                className={`px-3 py-1.5 transition-colors cursor-pointer ${mgmtView === p.key ? 'bg-navy text-white' : 'bg-white text-ink-muted hover:bg-paper'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-ink-muted">
            {mgmtView === 'new' ? 'From July 1st 2026' : mgmtView === 'previous' ? 'Up to 30 Jun 2026 — frozen, read-only' : ''}
          </span>
          </div>

          {mgmtView === 'previous' && (
            <div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 items-stretch">
                <StatCard label="Number of members" value={String(summary.totalMembers)} accentBorder="#FFD700" />
                <StatCard label="Santha" value={formatINR(mgmt.previousManagement.santha)} accentBorder="#9333ea" />
                <StatCard label="Donation" value={formatINR(mgmt.previousManagement.donation)} accentBorder="#16a34a" />
                <StatCard label="Unclassified" value={formatINR(mgmt.previousManagement.unclassifiedContribution)} accentBorder="#6b7280" />
                <StatCard label="Chit profit" value={formatINR(mgmt.previousManagement.chitProfit)} accentBorder="#2563eb" />
                <StatCard label="Expenses" value={formatINR(mgmt.previousManagement.expenses)} accentBorder="#c0392b" />
                <StatCard label="Principal" value={formatINR(mgmt.previousManagement.principal)} accentBorder="#003366" />
                <StatCard label="Profit (6% p.a.)" value={formatINR(mgmt.previousManagement.profit)} accentBorder="#e6c200" />
                <StatCard label="Final settlement (handover)" value={formatINR(mgmt.previousManagement.finalSettlement)} accentBorder="#0d9488" />
              </div>
            </div>
          )}

          {mgmtView === 'new' && (
            <div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 items-stretch">
                <StatCard label="Opening principal" value={formatINR(mgmt.newManagement.openingBalance)} sub="From Previous Management" accentBorder="#003366" />
                <StatCard label="New Santha" value={formatINR(mgmt.newManagement.santha)} accentBorder="#9333ea" />
                <StatCard label="New Donations" value={formatINR(mgmt.newManagement.donations)} accentBorder="#16a34a" />
                <StatCard label="New Chit income" value={formatINR(mgmt.newManagement.chitIncome)} accentBorder="#2563eb" />
                <StatCard label="New expenses" value={formatINR(mgmt.newManagement.expenses)} accentBorder="#c0392b" />
                <StatCard label="Current fund balance" value={formatINR(mgmt.newManagement.currentBalance)} sub="Opening + Income − Expenses" accentBorder="#e6c200" />
              </div>
            </div>
          )}

        </div>
      )}

      {mgmtView !== 'previous' && (
        <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="ledger-card p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-sm">Chit activity</h3>
          </div>
          <div className="flex justify-between text-sm border-b border-line pb-1.5">
            <span className="text-ink-muted">Active chits</span>
            <span className="font-tabular">{summary.activeChits}</span>
          </div>
          <div className="flex justify-between text-sm pt-1.5">
            <span className="text-ink-muted">Closed chits</span>
            <span className="font-tabular">{summary.closedChits}</span>
          </div>
        </div>
        <div className="ledger-card p-4">
          <h3 className="font-medium text-sm mb-2">Pending payments</h3>
          <div className="flex justify-between text-sm border-b border-line pb-1.5">
            <span className="text-ink-muted">Total pending</span>
            <span className="font-tabular text-danger">{formatINR(summary.pendingPayments.total)}</span>
          </div>
          <div className="flex justify-between text-sm pt-1.5">
            <span className="text-ink-muted">Installments</span>
            <span className="font-tabular">{summary.pendingPayments.count}</span>
          </div>
        </div>
      </div>

      {summary.currentMonthDrawers.length > 0 && (
        <div className="ledger-card p-4">
          <h3 className="font-medium text-sm mb-2">This month's drawers</h3>
          <div className="divide-y divide-line">
            {summary.currentMonthDrawers.map((d) => (
              <Link
                key={d.chitId}
                to={`/chits/${d.chitId}`}
                className="flex items-center justify-between text-sm py-2 first:pt-0 last:pb-0 hover:text-navy transition-colors"
              >
                <div>
                  <span className="font-medium">{d.refNumber}</span>
                  <span className="text-ink-muted"> — {d.monthLabel}</span>
                </div>
                {d.drawerName ? (
                  <span className="flex items-center gap-1.5">
                    <span className="font-medium text-gold-dim">🏆 {d.drawerName}</span>
                    <span className="text-[10px] uppercase text-ink-muted">{d.assignedVia === 'shuffle' ? '(shuffled)' : '(assigned)'}</span>
                  </span>
                ) : (
                  <span className="text-xs text-ink-muted">Not yet assigned</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
