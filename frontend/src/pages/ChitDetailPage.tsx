import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import client from '../api/client';
import type { ChitDetail, Member } from '../types';
import { useAuth } from '../context/AuthContext';

function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export default function ChitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [chit, setChit] = useState<ChitDetail | null>(null);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [auctionForm, setAuctionForm] = useState<Record<string, { winnerId: string; discountAmount: string }>>({});
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  async function load() {
    const [chitRes, membersRes] = await Promise.all([
      client.get(`/chits/${id}`),
      client.get('/members', { params: { pageSize: 100 } }),
    ]);
    setChit(chitRes.data.data);
    setAllMembers(membersRes.data.data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await client.post(`/chits/${id}/members`, { memberId: selectedMemberId });
      setSelectedMemberId('');
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not add member to chit.');
    }
  }

  async function handleStart() {
    setError(null);
    try {
      await client.post(`/chits/${id}/start`, {});
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not start chit.');
    }
  }

  async function handleClose() {
    setError(null);
    try {
      await client.post(`/chits/${id}/close`);
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not close chit.');
    }
  }

  async function handleCompleteAuction(auctionId: string) {
    setError(null);
    const values = auctionForm[auctionId];
    if (!values?.winnerId || !values?.discountAmount) {
      setError('Select a winner and enter the discount amount first.');
      return;
    }
    try {
      await client.post(`/chits/${id}/auctions/${auctionId}/complete`, {
        winnerId: values.winnerId,
        discountAmount: Number(values.discountAmount),
      });
      load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not complete auction.');
    }
  }

  if (!chit) return <p className="text-ink-muted">Loading…</p>;

  const memberIdsInChit = new Set(chit.members.map((m) => m.memberId));
  const availableMembers = allMembers.filter((m) => !memberIdsInChit.has(m.id) && m.status === 'ACTIVE');

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-display text-2xl">{chit.name}</h2>
          <p className="text-ink-muted text-sm font-tabular mt-1">{chit.refNumber}</p>
        </div>
        <div className="text-right">
          <div className="font-tabular text-2xl text-gold">{formatINR(chit.chitValue)}</div>
          <div className="text-xs text-ink-muted">
            {chit.totalMonths} months · {formatINR(chit.monthlyInstallment)}/month · {chit.commissionPercent}% commission
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="grid grid-cols-2 gap-6">
        <div className="ledger-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">Members ({chit.members.length}/{chit.totalMonths})</h3>
            {chit.status === 'DRAFT' && canManage && chit.members.length === chit.totalMonths && (
              <button onClick={handleStart} className="rounded-lg bg-gold text-ledger px-3 py-1.5 text-xs font-medium">
                Start chit
              </button>
            )}
          </div>
          <ul className="space-y-2 mb-4">
            {chit.members.map((m) => (
              <li key={m.id} className="flex justify-between text-sm border-b border-line pb-2">
                <span>{m.name}</span>
                <span className="text-ink-muted font-tabular">{m.mobileNumber}</span>
              </li>
            ))}
          </ul>
          {chit.status === 'DRAFT' && canManage && (
            <form onSubmit={handleAddMember} className="flex gap-2">
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="flex-1 rounded-lg border border-line px-2 py-1.5 text-sm"
                required
              >
                <option value="">Select a member to add…</option>
                {availableMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.mobileNumber})
                  </option>
                ))}
              </select>
              <button type="submit" className="rounded-lg bg-ledger text-white px-3 py-1.5 text-sm">
                Add
              </button>
            </form>
          )}
        </div>

        <div className="ledger-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">Status</h3>
            {chit.status === 'ACTIVE' && canManage && (
              <button onClick={handleClose} className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-paper">
                Close chit
              </button>
            )}
          </div>
          <p className="text-sm text-ink-muted">
            {chit.status === 'DRAFT' &&
              'Assign exactly one member per month, then start the chit to generate every installment and auction slot.'}
            {chit.status === 'ACTIVE' && 'Chit is running. Complete each month\'s auction below as it happens.'}
            {chit.status === 'CLOSED' && 'This chit has been fully closed out.'}
          </p>
          {chit.startDate && (
            <p className="text-xs text-ink-muted mt-3">Started {new Date(chit.startDate).toLocaleDateString('en-IN')}</p>
          )}
        </div>
      </div>

      {chit.status !== 'DRAFT' && (
        <div className="ledger-card overflow-hidden">
          <div className="px-5 py-3 border-b border-line font-medium">Monthly auctions</div>
          <table className="w-full text-sm">
            <thead className="bg-paper text-ink-muted text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-2">Month</th>
                <th className="text-left px-4 py-2">Scheduled</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Winner / Discount</th>
                <th className="text-left px-4 py-2">Dividend / member</th>
                {canManage && <th className="text-left px-4 py-2">Action</th>}
              </tr>
            </thead>
            <tbody>
              {chit.auctions.map((a) => {
                const winnerName = chit.members.find((m) => m.memberId === a.winnerId)?.name;
                return (
                  <tr key={a.id} className="border-t border-line align-top">
                    <td className="px-4 py-3 font-tabular">{a.monthNumber}</td>
                    <td className="px-4 py-3 text-ink-muted">{new Date(a.scheduledDate).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-3">{a.status}</td>
                    <td className="px-4 py-3">
                      {a.status === 'COMPLETED' ? (
                        <span className="font-tabular">{winnerName} · {formatINR(a.discountAmount || 0)}</span>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-tabular">{a.dividendPerMember ? formatINR(a.dividendPerMember) : '—'}</td>
                    {canManage && (
                      <td className="px-4 py-3">
                        {a.status === 'SCHEDULED' ? (
                          <div className="flex gap-1.5 items-center">
                            <select
                              className="rounded border border-line px-1.5 py-1 text-xs"
                              value={auctionForm[a.id]?.winnerId || ''}
                              onChange={(e) =>
                                setAuctionForm((f) => ({ ...f, [a.id]: { ...f[a.id], winnerId: e.target.value, discountAmount: f[a.id]?.discountAmount || '' } }))
                              }
                            >
                              <option value="">Winner…</option>
                              {chit.members.map((m) => (
                                <option key={m.memberId} value={m.memberId}>
                                  {m.name}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              placeholder="Discount ₹"
                              className="w-24 rounded border border-line px-1.5 py-1 text-xs"
                              value={auctionForm[a.id]?.discountAmount || ''}
                              onChange={(e) =>
                                setAuctionForm((f) => ({ ...f, [a.id]: { ...f[a.id], discountAmount: e.target.value, winnerId: f[a.id]?.winnerId || '' } }))
                              }
                            />
                            <button
                              onClick={() => handleCompleteAuction(a.id)}
                              className="rounded bg-gold text-ledger px-2 py-1 text-xs font-medium"
                            >
                              Complete
                            </button>
                          </div>
                        ) : (
                          <span className="text-ink-muted text-xs">Done</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
