import { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

interface Expense {
  id: string;
  category: 'OFFICE' | 'MISCELLANEOUS';
  description: string;
  amount: string;
  spent_at: string;
}

function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export default function FundsPage() {
  const [tab, setTab] = useState<'expenses' | 'donation' | 'santha'>('expenses');
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [form, setForm] = useState({ category: 'OFFICE', description: '', amount: '' });
  const [error, setError] = useState<string | null>(null);
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  async function load() {
    const res = await client.get('/expenses');
    setExpenses(res.data.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await client.post('/expenses', { ...form, amount: Number(form.amount) });
      setForm({ category: 'OFFICE', description: '', amount: '' });
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not add expense.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Funds</h2>
        <p className="text-ink-muted text-sm mt-1">Office/misc expenses, donations, and Santha collections.</p>
      </div>

      <div className="flex rounded-lg border border-line overflow-hidden text-sm font-medium w-fit">
        {(['expenses', 'donation', 'santha'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 capitalize transition-colors ${tab === t ? 'bg-navy text-white' : 'bg-white text-ink-muted'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab !== 'expenses' && (
        <div className="ledger-card p-8 text-center">
          <p className="text-ink-muted">
            {tab === 'donation' ? 'Donation' : 'Santha'} tracking isn't wired up to the backend yet — it needs its
            own database table and API, the same pattern as Expenses below. Tell me the exact fields JFC tracks for{' '}
            {tab === 'donation' ? 'donations' : 'Santha collections'} and I'll build it out.
          </p>
        </div>
      )}

      {tab === 'expenses' && (
        <>
      {canManage && (
        <form onSubmit={handleAdd} className="ledger-card p-5 grid grid-cols-3 gap-4">
          <select
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="rounded-lg border border-line px-3 py-2 text-sm"
          >
            <option value="OFFICE">Office</option>
            <option value="MISCELLANEOUS">Miscellaneous</option>
          </select>
          <input
            required
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="rounded-lg border border-line px-3 py-2 text-sm"
          />
          <input
            required
            type="number"
            placeholder="Amount (₹)"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="rounded-lg border border-line px-3 py-2 text-sm"
          />
          {error && <p className="col-span-3 text-sm text-danger">{error}</p>}
          <button type="submit" className="col-span-3 rounded-lg bg-gold text-navy py-2 text-sm font-medium">
            Add expense
          </button>
        </form>
      )}

      <div className="ledger-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-paper text-ink-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Date</th>
              <th className="text-left px-4 py-3">Category</th>
              <th className="text-left px-4 py-3">Description</th>
              <th className="text-right px-4 py-3">Amount</th>
            </tr>
          </thead>
          <tbody>
            {expenses.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-ink-muted">
                  No expenses recorded yet.
                </td>
              </tr>
            ) : (
              expenses.map((e) => (
                <tr key={e.id} className="border-t border-line">
                  <td className="px-4 py-3 text-ink-muted">{new Date(e.spent_at).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3">{e.category}</td>
                  <td className="px-4 py-3">{e.description}</td>
                  <td className="px-4 py-3 text-right font-tabular">{formatINR(Number(e.amount))}</td>
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
