import { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}
function toDateInput(v: string | null) {
  if (!v) return '';
  return new Date(v).toISOString().slice(0, 10);
}

interface Donation { id: string; member_name: string; amount: string; donated_at: string; member_status: string | null; }
interface SanthaEntry { id: string; member_name: string; round_label: string; amount: string; entry_date: string | null; member_status: string | null; }
interface Expense { id: string; category: string; description: string; amount: string; spent_at: string; }
interface ChitProfitRow { id: string; label: string; fiscal_year_label: string; profit_amount: string; }
interface SettlementYear { fiscal_year_label: string; santha_donation: string; chit_profit: string; expenses: string; principal: string; profit_6pct: string; }
interface SettlementData { years: SettlementYear[]; totals: { total_principal: number; total_profit: number; finalSettlementValue: number } }

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

  const [expForm, setExpForm] = useState({ date: '', category: 'OFFICE', description: '', amount: '' });
  const [santhaForm, setSanthaForm] = useState({ date: '', name: '', ravi: '', vv: '' });
  const [donationForm, setDonationForm] = useState({ date: '', name: '', amount: '' });
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

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

  const donationTotal = donations.reduce((s, d) => s + Number(d.amount), 0);
  const santhaTotal = santha.reduce((s, x) => s + Number(x.amount), 0);
  const expensesTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const chitProfitTotal = chitProfit.reduce((s, c) => s + Number(c.profit_amount), 0);

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await client.post('/expenses', {
        category: expForm.category,
        description: expForm.description,
        amount: Number(expForm.amount),
        spentAt: expForm.date || undefined,
      });
      setExpForm({ date: '', category: 'OFFICE', description: '', amount: '' });
      loadAll();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not add expense.');
    }
  }

  async function handleAddSantha(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!santhaForm.name.trim()) {
      setError('Enter a member name.');
      return;
    }
    const raviAmt = Number(santhaForm.ravi) || 0;
    const vvAmt = Number(santhaForm.vv) || 0;
    if (raviAmt <= 0 && vvAmt <= 0) {
      setError('Enter at least one amount (Santha to Ravi or Santha to VV).');
      return;
    }
    try {
      if (raviAmt > 0) {
        await client.post('/funds/santha', { memberName: santhaForm.name, roundLabel: 'Santha to Ravi', amount: raviAmt, entryDate: santhaForm.date || undefined });
      }
      if (vvAmt > 0) {
        await client.post('/funds/santha', { memberName: santhaForm.name, roundLabel: 'Santha to VV', amount: vvAmt, entryDate: santhaForm.date || undefined });
      }
      setSanthaForm({ date: '', name: '', ravi: '', vv: '' });
      loadAll();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not add Santha entry.');
    }
  }

  async function handleAddDonation(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!donationForm.name.trim() || !donationForm.amount) {
      setError('Enter a member name and amount.');
      return;
    }
    try {
      await client.post('/funds/donations', { memberName: donationForm.name, amount: Number(donationForm.amount), donatedAt: donationForm.date || undefined });
      setDonationForm({ date: '', name: '', amount: '' });
      loadAll();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not add donation.');
    }
  }

  function startEdit(id: string, values: Record<string, string>) {
    setEditingId(id);
    setEditValues(values);
    setError(null);
  }
  function cancelEdit() {
    setEditingId(null);
    setEditValues({});
  }

  async function saveEditDonation(id: string) {
    try {
      await client.patch(`/funds/donations/${id}`, {
        memberName: editValues.memberName,
        amount: Number(editValues.amount),
        donatedAt: editValues.date || undefined,
      });
      cancelEdit();
      loadAll();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not update donation.');
    }
  }

  async function saveEditSantha(id: string) {
    try {
      await client.patch(`/funds/santha/${id}`, {
        memberName: editValues.memberName,
        amount: Number(editValues.amount),
        entryDate: editValues.date || undefined,
      });
      cancelEdit();
      loadAll();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not update Santha entry.');
    }
  }

  async function saveEditExpense(id: string) {
    try {
      await client.patch(`/expenses/${id}`, {
        description: editValues.description,
        amount: Number(editValues.amount),
        spentAt: editValues.date || undefined,
      });
      cancelEdit();
      loadAll();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not update expense.');
    }
  }

  const TABS: { key: typeof tab; label: string; total?: number }[] = [
    { key: 'settlement', label: 'Settlement' },
    { key: 'donation', label: 'Donation', total: donationTotal },
    { key: 'santha', label: 'Santha', total: santhaTotal },
    { key: 'expenses', label: 'Expenses', total: expensesTotal },
    { key: 'chitProfit', label: 'Chit Profit', total: chitProfitTotal },
  ];
  const activeTabInfo = TABS.find((t) => t.key === tab);

  return (
    <div className="space-y-6">
      <p className="text-ink-muted text-sm">Donation, Santha, Expenses, historical Chit profit, and the Final Settlement ledger.</p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-line overflow-hidden text-sm font-medium">
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
        {activeTabInfo?.total !== undefined && (
          <span className="text-xs bg-gold/20 text-gold-dim px-3 py-1.5 rounded-full font-bold font-tabular">
            {formatINR(activeTabInfo.total)}
          </span>
        )}
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
              <p className="text-xs text-ink-muted">Historical years are a fixed ledger import; totals above are always summed live, never hardcoded.</p>
            </div>
          )}

          {tab === 'donation' && (
            <div className="space-y-4">
              {canManage && (
                <form onSubmit={handleAddDonation} className="ledger-card p-5">
                  <h3 className="font-bold mb-3">Add Donation Entry</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                      <label className="block text-xs font-semibold text-ink-muted mb-1">Date</label>
                      <input type="date" value={donationForm.date} onChange={(e) => setDonationForm({ ...donationForm, date: e.target.value })} className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink-muted mb-1">Name</label>
                      <input placeholder="e.g. Ravi" value={donationForm.name} onChange={(e) => setDonationForm({ ...donationForm, name: e.target.value })} className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink-muted mb-1">Donation Amount (₹)</label>
                      <input type="number" placeholder="0" value={donationForm.amount} onChange={(e) => setDonationForm({ ...donationForm, amount: e.target.value })} className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
                    </div>
                    <button type="submit" className="rounded-lg bg-navy text-white px-5 py-2 text-sm font-bold cursor-pointer whitespace-nowrap">+ Add</button>
                  </div>
                  {error && <p className="text-sm text-danger mt-2">{error}</p>}
                </form>
              )}
              <div className="ledger-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-paper text-ink-muted text-xs uppercase tracking-wide">
                    <tr><th className="text-left px-4 py-2">Date</th><th className="text-left px-4 py-2">Member</th><th className="text-right px-4 py-2">Amount</th>{canManage && <th className="text-right px-4 py-2">Action</th>}</tr>
                  </thead>
                  <tbody>
                    {donations.map((d) => (
                      <tr key={d.id} className="border-t border-line">
                        {editingId === d.id ? (
                          <>
                            <td className="px-4 py-2"><input type="date" value={editValues.date} onChange={(e) => setEditValues({ ...editValues, date: e.target.value })} className="rounded border border-line px-2 py-1 text-xs w-full" /></td>
                            <td className="px-4 py-2"><input value={editValues.memberName} onChange={(e) => setEditValues({ ...editValues, memberName: e.target.value })} className="rounded border border-line px-2 py-1 text-xs w-full" /></td>
                            <td className="px-4 py-2"><input type="number" value={editValues.amount} onChange={(e) => setEditValues({ ...editValues, amount: e.target.value })} className="rounded border border-line px-2 py-1 text-xs w-full text-right" /></td>
                            <td className="px-4 py-2 text-right whitespace-nowrap">
                              <button onClick={() => saveEditDonation(d.id)} className="text-xs text-success bg-success/10 px-2 py-1 rounded cursor-pointer mr-1">Save</button>
                              <button onClick={cancelEdit} className="text-xs text-ink-muted bg-line px-2 py-1 rounded cursor-pointer">Cancel</button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-2.5 text-ink-muted">{d.donated_at ? new Date(d.donated_at).toLocaleDateString('en-IN') : '—'}</td>
                            <td className="px-4 py-2.5">{d.member_name}{!d.member_status && <span className="text-xs text-ink-muted ml-1">(former member)</span>}</td>
                            <td className="px-4 py-2.5 text-right font-tabular">{formatINR(Number(d.amount))}</td>
                            {canManage && (
                              <td className="px-4 py-2.5 text-right">
                                <button onClick={() => startEdit(d.id, { date: toDateInput(d.donated_at), memberName: d.member_name, amount: d.amount })} className="text-xs text-navy bg-navy/10 px-2 py-1 rounded cursor-pointer">Edit</button>
                              </td>
                            )}
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'santha' && (
            <div className="space-y-4">
              {canManage && (
                <form onSubmit={handleAddSantha} className="ledger-card p-5">
                  <h3 className="font-bold mb-3">Add Santha Entry</h3>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <div>
                      <label className="block text-xs font-semibold text-ink-muted mb-1">Date</label>
                      <input type="date" value={santhaForm.date} onChange={(e) => setSanthaForm({ ...santhaForm, date: e.target.value })} className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink-muted mb-1">Name</label>
                      <input placeholder="e.g. Veeraman" value={santhaForm.name} onChange={(e) => setSanthaForm({ ...santhaForm, name: e.target.value })} className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink-muted mb-1">Santha to Ravi (₹)</label>
                      <input type="number" placeholder="0" value={santhaForm.ravi} onChange={(e) => setSanthaForm({ ...santhaForm, ravi: e.target.value })} className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink-muted mb-1">Santha to VV (₹)</label>
                      <input type="number" placeholder="0" value={santhaForm.vv} onChange={(e) => setSanthaForm({ ...santhaForm, vv: e.target.value })} className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
                    </div>
                    <button type="submit" className="rounded-lg bg-navy text-white px-5 py-2 text-sm font-bold cursor-pointer whitespace-nowrap">+ Add</button>
                  </div>
                  {error && <p className="text-sm text-danger mt-2">{error}</p>}
                </form>
              )}
              <div className="ledger-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-paper text-ink-muted text-xs uppercase tracking-wide">
                    <tr><th className="text-left px-4 py-2">Date</th><th className="text-left px-4 py-2">Member</th><th className="text-left px-4 py-2">Round</th><th className="text-right px-4 py-2">Amount</th>{canManage && <th className="text-right px-4 py-2">Action</th>}</tr>
                  </thead>
                  <tbody>
                    {santha.map((s) => (
                      <tr key={s.id} className="border-t border-line">
                        {editingId === s.id ? (
                          <>
                            <td className="px-4 py-2"><input type="date" value={editValues.date} onChange={(e) => setEditValues({ ...editValues, date: e.target.value })} className="rounded border border-line px-2 py-1 text-xs w-full" /></td>
                            <td className="px-4 py-2"><input value={editValues.memberName} onChange={(e) => setEditValues({ ...editValues, memberName: e.target.value })} className="rounded border border-line px-2 py-1 text-xs w-full" /></td>
                            <td className="px-4 py-2 text-ink-muted text-xs">{s.round_label}</td>
                            <td className="px-4 py-2"><input type="number" value={editValues.amount} onChange={(e) => setEditValues({ ...editValues, amount: e.target.value })} className="rounded border border-line px-2 py-1 text-xs w-full text-right" /></td>
                            <td className="px-4 py-2 text-right whitespace-nowrap">
                              <button onClick={() => saveEditSantha(s.id)} className="text-xs text-success bg-success/10 px-2 py-1 rounded cursor-pointer mr-1">Save</button>
                              <button onClick={cancelEdit} className="text-xs text-ink-muted bg-line px-2 py-1 rounded cursor-pointer">Cancel</button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-2.5 text-ink-muted">{s.entry_date ? new Date(s.entry_date).toLocaleDateString('en-IN') : '—'}</td>
                            <td className="px-4 py-2.5">{s.member_name}{!s.member_status && <span className="text-xs text-ink-muted ml-1">(former member)</span>}</td>
                            <td className="px-4 py-2.5">{s.round_label}</td>
                            <td className="px-4 py-2.5 text-right font-tabular">{formatINR(Number(s.amount))}</td>
                            {canManage && (
                              <td className="px-4 py-2.5 text-right">
                                <button onClick={() => startEdit(s.id, { date: toDateInput(s.entry_date), memberName: s.member_name, amount: s.amount })} className="text-xs text-navy bg-navy/10 px-2 py-1 rounded cursor-pointer">Edit</button>
                              </td>
                            )}
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'expenses' && (
            <div className="space-y-4">
              {canManage && (
                <form onSubmit={handleAddExpense} className="ledger-card p-5">
                  <h3 className="font-bold mb-3">Add Expense</h3>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    <div>
                      <label className="block text-xs font-semibold text-ink-muted mb-1">Date</label>
                      <input type="date" value={expForm.date} onChange={(e) => setExpForm({ ...expForm, date: e.target.value })} className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink-muted mb-1">Category</label>
                      <select value={expForm.category} onChange={(e) => setExpForm({ ...expForm, category: e.target.value })} className="w-full rounded-lg border border-line px-3 py-2 text-sm">
                        <option value="OFFICE">Office</option>
                        <option value="MISCELLANEOUS">Miscellaneous</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink-muted mb-1">Description</label>
                      <input required placeholder="Purpose of expense" value={expForm.description} onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-ink-muted mb-1">Amount (₹)</label>
                      <input required type="number" placeholder="0" value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
                    </div>
                    <button type="submit" className="rounded-lg bg-gold text-navy px-5 py-2 text-sm font-bold cursor-pointer whitespace-nowrap">+ Add</button>
                  </div>
                  {error && <p className="text-sm text-danger mt-2">{error}</p>}
                </form>
              )}
              <div className="ledger-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-paper text-ink-muted text-xs uppercase tracking-wide">
                    <tr><th className="text-left px-4 py-2">Date</th><th className="text-left px-4 py-2">Description</th><th className="text-right px-4 py-2">Amount</th>{canManage && <th className="text-right px-4 py-2">Action</th>}</tr>
                  </thead>
                  <tbody>
                    {expenses.map((e) => (
                      <tr key={e.id} className="border-t border-line">
                        {editingId === e.id ? (
                          <>
                            <td className="px-4 py-2"><input type="date" value={editValues.date} onChange={(ev) => setEditValues({ ...editValues, date: ev.target.value })} className="rounded border border-line px-2 py-1 text-xs w-full" /></td>
                            <td className="px-4 py-2"><input value={editValues.description} onChange={(ev) => setEditValues({ ...editValues, description: ev.target.value })} className="rounded border border-line px-2 py-1 text-xs w-full" /></td>
                            <td className="px-4 py-2"><input type="number" value={editValues.amount} onChange={(ev) => setEditValues({ ...editValues, amount: ev.target.value })} className="rounded border border-line px-2 py-1 text-xs w-full text-right" /></td>
                            <td className="px-4 py-2 text-right whitespace-nowrap">
                              <button onClick={() => saveEditExpense(e.id)} className="text-xs text-success bg-success/10 px-2 py-1 rounded cursor-pointer mr-1">Save</button>
                              <button onClick={cancelEdit} className="text-xs text-ink-muted bg-line px-2 py-1 rounded cursor-pointer">Cancel</button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-2.5 text-ink-muted">{new Date(e.spent_at).toLocaleDateString('en-IN')}</td>
                            <td className="px-4 py-2.5">{e.description}</td>
                            <td className="px-4 py-2.5 text-right font-tabular">{formatINR(Number(e.amount))}</td>
                            {canManage && (
                              <td className="px-4 py-2.5 text-right">
                                <button onClick={() => startEdit(e.id, { date: toDateInput(e.spent_at), description: e.description, amount: e.amount })} className="text-xs text-navy bg-navy/10 px-2 py-1 rounded cursor-pointer">Edit</button>
                              </td>
                            )}
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
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
              <p className="text-xs text-ink-muted px-4 py-3 border-t border-line">
                Historical pre-app chit rounds — read-only import. New chits run through the Chit Management module instead.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
