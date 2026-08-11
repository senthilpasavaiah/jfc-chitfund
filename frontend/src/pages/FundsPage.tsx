import { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

interface Donation { id: string; member_name: string; amount: string; donated_at: string; notes: string | null; member_status: string | null; }
interface SanthaEntry { id: string; member_name: string; round_label: string; amount: string; member_status: string | null; }
interface Expense { id: string; category: string; description: string; amount: string; spent_at: string; }
interface ChitProfitRow { id: string; label: string; fiscal_year_label: string; profit_amount: string; }
interface SettlementYear { fiscal_year_label: string; santha_donation: string; chit_profit: string; expenses: string; principal: string; profit_6pct: string; }
interface SettlementData { years: SettlementYear[]; totals: { total_santha_donation: number; total_chit_profit: number; total_expenses: number; total_principal: number; total_profit: number; finalSettlementValue: number }; }

export default function FundsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'donation' | 'santha' | 'expenses' | 'chitProfit' | 'settlement'>('settlement');
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const [donations, setDonations] = useState<Donation[]>([]);
  const [santha, setSantha] = useState<SanthaEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [chitProfit, setChitProfit] = useState<ChitProfitRow[]>([]);
  const [settlement, setSettlement] = useState<SettlementData | null>(null);
  const [loading, setLoading] = useState(true);

  const [expForm, setExpForm] = useState({ category: 'OFFICE', description: '', amount: '' });
  const [error, setError] = useState<string | null>(null);

  async function loadAll() {
    setLoading(true);
    const [d, s, e, c, st] = await Promise.all([
      client.get('/funds/donations'),
      client.get('/funds/santha'),
      client.get('/expenses'),
      client.get('/funds/chit-profit-history'),
      client.get('/funds/settlement'),
    ]);
    setDonations(d.data.data);
    setSantha(s.data.data);
    setExpenses(e.data.data);
    setChitProfit(c.data.data);
    setSettlement(st.data.data);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await client.post('/expenses', { ...expForm, amount: Number(expForm.amount) });
      setExpForm({ category: 'OFFICE', description: '', amount: '' });
      loadAll();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not add expense.');
    }
  }

  const TABS: { key: typeof tab; label: string }[] = [
    { key: 'settlement', label: 'Settlement' },
    { key: 'donation', label: 'Donation' },
    { key: 'santha', label: 'Santha' },
    { key: 'expenses', label: 'Expenses' },
    { key: 'chitProfit', label: 'Chit Profit' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Funds</h2>
        <p className="text-ink-muted text-sm mt-1">Donation, Santha, Expenses, historical Chit profit, and the Final Settlement ledger.</p>
      </div>

      <div className="flex rounded-lg border border-line overflow-hidden text-sm font-medium w-fit flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 transition-colors cursor-pointer ${tab === t.key ? 'bg-navy text-white' : 'bg-white text-ink-muted hover:bg-paper'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-ink-muted">Loading…</p>
      ) : (
        <>
          {tab === 'settlement' && settlement && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="ledger-card p-5">
                  <div className="text-xs uppercase tracking-wide text-ink-muted">Total Principal</div>
                  <div className="font-tabular text-xl mt-1 font-bold text-navy">{formatINR(settlement.totals.total_principal)}</div>
                </div>
                <div className="ledger-card p-5">
                  <div className="text-xs uppercase tracking-wide text-ink-muted">Total Profit (6% PA)</div>
                  <div className="font-tabular text-xl mt-1 font-bold text-navy">{formatINR(settlement.totals.total_profit)}</div>
                </div>
                <div className="ledger-card p-5">
                  <div className="text-xs uppercase tracking-wide text-ink-muted">Final Settlement Value</div>
                  <div className="font-tabular text-xl mt-1 font-bold text-gold-dim bg-navy inline-block px-2 rounded">{formatINR(settlement.totals.finalSettlementValue)}</div>
                </div>
              </div>
              <div className="ledger-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-paper text-ink-muted text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-4 py-2">Fiscal Year</th>
                      <th className="text-right px-4 py-2">Santha + Donation</th>
                      <th className="text-right px-4 py-2">Chit Profit</th>
                      <th className="text-right px-4 py-2">Expenses</th>
                      <th className="text-right px-4 py-2">Principal</th>
                      <th className="text-right px-4 py-2">Profit (6%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {settlement.years.map((y) => (
                      <tr key={y.fiscal_year_label} className="border-t border-line">
                        <td className="px-4 py-2.5 font-medium">{y.fiscal_year_label}</td>
                        <td className="px-4 py-2.5 text-right font-tabular">{formatINR(Number(y.santha_donation))}</td>
                        <td className="px-4 py-2.5 text-right font-tabular">{formatINR(Number(y.chit_profit))}</td>
                        <td className="px-4 py-2.5 text-right font-tabular">{formatINR(Number(y.expenses))}</td>
                        <td className="px-4 py-2.5 text-right font-tabular">{formatINR(Number(y.principal))}</td>
                        <td className="px-4 py-2.5 text-right font-tabular">{formatINR(Number(y.profit_6pct))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-ink-muted">Imported from JFC_Santha_Settlement_2026.xlsx — historical years are a fixed ledger; totals above are always summed live, never hardcoded.</p>
            </div>
          )}

          {tab === 'donation' && (
            <div className="ledger-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-paper text-ink-muted text-xs uppercase tracking-wide">
                  <tr><th className="text-left px-4 py-2">Member</th><th className="text-right px-4 py-2">Amount</th><th className="text-left px-4 py-2">Notes</th></tr>
                </thead>
                <tbody>
                  {donations.map((d) => (
                    <tr key={d.id} className="border-t border-line">
                      <td className="px-4 py-2.5">{d.member_name}{!d.member_status && <span className="text-xs text-ink-muted ml-1">(former member)</span>}</td>
                      <td className="px-4 py-2.5 text-right font-tabular">{formatINR(Number(d.amount))}</td>
                      <td className="px-4 py-2.5 text-ink-muted text-xs">{d.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'santha' && (
            <div className="ledger-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-paper text-ink-muted text-xs uppercase tracking-wide">
                  <tr><th className="text-left px-4 py-2">Member</th><th className="text-left px-4 py-2">Round</th><th className="text-right px-4 py-2">Amount</th></tr>
                </thead>
                <tbody>
                  {santha.map((s) => (
                    <tr key={s.id} className="border-t border-line">
                      <td className="px-4 py-2.5">{s.member_name}{!s.member_status && <span className="text-xs text-ink-muted ml-1">(former member)</span>}</td>
                      <td className="px-4 py-2.5">{s.round_label}</td>
                      <td className="px-4 py-2.5 text-right font-tabular">{formatINR(Number(s.amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'expenses' && (
            <>
              {canManage && (
                <form onSubmit={handleAddExpense} className="ledger-card p-5 grid grid-cols-3 gap-4">
                  <select value={expForm.category} onChange={(e) => setExpForm({ ...expForm, category: e.target.value })} className="rounded-lg border border-line px-3 py-2 text-sm">
                    <option value="OFFICE">Office</option>
                    <option value="MISCELLANEOUS">Miscellaneous</option>
                  </select>
                  <input required placeholder="Description" value={expForm.description} onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} className="rounded-lg border border-line px-3 py-2 text-sm" />
                  <input required type="number" placeholder="Amount (₹)" value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} className="rounded-lg border border-line px-3 py-2 text-sm" />
                  {error && <p className="col-span-3 text-sm text-danger">{error}</p>}
                  <button type="submit" className="col-span-3 rounded-lg bg-gold text-navy py-2 text-sm font-medium cursor-pointer">Add expense</button>
                </form>
              )}
              <div className="ledger-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-paper text-ink-muted text-xs uppercase tracking-wide">
                    <tr><th className="text-left px-4 py-2">Date</th><th className="text-left px-4 py-2">Description</th><th className="text-right px-4 py-2">Amount</th></tr>
                  </thead>
                  <tbody>
                    {expenses.map((e) => (
                      <tr key={e.id} className="border-t border-line">
                        <td className="px-4 py-2.5 text-ink-muted">{new Date(e.spent_at).toLocaleDateString('en-IN')}</td>
                        <td className="px-4 py-2.5">{e.description}</td>
                        <td className="px-4 py-2.5 text-right font-tabular">{formatINR(Number(e.amount))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === 'chitProfit' && (
            <div className="ledger-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-paper text-ink-muted text-xs uppercase tracking-wide">
                  <tr><th className="text-left px-4 py-2">Round</th><th className="text-left px-4 py-2">Fiscal Year</th><th className="text-right px-4 py-2">Profit</th></tr>
                </thead>
                <tbody>
                  {chitProfit.map((c) => (
                    <tr key={c.id} className="border-t border-line">
                      <td className="px-4 py-2.5">{c.label}</td>
                      <td className="px-4 py-2.5">{c.fiscal_year_label}</td>
                      <td className="px-4 py-2.5 text-right font-tabular">{formatINR(Number(c.profit_amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
