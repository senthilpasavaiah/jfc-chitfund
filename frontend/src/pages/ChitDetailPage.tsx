import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import client from '../api/client';
import type { ChitDetail, ChitMonthDetail } from '../types';
import { useAuth } from '../context/AuthContext';

function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}
function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

interface LedgerEntry { id: string; month_label: string; category: string; type: 'income' | 'expense'; amount: string; }
interface Ledger { entries: LedgerEntry[]; income: number; expense: number; balance: number; }
interface PendingProof { id: string; member_name: string; month_index: number; created_at: string; }

export default function ChitDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const [chit, setChit] = useState<ChitDetail | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [monthDetail, setMonthDetail] = useState<ChitMonthDetail | null>(null);
  const [panel, setPanel] = useState<'none' | 'participants' | 'ledger'>('none');
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shuffling, setShuffling] = useState(false);
  const [shuffleResult, setShuffleResult] = useState<{ winnerName: string } | null>(null);
  const [myProofStatus, setMyProofStatus] = useState<{ status: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingProofs, setPendingProofs] = useState<PendingProof[]>([]);

  async function loadChit() {
    const res = await client.get(`/chits/${id}`);
    setChit(res.data.data);
    const elapsed = res.data.data.monthsElapsed;
    setSelectedMonth((cur) => (cur === 0 ? Math.min(elapsed, res.data.data.totalMonths - 1) : cur));
  }

  async function loadMonth(monthIndex: number) {
    const res = await client.get(`/chits/${id}/months/${monthIndex}`);
    setMonthDetail(res.data.data);
    setShuffleResult(null);
    if (!isAdmin) {
      const proofRes = await client.get(`/chits/${id}/months/${monthIndex}/payment-proof`);
      setMyProofStatus(proofRes.data.data);
    }
  }

  useEffect(() => {
    loadChit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (chit) loadMonth(selectedMonth);
    setPanel('none');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, chit?.id]);

  async function loadLedger() {
    const res = await client.get(`/chits/${id}/ledger`);
    setLedger(res.data.data);
  }

  async function loadPendingProofs() {
    const res = await client.get('/chits/payment-proofs/pending', { params: { chitId: id } });
    setPendingProofs(res.data.data);
  }

  function togglePanel(p: 'participants' | 'ledger') {
    setError(null);
    if (panel === p) {
      setPanel('none');
      return;
    }
    setPanel(p);
    if (p === 'ledger') loadLedger();
    if (p === 'participants') loadPendingProofs();
  }

  async function handleTogglePaid(memberId: string) {
    setError(null);
    try {
      await client.patch(`/chits/${id}/months/${selectedMonth}/payment`, { memberId });
      loadMonth(selectedMonth);
      loadChit();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not update payment.');
    }
  }

  async function handleAssignDraw(memberId: string) {
    setError(null);
    try {
      await client.patch(`/chits/${id}/months/${selectedMonth}/draw`, { memberId });
      loadMonth(selectedMonth);
      loadChit();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not assign draw.');
    }
  }

  async function handleShuffle() {
    if (!monthDetail) return;
    setError(null);
    setShuffling(true);
    try {
      const memberIds = monthDetail.participants.map((p) => p.memberId);
      const res = await client.post(`/chits/${id}/months/${selectedMonth}/shuffle`, { memberIds });
      setTimeout(() => {
        setShuffleResult({ winnerName: res.data.data.winnerName });
        setShuffling(false);
        loadMonth(selectedMonth);
        loadChit();
      }, 1200);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not shuffle.');
      setShuffling(false);
    }
  }

  async function handleUploadProof(file: File) {
    setError(null);
    setUploading(true);
    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const [meta, base64] = dataUrl.split(',');
      const mimeType = meta.match(/data:(.*);base64/)?.[1] || file.type;
      await client.post(`/chits/${id}/months/${selectedMonth}/payment-proof`, { imageData: base64, imageMimeType: mimeType });
      loadMonth(selectedMonth);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not upload payment proof.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmitRequest(type: 'mandatory' | 'planning') {
    setError(null);
    try {
      await client.post(`/chits/${id}/months/${selectedMonth}/request`, { type });
      loadMonth(selectedMonth);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not submit request.');
    }
  }

  async function handleReviewProof(proofId: string, decision: 'confirm' | 'reject') {
    setError(null);
    try {
      await client.patch(`/chits/payment-proofs/${proofId}/review`, { decision });
      loadPendingProofs();
      loadMonth(selectedMonth);
      loadChit();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not review proof.');
    }
  }

  if (!chit) return <p className="text-ink-muted">Loading…</p>;

  return (
    <div className="space-y-5">
      <div className="ledger-card p-5">
        <div className="text-xs uppercase tracking-wide text-ink-muted">Jolly Friends Club</div>
        <h2 className="text-xl font-bold mt-0.5">{chit.refNumber} — {chit.valueLakh} Lakh / {chit.totalMonths} Months</h2>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-muted mt-2">
          <span>Start Date: <strong className="text-ink font-tabular">{chit.startDate ? new Date(chit.startDate).toLocaleDateString('en-IN') : '—'}</strong></span>
          <span>End Date: <strong className="text-ink font-tabular">{chit.endDate ? new Date(chit.endDate).toLocaleDateString('en-IN') : '—'}</strong></span>
          <span>Months Elapsed: <strong className="text-ink">{chit.monthsElapsed}</strong></span>
          <span>Months Remaining: <strong className="text-ink">{chit.monthsRemaining}</strong></span>
          <span>Base monthly: <strong className="text-ink font-tabular">{formatINR(chit.baseMonthly)}</strong></span>
          <span>Commission/month: <strong className="text-ink font-tabular">{formatINR(chit.commissionPerMonth)}</strong></span>
        </div>
        <span className="inline-block mt-2 text-xs bg-success/10 text-success px-2.5 py-1 rounded-full font-medium">{chit.filled}/{chit.capacity} members</span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {chit.timeline.map((m) => (
          <button
            key={m.monthIndex}
            onClick={() => setSelectedMonth(m.monthIndex)}
            className={`shrink-0 w-28 text-left rounded-lg border p-3 cursor-pointer transition-colors ${
              selectedMonth === m.monthIndex ? 'border-gold border-2 bg-white' : 'border-line bg-white hover:border-navy-light'
            }`}
          >
            <div className="text-xs font-bold text-navy">M{m.monthIndex + 1}</div>
            <div className="text-[11px] text-ink-muted mb-1.5">{m.label}</div>
            <div className="h-1 bg-line rounded-full mb-1.5">
              <div className="h-1 bg-success rounded-full" style={{ width: `${m.capacity ? (m.paidCount / m.capacity) * 100 : 0}%` }} />
            </div>
            <div className="text-[11px] text-ink-muted">{m.paidCount}/{m.capacity} paid</div>
            {m.monthIndex === 1 && <div className="text-[10px] bg-gold/20 text-gold-dim px-1.5 py-0.5 rounded mt-1 inline-block">🏆 Jolly Fri...</div>}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {isAdmin && monthDetail && !monthDetail.isClub && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => togglePanel('participants')} className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium cursor-pointer hover:border-navy-light">
            {panel === 'participants' ? 'Hide Participants' : 'View Participants'}
          </button>
          {!monthDetail.shuffled && (
            <button onClick={handleShuffle} disabled={shuffling} className="rounded-lg bg-navy text-white px-4 py-2 text-sm font-medium cursor-pointer disabled:opacity-60">
              {shuffling ? 'Shuffling…' : '🎲 Shuffle'}
            </button>
          )}
          <button onClick={() => togglePanel('ledger')} className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-medium cursor-pointer hover:border-navy-light">
            {panel === 'ledger' ? 'Hide Income & Expenses' : 'Income & Expenses'}
          </button>
        </div>
      )}

      {shuffleResult && (
        <div className="ledger-card p-4 bg-gold/10 border-gold text-center">
          <p className="text-sm">🎉 <strong>{shuffleResult.winnerName}</strong> was drawn for {monthDetail?.label}!</p>
        </div>
      )}

      {isAdmin && panel === 'participants' && monthDetail && (
        <div className="ledger-card p-5">
          <div className="text-xs uppercase tracking-wide text-ink-muted mb-3">Participants — Payment &amp; Draw Assignment</div>
          {pendingProofs.length > 0 && (
            <div className="mb-4 p-3 bg-gold/10 border border-gold rounded-lg">
              <div className="text-xs font-bold mb-2">Pending payment proofs</div>
              {pendingProofs.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm py-1">
                  <span>{p.member_name} — Month {p.month_index + 1}</span>
                  <div className="flex gap-1.5">
                    <a href={`${client.defaults.baseURL}/chits/payment-proofs/${p.id}/image`} target="_blank" rel="noreferrer" className="text-xs text-navy underline">View</a>
                    <button onClick={() => handleReviewProof(p.id, 'confirm')} className="text-xs bg-success text-white px-2 py-0.5 rounded cursor-pointer">Confirm</button>
                    <button onClick={() => handleReviewProof(p.id, 'reject')} className="text-xs bg-danger text-white px-2 py-0.5 rounded cursor-pointer">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {monthDetail.participants.map((p) => (
              <div key={p.memberId} className="border border-line rounded-lg p-3 flex flex-col items-center gap-1.5 text-center">
                <div className="w-10 h-10 rounded-full bg-navy text-white flex items-center justify-center text-sm font-bold">{initials(p.name)}</div>
                <div className="text-sm font-medium">{p.name}</div>
                <label className="flex items-center gap-1.5 text-xs text-ink-muted">
                  <span>Paid</span>
                  <button
                    role="switch" aria-checked={p.paid}
                    onClick={() => handleTogglePaid(p.memberId)}
                    className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${p.paid ? 'bg-success' : 'bg-line'}`}
                  >
                    <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform" style={{ transform: p.paid ? 'translateX(16px)' : 'translateX(0)' }} />
                  </button>
                </label>
                <button
                  onClick={() => handleAssignDraw(p.memberId)}
                  disabled={monthDetail.shuffled}
                  className="text-xs bg-navy/10 text-navy px-2.5 py-1 rounded-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {p.isDrawer ? '✓ Assigned' : 'Assign as Drawer'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {isAdmin && panel === 'ledger' && ledger && (
        <div className="ledger-card p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold">Chit Income &amp; Expenses</h3>
            <span className="text-xs bg-gold/20 text-gold-dim px-2.5 py-1 rounded-full font-medium">Auto-booked</span>
          </div>
          <p className="text-xs text-ink-muted mb-3">Recorded automatically as each month of this chit is reached — no manual entry needed.</p>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="border-l-4 border-success bg-white rounded-lg p-3">
              <div className="text-xs text-ink-muted uppercase">Income</div>
              <div className="text-lg font-bold text-navy font-tabular">{formatINR(ledger.income)}</div>
            </div>
            <div className="border-l-4 border-danger bg-white rounded-lg p-3">
              <div className="text-xs text-ink-muted uppercase">Expense</div>
              <div className="text-lg font-bold text-navy font-tabular">{formatINR(ledger.expense)}</div>
            </div>
            <div className="border-l-4 border-navy bg-white rounded-lg p-3">
              <div className="text-xs text-ink-muted uppercase">Balance</div>
              <div className="text-lg font-bold text-navy font-tabular">{formatINR(ledger.balance)}</div>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="text-ink-muted text-xs uppercase border-b border-line">
              <tr><th className="text-left py-2">Month</th><th className="text-left py-2">Category</th><th className="text-left py-2">Type</th><th className="text-right py-2">Amount</th></tr>
            </thead>
            <tbody>
              {ledger.entries.map((e) => (
                <tr key={e.id} className="border-b border-line">
                  <td className="py-2">{e.month_label}</td>
                  <td className="py-2">{e.category}</td>
                  <td className="py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${e.type === 'income' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                      {e.type === 'income' ? 'Income' : 'Expense'}
                    </span>
                  </td>
                  <td className="py-2 text-right font-tabular">{formatINR(Number(e.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!isAdmin && monthDetail && (
        <div className="ledger-card p-5 space-y-3">
          <h3 className="font-bold">{monthDetail.label}</h3>
          {monthDetail.isClub ? (
            <p className="text-sm text-ink-muted">This month's pot goes to Jolly Friends Club — no draw needed.</p>
          ) : (
            <>
              <div className="flex justify-between text-sm border-b border-line pb-2">
                <span className="text-ink-muted">Your payment this month</span>
                <span className="font-tabular font-bold">{formatINR(monthDetail.monthlyPayment)}</span>
              </div>
              {monthDetail.drawnByName && (
                <p className="text-sm">Drawn by: <strong>{monthDetail.drawnByName}</strong></p>
              )}

              {myProofStatus?.status === 'confirmed' && (
                <p className="text-sm text-success font-medium">✓ Your payment for this month is confirmed.</p>
              )}
              {myProofStatus?.status === 'pending' && (
                <p className="text-sm text-gold-dim font-medium">⏳ Your payment proof is awaiting admin review.</p>
              )}
              {myProofStatus?.status === 'rejected' && (
                <p className="text-sm text-danger">Your last submission was rejected. Please upload a new screenshot.</p>
              )}
              {(!myProofStatus || myProofStatus.status === 'rejected') && (
                <div>
                  <label className="inline-block rounded-lg bg-navy text-white px-4 py-2 text-sm font-medium cursor-pointer hover:bg-navy-light transition-colors">
                    {uploading ? 'Uploading…' : '📤 Upload Payment Screenshot'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => e.target.files?.[0] && handleUploadProof(e.target.files[0])}
                    />
                  </label>
                  <p className="text-xs text-ink-muted mt-1.5">Upload your bank transfer / UPI / SMS screenshot — an admin will verify and confirm it.</p>
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t border-line">
                <button onClick={() => handleSubmitRequest('mandatory')} className="text-xs bg-danger/10 text-danger px-3 py-1.5 rounded-md cursor-pointer">I need this month (mandatory)</button>
                <button onClick={() => handleSubmitRequest('planning')} className="text-xs bg-gold/20 text-gold-dim px-3 py-1.5 rounded-md cursor-pointer">Planning to take this month</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
