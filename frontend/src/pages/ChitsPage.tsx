import { useEffect, useState } from 'react';
import client from '../api/client';
import type { Chit, RateSchedule } from '../types';
import { useAuth } from '../context/AuthContext';
import ChitDetailPanel from '../components/ChitDetailPanel';

function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

const STATUS_STYLES: Record<string, string> = {
  upcoming: 'bg-line text-ink-muted',
  ongoing: 'bg-gold/15 text-gold-dim',
  completed: 'bg-success/10 text-success',
};

const TABS: { key: 'ongoing' | 'upcoming' | 'completed'; label: string }[] = [
  { key: 'ongoing', label: 'Ongoing' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'completed', label: 'Completed' },
];

interface MemberOption {
  id: string;
  name: string;
  status: string;
}

export default function ChitsPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const [tab, setTab] = useState<'ongoing' | 'upcoming' | 'completed'>('ongoing');
  const [sortBy, setSortBy] = useState<'refNumber' | 'valueLakh' | 'startDate'>('refNumber');
  const [chits, setChits] = useState<Chit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  // Which chits are expanded inline (accordion) - a Set so any number of
  // chits can be open at once, independently of one another.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingRefId, setEditingRefId] = useState<string | null>(null);
  const [editingRefValue, setEditingRefValue] = useState('');
  const [savingRefId, setSavingRefId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await client.get('/chits', { params: { tab } });
    setChits(res.data.data);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  function toggleExpanded(chitId: string) {
    setExpandedIds((cur) => {
      const next = new Set(cur);
      if (next.has(chitId)) next.delete(chitId);
      else next.add(chitId);
      return next;
    });
  }

  function startEditRef(chit: Chit) {
    setEditingRefId(chit.id);
    setEditingRefValue(chit.refNumber);
  }

  async function saveRefNumber(chit: Chit) {
    const next = editingRefValue.trim();
    if (!next || next === chit.refNumber) {
      setEditingRefId(null);
      return;
    }
    setSavingRefId(chit.id);
    try {
      await client.patch(`/chits/${chit.id}/ref-number`, { refNumber: next });
      setEditingRefId(null);
      await load();
    } catch (err: any) {
      window.alert(err?.response?.data?.message || 'Could not update reference number.');
    } finally {
      setSavingRefId(null);
    }
  }

  const sortedChits = [...chits].sort((a, b) => {
    if (sortBy === 'valueLakh') return b.valueLakh - a.valueLakh;
    if (sortBy === 'startDate') return new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime();
    return a.refNumber.localeCompare(b.refNumber);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
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
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="rounded-lg border border-line px-3 py-2 text-sm text-ink-muted cursor-pointer"
          >
            <option value="refNumber">Sort: Reference No.</option>
            <option value="valueLakh">Sort: Chit Value</option>
            <option value="startDate">Sort: Start Date</option>
          </select>
        </div>
        {canManage && (
          <button
            onClick={() => setShowWizard((s) => !s)}
            className="rounded-lg bg-navy text-white px-4 py-2 text-sm font-medium hover:bg-navy-light transition-colors cursor-pointer"
          >
            {showWizard ? 'Cancel' : '+ New Chit'}
          </button>
        )}
      </div>

      {showWizard && (
        <CreateChitWizard
          onDone={() => {
            setShowWizard(false);
            load();
          }}
        />
      )}

      <div className="grid gap-2.5">
        {loading ? (
          <p className="text-ink-muted">Loading…</p>
        ) : sortedChits.length === 0 ? (
          <p className="text-ink-muted">No {tab} chits.</p>
        ) : (
          sortedChits.map((chit) => {
            // canAccess is only sent for logged-in viewers (always true for
            // Admin/Manager). Default to accessible when it's absent so we
            // never accidentally lock people out before the field exists.
            const clickable = canManage || chit.canAccess !== false;
            const isExpanded = expandedIds.has(chit.id);
            const cardContent = (
              <>
                <div className="min-w-0">
                  {editingRefId === chit.id ? (
                    <div className="flex items-center gap-1.5 min-w-0" onClick={(e) => e.stopPropagation()}>
                      <input
                        autoFocus
                        value={editingRefValue}
                        onChange={(e) => setEditingRefValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { e.preventDefault(); saveRefNumber(chit); }
                          if (e.key === 'Escape') setEditingRefId(null);
                        }}
                        className="min-w-0 w-40 rounded-md border border-line px-2 py-1 text-sm font-medium"
                        aria-label="Edit chit reference number"
                        disabled={savingRefId === chit.id}
                      />
                      <button type="button" onClick={() => saveRefNumber(chit)} disabled={savingRefId === chit.id} className="text-xs font-bold text-navy hover:underline disabled:opacity-50">Save</button>
                      <button type="button" onClick={() => setEditingRefId(null)} disabled={savingRefId === chit.id} className="text-xs text-ink-muted hover:underline disabled:opacity-50">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="font-medium truncate">{chit.refNumber}</div>
                      {canManage && (
                        <button type="button" onClick={(e) => { e.stopPropagation(); startEditRef(chit); }} className="shrink-0 text-[11px] text-navy hover:underline" title="Edit chit name/reference">Edit</button>
                      )}
                    </div>
                  )}
                  <div className="text-xs text-ink-muted mt-0.5 truncate">
                    {chit.valueLakh} Lakh · {chit.totalMonths} Months · {chit.rateSchedule === 'jfc' ? '2% Commission' : '3% Commission'}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-tabular text-lg">{formatINR(chit.valueLakh * 100000)}</div>
                  <div className="text-xs text-ink-muted">
                    {chit.status === 'ongoing' ? `Month ${chit.monthsElapsed + 1} of ${chit.totalMonths}` : chit.status === 'upcoming' ? `Starts ${chit.startDate ? new Date(chit.startDate).toLocaleDateString('en-IN') : ''}` : 'Completed'}
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium capitalize ${STATUS_STYLES[chit.status]}`}>{chit.status}</span>
              </>
            );

            if (!clickable) {
              // Not a participant in this chit - shown in the list, but not
              // openable. No hover affordance, no toggle, no navigation.
              return (
                <div
                  key={chit.id}
                  className="ledger-card p-3.5 flex items-center justify-between flex-wrap gap-x-3 gap-y-2 opacity-60 cursor-default select-none"
                  aria-disabled="true"
                  title="You are not a participant in this chit."
                >
                  {cardContent}
                </div>
              );
            }

            return (
              <div key={chit.id} className="ledger-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleExpanded(chit.id)}
                  aria-expanded={isExpanded}
                  className="w-full p-3.5 flex items-center justify-between flex-wrap gap-x-3 gap-y-2 text-left cursor-pointer hover:bg-paper/60 transition-colors"
                >
                  {cardContent}
                  <span className="shrink-0 flex items-center gap-1 text-xs font-medium text-navy border border-line rounded-md px-2.5 py-1 ml-auto sm:ml-0">
                    {isExpanded ? 'Hide' : 'View'}
                    <span className={`inline-block transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>▾</span>
                  </span>
                </button>
                {/* Smooth expand/collapse via animated grid-rows, same pattern used inside the chit detail panel itself. */}
                <div className="grid transition-all duration-300 ease-out" style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}>
                  <div className="overflow-hidden min-h-0">
                    <div className="px-3.5 pb-3.5 pt-3 border-t border-line">
                      {isExpanded && (
                        <ChitDetailPanel
                          chitId={chit.id}
                          onDeleted={() => {
                            toggleExpanded(chit.id);
                            load();
                          }}
                          onRequestClose={() => toggleExpanded(chit.id)}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function CreateChitWizard({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [valueLakh, setValueLakh] = useState('1');
  const [totalMonths, setTotalMonths] = useState<10 | 20>(20);
  const [rateSchedule, setRateSchedule] = useState<RateSchedule>('jfc');
  const [startDate, setStartDate] = useState('');
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (step === 2) {
      client.get('/members', { params: { status: 'ACTIVE', pageSize: 100, search: search || undefined } }).then((res) => {
        setMembers(res.data.data);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, search]);

  const capacity = totalMonths - 1;
  const slots: (string | null)[] = new Array(totalMonths).fill(null);
  slots[1] = 'CLUB';
  let s = 0;
  for (const id of selected) {
    while (slots[s] !== null) s++;
    slots[s] = id;
    s++;
  }
  const memberName = (id: string) => members.find((m) => m.id === id)?.name || id;
  const countFor = (id: string) => selected.filter((x) => x === id).length;

  function addSlotFor(id: string) {
    setSelected((cur) => (cur.length < capacity ? [...cur, id] : cur));
  }
  function removeSlotFor(id: string) {
    setSelected((cur) => {
      const idx = cur.lastIndexOf(id);
      if (idx === -1) return cur;
      return [...cur.slice(0, idx), ...cur.slice(idx + 1)];
    });
  }

  async function handleCreate() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await client.post('/chits', { valueLakh: Number(valueLakh), totalMonths, rateSchedule, startDate: startDate || undefined });
      const chitId = res.data.data.id;
      if (selected.length > 0) {
        await client.post(`/chits/${chitId}/members`, { memberIds: selected });
      }
      onDone();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not create chit.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="ledger-card p-5 space-y-4">
      <div className="flex gap-2 text-xs font-medium">
        {['Chit Details', 'Select Members', 'Review'].map((label, i) => (
          <div key={label} className={`px-3 py-1.5 rounded-full ${step === i + 1 ? 'bg-navy text-white' : 'bg-paper text-ink-muted'}`}>
            {i + 1}. {label}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-ink-muted mb-1">Chit Value (Lakh)</label>
            <select value={valueLakh} onChange={(e) => setValueLakh(e.target.value)} className="w-full rounded-lg border border-line px-3 py-2 text-sm">
              {[1, 2, 2.5, 5, 10, 20, 30, 40, 50].map((l) => (
                <option key={l} value={l}>{l} Lakh</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-muted mb-1">Duration</label>
            <select value={totalMonths} onChange={(e) => setTotalMonths(Number(e.target.value) as 10 | 20)} className="w-full rounded-lg border border-line px-3 py-2 text-sm">
              <option value={10}>10 Months</option>
              <option value={20}>20 Months</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-muted mb-1">Commission Rate</label>
            <select value={rateSchedule} onChange={(e) => setRateSchedule(e.target.value as RateSchedule)} className="w-full rounded-lg border border-line px-3 py-2 text-sm">
              <option value="jfc">2% Commission</option>
              <option value="standard">3% Commission</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-muted mb-1">Start Date</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2 flex justify-end">
            <button onClick={() => setStep(2)} className="rounded-lg bg-navy text-white px-5 py-2 text-sm font-bold cursor-pointer">Next: Select Members →</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 260px' }}>
          <div className="bg-paper rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">Select members</span>
              <span className="text-xs font-medium bg-gold/20 text-gold-dim px-2.5 py-1 rounded-full whitespace-nowrap">
                {capacity - selected.length} of {capacity} slots left
              </span>
            </div>
            <input
              placeholder="Search members…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-line px-3 py-2 text-sm mb-3"
            />
            <div className="grid gap-2.5 max-h-72 overflow-y-auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
              {members.map((m) => {
                const count = countFor(m.id);
                const atCapacity = selected.length >= capacity;
                return (
                  <div key={m.id} className="bg-white border border-line rounded-lg p-2.5 flex flex-col items-center gap-1.5">
                    <div className="w-8 h-8 rounded-full bg-navy text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {m.name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                    </div>
                    <div className="text-xs font-medium text-center whitespace-nowrap overflow-hidden text-ellipsis max-w-full" title={m.name}>{m.name}</div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => removeSlotFor(m.id)}
                        disabled={count === 0}
                        className="w-5 h-5 rounded-full bg-line text-ink flex items-center justify-center text-xs font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        −
                      </button>
                      <span className="text-xs font-bold w-4 text-center" title={count > 1 ? `${count} slots` : undefined}>{count}</span>
                      <button
                        type="button"
                        onClick={() => addSlotFor(m.id)}
                        disabled={atCapacity}
                        className="w-5 h-5 rounded-full bg-success text-white flex items-center justify-center text-xs font-bold cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        +
                      </button>
                    </div>
                    {count > 1 && <span className="text-[10px] text-gold-dim font-medium">{count} slots</span>}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="bg-white border border-line rounded-lg p-4">
            <div className="text-xs font-semibold text-ink-muted mb-2.5">Member rows</div>
            <div className="flex flex-col gap-0.5 max-h-72 overflow-y-auto">
              {slots.map((slot, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded text-xs">
                  <span className="text-ink-muted w-4 shrink-0">{i + 1}</span>
                  <span className={slot ? 'font-medium text-ink' : 'text-ink-muted'}>
                    {slot === 'CLUB' ? 'Jolly Friends Club (fixed)' : slot ? memberName(slot) : 'Not assigned'}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="col-span-2 flex justify-between">
            <button onClick={() => setStep(1)} className="rounded-lg border border-line px-5 py-2 text-sm font-medium cursor-pointer">← Back</button>
            <button onClick={() => setStep(3)} className="rounded-lg bg-navy text-white px-5 py-2 text-sm font-bold cursor-pointer">Next: Review →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex justify-between border-b border-line pb-2"><span className="text-ink-muted">Chit Value</span><span className="font-tabular font-medium">{valueLakh} Lakh</span></div>
            <div className="flex justify-between border-b border-line pb-2"><span className="text-ink-muted">Duration</span><span className="font-medium">{totalMonths} Months</span></div>
            <div className="flex justify-between border-b border-line pb-2"><span className="text-ink-muted">Rate</span><span className="font-medium">{rateSchedule === 'jfc' ? '2% Commission' : '3% Commission'}</span></div>
            <div className="flex justify-between border-b border-line pb-2"><span className="text-ink-muted">Members selected</span><span className="font-medium">{selected.length} of {capacity}</span></div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex justify-between">
            <button onClick={() => setStep(2)} className="rounded-lg border border-line px-5 py-2 text-sm font-medium cursor-pointer">← Back</button>
            <button onClick={handleCreate} disabled={submitting} className="rounded-lg bg-gold text-navy px-6 py-2 text-sm font-bold cursor-pointer disabled:opacity-60">
              {submitting ? 'Creating…' : 'Create Chit'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
