import { useEffect, useRef, useState } from 'react';
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

interface ChitDetailPanelProps {
  chitId: string;
  /** Called after this chit is deleted, so the parent can close/remove it. */
  onDeleted?: () => void;
  /** Called when the viewer has no access (403/404) and dismisses the notice. */
  onRequestClose?: () => void;
}

export default function ChitDetailPanel({ chitId, onDeleted, onRequestClose }: ChitDetailPanelProps) {
  const id = chitId;
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
  const [markingMemberId, setMarkingMemberId] = useState<string | null>(null);
  const [shuffleCycleName, setShuffleCycleName] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [recalling, setRecalling] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Tracks whether we've already auto-picked "the current month" for THIS
  // chit id. Previously the auto-pick logic ran on every loadChit() call
  // (every payment toggle refreshes the chit) and used `selectedMonth === 0`
  // as a proxy for "not yet chosen" - which is wrong, because 0 is also a
  // perfectly valid explicit selection (Month 1). That's what caused the
  // page to jump back to the current month specifically when viewing Month
  // 1 and marking someone paid. Now we only auto-pick once per chit, right
  // after the id changes, and never again on subsequent refreshes.
  const hasAutoSelectedMonth = useRef(false);

  async function loadChit() {
    try {
      const res = await client.get(`/chits/${id}`);
      setChit(res.data.data);
      if (!hasAutoSelectedMonth.current) {
        hasAutoSelectedMonth.current = true;
        const elapsed = res.data.data.monthsElapsed;
        setSelectedMonth(Math.min(elapsed, res.data.data.totalMonths - 1));
      }
    } catch (err: any) {
      // Not a participant (or the chit doesn't exist) - the backend already
      // enforces this; here we just stop rendering internal details instead
      // of getting stuck on "Loading…". Covers refresh and direct-URL entry.
      if (err?.response?.status === 403 || err?.response?.status === 404) {
        setAccessDenied(true);
      } else {
        setError(err?.response?.data?.message || 'Could not load this chit.');
      }
    }
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
    // A fresh chit (navigated from the list, or a different id) should get
    // its own auto-picked month again.
    hasAutoSelectedMonth.current = false;
    loadChit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (chit) loadMonth(selectedMonth);
    setPanel('none');
    setSuccessMessage(null);
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
    setSuccessMessage(null);
    if (panel === p) {
      setPanel('none');
      return;
    }
    setPanel(p);
    if (p === 'ledger') loadLedger();
    if (p === 'participants') loadPendingProofs();
  }

  async function handleTogglePaid(memberId: string, currentlyPaid: boolean) {
    setError(null);
    // Turning OFF (undo a mistake) doesn't need proof - just flip it back.
    if (currentlyPaid) {
      try {
        await client.patch(`/chits/${id}/months/${selectedMonth}/payment`, { memberId });
        loadMonth(selectedMonth);
        loadChit();
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Could not update payment.');
      }
      return;
    }
    // Turning ON requires proof - open the inline choice instead of toggling directly.
    setMarkingMemberId((cur) => (cur === memberId ? null : memberId));
  }

  async function handleMarkAllPaid() {
    if (!monthDetail || markingAll) return; // guards against accidental double-submit
    setError(null);
    setSuccessMessage(null);
    setMarkingAll(true);
    try {
      const currentMonth = selectedMonth; // captured for the confirmation message only
      await client.post(`/chits/${id}/months/${currentMonth}/payment/mark-all`);
      await Promise.all([loadMonth(currentMonth), loadChit()]);
      setSuccessMessage(`All participants marked Paid for ${monthDetail.label}.`);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not mark all as paid.');
    } finally {
      setMarkingAll(false);
    }
  }

  async function handleAdminUploadProof(memberId: string, file: File) {
    setError(null);
    setUploading(true);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const [meta, base64] = dataUrl.split(',');
      const mimeType = meta.match(/data:(.*);base64/)?.[1] || file.type;
      await client.post(`/chits/${id}/months/${selectedMonth}/payment-proof`, { imageData: base64, imageMimeType: mimeType, memberId });
      setMarkingMemberId(null);
      loadMonth(selectedMonth);
      loadChit();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not upload payment proof.');
    } finally {
      setUploading(false);
    }
  }

  async function handleMarkManual(memberId: string) {
    setError(null);
    try {
      await client.post(`/chits/${id}/months/${selectedMonth}/payment-manual`, { memberId });
      setMarkingMemberId(null);
      loadMonth(selectedMonth);
      loadChit();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not mark as paid.');
    }
  }

  async function handleDeleteChit() {
    if (!chit) return;
    if (!window.confirm(`Delete ${chit.refNumber} permanently? This removes all its months, payments, and history. This can't be undone.`)) return;
    setDeleting(true);
    try {
      await client.delete(`/chits/${id}`);
      onDeleted?.();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not delete chit.');
      setDeleting(false);
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

  async function handleRecallDraw() {
    if (!monthDetail?.drawnByMemberId || recalling) return; // guards against accidental double-submit
    if (!window.confirm(`Recall ${monthDetail.drawnByName} as the drawer for ${monthDetail.label}? This month will re-open for Assign/Shuffle.`)) return;
    setError(null);
    setRecalling(true);
    try {
      await client.delete(`/chits/${id}/months/${selectedMonth}/draw`);
      await Promise.all([loadMonth(selectedMonth), loadChit()]);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not recall the drawer.');
    } finally {
      setRecalling(false);
    }
  }

  async function handleShuffle() {
    if (!monthDetail) return;
    setError(null);
    setShuffling(true);
    const names = monthDetail.participants.map((p) => p.name);
    let cycleCount = 0;
    // Cycle through names, slowing down over ~1.8s (classic "wheel slowing
    // to a stop" feel), landing on the real server-decided winner - the
    // animation never picks the winner itself, it just reveals it.
    const cycleInterval = setInterval(() => {
      setShuffleCycleName(names[Math.floor(Math.random() * names.length)]);
      cycleCount++;
    }, 90);

    try {
      const memberIds = monthDetail.participants.map((p) => p.memberId);
      const res = await client.post(`/chits/${id}/months/${selectedMonth}/shuffle`, { memberIds });
      setTimeout(() => {
        clearInterval(cycleInterval);
        setShuffleCycleName(null);
        setShuffleResult({ winnerName: res.data.data.winnerName });
        setShuffling(false);
        loadMonth(selectedMonth);
        loadChit();
      }, 1800);
    } catch (err: any) {
      clearInterval(cycleInterval);
      setShuffleCycleName(null);
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

  if (accessDenied) {
    return (
      <div className="ledger-card p-6 text-center space-y-2">
        <p className="text-ink font-medium">You don't have access to this chit.</p>
        <p className="text-sm text-ink-muted">You can only view chits you're a participant in.</p>
        <button onClick={() => onRequestClose?.()} className="mt-2 rounded-lg bg-navy text-white px-4 py-2 text-sm font-medium cursor-pointer">
          Close
        </button>
      </div>
    );
  }

  if (!chit) {
    return error ? <p className="text-sm text-danger">{error}</p> : <p className="text-ink-muted">Loading…</p>;
  }

  // Derived lock state for Assign/Shuffle, mirroring the rules enforced
  // server-side in assignDraw/performShuffle:
  //  - a month that already has a drawn_by_member_id (assigned OR shuffled)
  //    can't be touched by either action again
  //  - only the single "current" month (isCurrentMonth) is actionable -
  //    past months are settled, future months haven't opened yet
  const monthIsPast = !!monthDetail && !monthDetail.isCurrentMonth && selectedMonth < chit.monthsElapsed;
  const monthIsFuture = !!monthDetail && !monthDetail.isCurrentMonth && selectedMonth > chit.monthsElapsed;
  const drawerAlreadySet = !!monthDetail?.drawnByMemberId;
  const assignLocked = !!monthDetail && (monthDetail.shuffled || drawerAlreadySet || !monthDetail.isCurrentMonth);
  const shuffleLocked = !!monthDetail && (monthDetail.isClub || monthDetail.shuffled || drawerAlreadySet || !monthDetail.isCurrentMonth);
  const monthLockReason = monthIsPast
    ? 'This month has already passed.'
    : monthIsFuture
    ? "This month hasn't opened yet - only the current month is actionable."
    : null;
  const assignLockTitle = monthDetail?.shuffled
    ? "This month was already decided by shuffle - the result is final."
    : drawerAlreadySet
    ? 'A drawer has already been assigned for this month.'
    : monthLockReason || undefined;
  const shuffleLockTitle = monthDetail?.isClub
    ? "Month 2 is always Jolly Friends Club - no shuffle needed."
    : monthDetail?.shuffled
    ? 'Already used for this month - the result is final.'
    : drawerAlreadySet
    ? 'A drawer has already been assigned for this month.'
    : monthLockReason || undefined;

  return (
    <div className="space-y-5">
      <div className="ledger-card p-5">
        <div className="text-xs uppercase tracking-wide text-ink-muted">Jolly Friends Club</div>
        <h2 className="text-xl font-bold mt-0.5">
          {chit.refNumber} — {chit.valueLakh} Lakh / {chit.totalMonths} Months

        </h2>
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
            className={`shrink-0 w-28 h-24 flex flex-col text-left rounded-lg border p-3 cursor-pointer transition-colors ${
              selectedMonth === m.monthIndex ? 'border-gold border-2 bg-white' : 'border-line bg-white hover:border-navy-light'
            }`}
          >
            <div className="text-xs font-bold text-navy">M{m.monthIndex + 1}</div>
            <div className="text-[11px] text-ink-muted mb-1.5">{m.label}</div>
            <div className="h-1 bg-line rounded-full mb-1.5">
              <div className="h-1 bg-success rounded-full" style={{ width: `${m.capacity ? (m.paidCount / m.capacity) * 100 : 0}%` }} />
            </div>
            <div className="text-[11px] text-ink-muted">{m.paidCount}/{m.capacity} paid</div>
            <div className="text-[10px] px-1.5 py-0.5 rounded mt-1 inline-block w-fit" style={{ visibility: m.monthIndex === 1 ? 'visible' : 'hidden' }}>
              <span className="bg-gold/20 text-gold-dim px-1.5 py-0.5 rounded">🏆 Jolly Fri...</span>
            </div>
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {isAdmin && monthDetail && monthLockReason && (
        <p className="text-xs text-ink-muted bg-paper border border-line rounded-lg px-3 py-2">
          🔒 {monthLockReason} Assign and Shuffle are only available for the current month.
        </p>
      )}

      {isAdmin && monthDetail && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button onClick={() => togglePanel('participants')} className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-medium cursor-pointer hover:border-navy-light truncate">
            {panel === 'participants' ? 'Hide Participants' : 'View Participants'}
          </button>
          {/* Shuffle stays visible even after use (or when locked) - just fades to show it's not usable, rather than disappearing and shifting the layout. */}
          <button
            onClick={handleShuffle}
            disabled={shuffling || shuffleLocked}
            title={shuffleLockTitle}
            className={`h-10 rounded-lg bg-navy text-white px-3 text-sm font-medium transition-opacity truncate ${
              shuffleLocked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
            } ${shuffling ? 'opacity-80' : ''}`}
          >
            {shuffling ? (shuffleCycleName || 'Shuffling…') : monthDetail.shuffled ? '🎲 Shuffled ✓' : '🎲 Shuffle'}
          </button>
          <button onClick={() => togglePanel('ledger')} className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-medium cursor-pointer hover:border-navy-light truncate">
            {panel === 'ledger' ? 'Hide Income & Expenses' : 'Income & Expenses'}
          </button>
          <button
            onClick={handleDeleteChit}
            disabled={deleting}
            className="h-10 rounded-lg text-danger bg-danger/10 px-3 text-sm font-medium cursor-pointer hover:bg-danger/20 transition-colors disabled:opacity-50 truncate"
          >
            {deleting ? 'Deleting…' : '🗑 Delete this chit'}
          </button>
        </div>
      )}

      {shuffleResult && (
        <div className="ledger-card p-4 bg-gold/10 border-gold text-center">
          <p className="text-sm">🎉 <strong>{shuffleResult.winnerName}</strong> was drawn for {monthDetail?.label}!</p>
        </div>
      )}

      <div
        className="grid transition-all duration-300 ease-out"
        style={{ gridTemplateRows: isAdmin && panel === 'participants' && monthDetail ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden min-h-0">
          {isAdmin && monthDetail && (
            <div className="ledger-card p-5 mt-0">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <div className="text-xs uppercase tracking-wide text-ink-muted">Participants — Payment &amp; Draw Assignment</div>
                <button
                  onClick={handleMarkAllPaid}
                  disabled={markingAll || monthDetail.participants.length === 0 || monthDetail.participants.every((p) => p.paid)}
                  title="Marks every participant Paid for this month only. Jolly Friends Club is excluded — it never has a payment row."
                  className="text-xs font-medium bg-success text-white px-3 py-1.5 rounded-md cursor-pointer hover:bg-success/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {markingAll ? 'Marking…' : '✓ Select All Paid'}
                </button>
              </div>
              {successMessage && (
                <div className="mb-3 text-xs font-medium text-success bg-success/10 px-3 py-2 rounded-md">{successMessage}</div>
              )}
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
                  <div
                    key={p.memberId}
                    className={`rounded-lg p-3 flex flex-col items-center gap-1.5 text-center transition-colors ${
                      p.isDrawer
                        ? 'border-2 border-gold bg-gold/10 shadow-sm'
                        : 'border border-line'
                    }`}
                  >
                    {p.isDrawer && (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-gold-dim bg-gold/20 px-2 py-0.5 rounded-full">
                        🏆 Drawer
                      </span>
                    )}
                    <div className={`w-10 h-10 rounded-full text-white flex items-center justify-center text-sm font-bold ${p.isDrawer ? 'bg-gold-dim' : 'bg-navy'}`}>
                      {initials(p.name)}
                    </div>
                    <div className={`text-sm ${p.isDrawer ? 'font-bold text-gold-dim' : 'font-medium'}`}>{p.name}</div>
                    <label className="flex items-center gap-1.5 text-xs text-ink-muted">
                      <span>Paid</span>
                      <button
                        role="switch" aria-checked={p.paid}
                        onClick={() => handleTogglePaid(p.memberId, p.paid)}
                        className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${p.paid ? 'bg-success' : 'bg-line'}`}
                      >
                        <span className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform" style={{ transform: p.paid ? 'translateX(16px)' : 'translateX(0)' }} />
                      </button>
                    </label>

                    {markingMemberId === p.memberId && !p.paid && (
                      <div className="w-full bg-paper rounded-md p-2 space-y-1.5">
                        <p className="text-[10px] text-ink-muted">Proof needed to mark paid:</p>
                        <label className="block text-xs bg-navy text-white rounded px-2 py-1 cursor-pointer text-center">
                          {uploading ? 'Uploading…' : '📤 Upload screenshot'}
                          <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => e.target.files?.[0] && handleAdminUploadProof(p.memberId, e.target.files[0])} />
                        </label>
                        <button onClick={() => handleMarkManual(p.memberId)} className="w-full text-xs bg-line text-ink px-2 py-1 rounded cursor-pointer">Mark manually (no screenshot)</button>
                        <button onClick={() => setMarkingMemberId(null)} className="w-full text-[10px] text-ink-muted cursor-pointer">Cancel</button>
                      </div>
                    )}

                    {!monthDetail.isClub && (
                      <button
                        onClick={() => handleAssignDraw(p.memberId)}
                        disabled={assignLocked}
                        title={p.isDrawer ? undefined : assignLockTitle}
                        className="text-xs bg-navy/10 text-navy px-2.5 py-1 rounded-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {p.isDrawer ? '✓ Assigned' : 'Assign as Drawer'}
                      </button>
                    )}
                    {p.isDrawer && monthDetail.isCurrentMonth && (
                      <button
                        onClick={handleRecallDraw}
                        disabled={recalling}
                        title="Undo this assignment and re-open the month for Assign/Shuffle."
                        className="text-xs text-danger underline cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {recalling ? 'Recalling…' : 'Recall'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        className="grid transition-all duration-300 ease-out"
        style={{ gridTemplateRows: isAdmin && panel === 'ledger' && ledger ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden min-h-0">
          {isAdmin && ledger && (
            <div className="ledger-card p-5 mt-0">
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
        </div>
      </div>

      {!isAdmin && monthDetail && (
        <div className="ledger-card p-5 space-y-3">
          <h3 className="font-bold">{monthDetail.label}</h3>
          {monthDetail.isClub && (
            <p className="text-sm text-ink-muted bg-gold/10 rounded-lg px-3 py-2">
              This month's pot goes to Jolly Friends Club — but you (and every participant) still pay your usual monthly amount.
            </p>
          )}

          <div className="flex justify-between text-sm border-b border-line pb-2">
            <span className="text-ink-muted">Your payment this month</span>
            <span className="font-tabular font-bold">{formatINR(monthDetail.monthlyPayment)}</span>
          </div>
          {monthDetail.drawnByName && (
            <p className="text-sm">Drawn by: <strong className="text-gold-dim bg-gold/15 px-2 py-0.5 rounded-md">🏆 {monthDetail.drawnByName}</strong></p>
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

          {/* Once a month's winner is already decided, requesting it no longer makes sense. */}
          {!monthDetail.isClub && !monthDetail.drawnByMemberId && (
            <div className="flex gap-2 pt-2 border-t border-line">
              <button onClick={() => handleSubmitRequest('mandatory')} className="text-xs bg-danger/10 text-danger px-3 py-1.5 rounded-md cursor-pointer">I need this month (mandatory)</button>
              <button onClick={() => handleSubmitRequest('planning')} className="text-xs bg-gold/20 text-gold-dim px-3 py-1.5 rounded-md cursor-pointer">Planning to take this month</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
