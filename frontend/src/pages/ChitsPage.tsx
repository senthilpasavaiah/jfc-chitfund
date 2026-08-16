import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import type { Chit, RateSchedule } from '../types';
import { useAuth } from '../context/AuthContext';

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
  const [chits, setChits] = useState<Chit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
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

      <div className="grid gap-4">
        {loading ? (
          <p className="text-ink-muted">Loading…</p>
        ) : chits.length === 0 ? (
          <p className="text-ink-muted">No {tab} chits.</p>
        ) : (
          chits.map((chit) => (
            <Link
              key={chit.id}
              to={`/chits/${chit.id}`}
              className="ledger-card p-5 flex items-center justify-between hover:border-gold transition-colors"
            >
              <div>
                <div className="font-medium">{chit.refNumber}</div>
                <div className="text-xs text-ink-muted mt-0.5">
                  {chit.valueLakh} Lakh · {chit.totalMonths} Months · {chit.rateSchedule === 'jfc' ? 'JFC Rate' : 'Standard Rate'}
                </div>
              </div>
              <div className="text-right">
                <div className="font-tabular text-lg">{formatINR(chit.valueLakh * 100000)}</div>
                <div className="text-xs text-ink-muted">
                  {chit.status === 'ongoing' ? `Month ${chit.monthsElapsed + 1} of ${chit.totalMonths}` : chit.status === 'upcoming' ? `Starts ${chit.startDate ? new Date(chit.startDate).toLocaleDateString('en-IN') : ''}` : 'Completed'}
                </div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${STATUS_STYLES[chit.status]}`}>{chit.status}</span>
            </Link>
          ))
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
              <option value="jfc">JFC Actual Rate</option>
              <option value="standard">Standard Rate</option>
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
            <div className="flex justify-between border-b border-line pb-2"><span className="text-ink-muted">Rate</span><span className="font-medium">{rateSchedule === 'jfc' ? 'JFC Actual' : 'Standard'}</span></div>
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
