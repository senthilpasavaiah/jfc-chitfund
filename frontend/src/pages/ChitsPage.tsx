import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import type { Chit } from '../types';
import { useAuth } from '../context/AuthContext';

function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-line text-ink-muted',
  ACTIVE: 'bg-gold/15 text-gold',
  CLOSED: 'bg-success/10 text-success',
  CANCELLED: 'bg-danger/10 text-danger',
};

export default function ChitsPage() {
  const { user } = useAuth();
  const [chits, setChits] = useState<Chit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ refNumber: '', name: '', chitValue: '', totalMonths: '' });
  const [error, setError] = useState<string | null>(null);
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  async function load() {
    const res = await client.get('/chits');
    setChits(res.data.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await client.post('/chits', {
        ...form,
        chitValue: Number(form.chitValue),
        totalMonths: Number(form.totalMonths),
      });
      setForm({ refNumber: '', name: '', chitValue: '', totalMonths: '' });
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not create chit.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Chits</h2>
          <p className="text-ink-muted text-sm mt-1">Every chit fund cycle - draft, running, or closed.</p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded-lg bg-navy text-white px-4 py-2 text-sm font-medium hover:bg-navy-light transition-colors"
          >
            {showForm ? 'Cancel' : '+ New chit'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="ledger-card p-5 grid grid-cols-2 gap-4">
          <input
            required
            placeholder="Reference number (e.g. JFC-CHIT-2026-02)"
            value={form.refNumber}
            onChange={(e) => setForm({ ...form, refNumber: e.target.value })}
            className="rounded-lg border border-line px-3 py-2 text-sm"
          />
          <input
            required
            placeholder="Chit name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-lg border border-line px-3 py-2 text-sm"
          />
          <input
            required
            type="number"
            placeholder="Total chit value (₹)"
            value={form.chitValue}
            onChange={(e) => setForm({ ...form, chitValue: e.target.value })}
            className="rounded-lg border border-line px-3 py-2 text-sm"
          />
          <input
            required
            type="number"
            placeholder="Total months"
            value={form.totalMonths}
            onChange={(e) => setForm({ ...form, totalMonths: e.target.value })}
            className="rounded-lg border border-line px-3 py-2 text-sm"
          />
          {error && <p className="col-span-2 text-sm text-danger">{error}</p>}
          <button type="submit" className="col-span-2 rounded-lg bg-gold text-navy py-2 text-sm font-medium">
            Create chit (starts as Draft)
          </button>
        </form>
      )}

      <div className="grid gap-4">
        {loading ? (
          <p className="text-ink-muted">Loading…</p>
        ) : chits.length === 0 ? (
          <p className="text-ink-muted">No chits yet.</p>
        ) : (
          chits.map((chit) => (
            <Link key={chit.id} to={`/chits/${chit.id}`} className="ledger-card p-5 flex items-center justify-between hover:border-gold transition-colors">
              <div>
                <div className="font-medium">{chit.name}</div>
                <div className="text-xs text-ink-muted font-tabular mt-0.5">{chit.refNumber}</div>
              </div>
              <div className="text-right">
                <div className="font-tabular text-lg">{formatINR(chit.chitValue)}</div>
                <div className="text-xs text-ink-muted">{chit.totalMonths} months · {formatINR(chit.monthlyInstallment)}/mo</div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[chit.status]}`}>{chit.status}</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
