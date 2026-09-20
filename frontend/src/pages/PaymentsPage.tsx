import { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

interface PendingInstallment {
  id: string;
  chit_id: string;
  member_id: string;
  month_number: number;
  due_date: string;
  base_amount: string;
  fine_amount: string;
  dividend_adjustment: string;
  status: string;
}

function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export default function PaymentsPage() {
  const { user } = useAuth();
  const [pending, setPending] = useState<PendingInstallment[]>([]);
  const [loading, setLoading] = useState(true);
  const [payForm, setPayForm] = useState<Record<string, { amount: string; method: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const canRecord = user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'COLLECTOR';

  async function load() {
    setLoading(true);
    const res = await client.get('/payments/pending');
    setPending(res.data.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRecord(installmentId: string) {
    setError(null);
    const values = payForm[installmentId];
    if (!values?.amount) {
      setError('Enter an amount first.');
      return;
    }
    try {
      await client.post('/payments', {
        installmentId,
        amount: Number(values.amount),
        method: values.method || 'CASH',
      });
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not record payment.');
    }
  }

  const amountDue = (i: PendingInstallment) =>
    Number(i.base_amount) + Number(i.fine_amount) - Number(i.dividend_adjustment);

  return (
    <div className="space-y-6">
      <p className="text-ink-muted text-sm">Every pending or overdue installment across all chits.</p>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="ledger-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-paper text-ink-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Month</th>
              <th className="text-left px-4 py-3">Due date</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Amount due</th>
              {canRecord && <th className="text-left px-4 py-3">Record payment</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-muted">Loading…</td>
              </tr>
            ) : pending.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-ink-muted">No pending installments — everything is settled.</td>
              </tr>
            ) : (
              pending.map((i) => (
                <tr key={i.id} className="border-t border-line">
                  <td className="px-4 py-3 font-tabular">{i.month_number}</td>
                  <td className="px-4 py-3 text-ink-muted">{new Date(i.due_date).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${i.status === 'LATE' ? 'bg-danger/10 text-danger' : 'bg-line text-ink-muted'}`}>
                      {i.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-tabular">{formatINR(amountDue(i))}</td>
                  {canRecord && (
                    <td className="px-4 py-3">
                      <div className="flex gap-1.5 items-center">
                        <input
                          type="number"
                          placeholder="₹"
                          className="w-20 rounded border border-line px-1.5 py-1 text-xs"
                          value={payForm[i.id]?.amount || ''}
                          onChange={(e) => setPayForm((f) => ({ ...f, [i.id]: { ...f[i.id], amount: e.target.value, method: f[i.id]?.method || 'CASH' } }))}
                        />
                        <select
                          className="rounded border border-line px-1.5 py-1 text-xs"
                          value={payForm[i.id]?.method || 'CASH'}
                          onChange={(e) => setPayForm((f) => ({ ...f, [i.id]: { ...f[i.id], method: e.target.value, amount: f[i.id]?.amount || '' } }))}
                        >
                          <option value="CASH">Cash</option>
                          <option value="UPI">UPI</option>
                          <option value="BANK_TRANSFER">Bank</option>
                          <option value="CHEQUE">Cheque</option>
                        </select>
                        <button onClick={() => handleRecord(i.id)} className="rounded bg-gold text-navy px-2 py-1 text-xs font-medium">
                          Record
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
