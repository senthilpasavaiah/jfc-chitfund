import { useState } from 'react';

// ── Formulas replicated exactly from the JFC prototype's embedded calculator ──
const COMM_PER_LAKH_20M = 1500; // ₹1,500 per lakh per month (Standard, 20 months)
const COMM_PER_LAKH_10M = 3000; // ₹3,000 per lakh per month (Standard, 10 months)
const JFC_COMM_PER_LAKH_10M = 2000; // JFC's actual rate, 10 months
const JFC_COMM_PER_LAKH_20M = 1000; // JFC's actual rate, 20 months
const JFC_MAX_DISC = 0.1; // JFC actual: 10% max discount
const STANDARD_MAX_DISC = 0.26; // Standard: 26% max discount

// Verified exact 50 Lakh / 20 month monthly-paying schedule - every other
// chit value/duration combination is derived from this by proportional
// scaling (20-month) or the same discount-curve shape (10-month).
const RAW_50_20_PAYING = [
  185000, 250000, 187500, 190000, 192500, 195000, 197500, 200000,
  203750, 207500, 211250, 215000, 218750, 222500, 226250, 230000,
  235000, 240000, 245000, 250000,
];

const LAKH_VALUES = [1, 2, 2.5, 5, 10, 20, 30, 40, 50];

function getMonthlyPayings(cv: number, months: number): number[] {
  const ratio = cv / 5000000;
  if (months === 20) {
    return RAW_50_20_PAYING.map((p) => Math.round(p * ratio));
  }
  const base = cv / 10;
  const result: number[] = [];
  for (let i = 1; i <= 10; i++) {
    let diff = 0;
    if (i !== 2 && i !== 10) {
      const pos = i < 2 ? i : i - 1;
      const frac = 1 - (pos - 1) / 8;
      diff = Math.round((base * STANDARD_MAX_DISC * Math.max(frac, 0)) / 250) * 250;
    }
    result.push(Math.round(base - diff));
  }
  return result;
}

function getJfcMonthlyPayings(cv: number, months: number): number[] {
  const base = cv / months;
  const result: number[] = [];
  for (let i = 1; i <= months; i++) {
    let diff = 0;
    if (i !== 2 && i !== months) {
      const pos = i < 2 ? i : i - 1;
      const frac = 1 - (pos - 1) / (months - 2);
      diff = Math.round((base * JFC_MAX_DISC * Math.max(frac, 0)) / 250) * 250;
    }
    result.push(Math.round(base - diff));
  }
  return result;
}

function getJfcCommission(cv: number, months: number, monthIndex1based: number): number {
  if (monthIndex1based === 2) return 0; // club's own reserved month - zero commission
  const perLakh = months === 20 ? JFC_COMM_PER_LAKH_20M : JFC_COMM_PER_LAKH_10M;
  return Math.round(perLakh * (cv / 100000));
}

interface Row {
  round: number;
  monthly: number;
  totalColl: number;
  commPerMonth: number;
  payout: number;
}

function buildRows(cv: number, months: number, rate: 'standard' | 'jfc'): Row[] {
  const lakh = cv / 100000;
  if (rate === 'jfc') {
    const payings = getJfcMonthlyPayings(cv, months);
    return payings.map((monthly, idx) => {
      const round = idx + 1;
      const commPerMonth = getJfcCommission(cv, months, round);
      const totalColl = monthly * months;
      return { round, monthly, totalColl, commPerMonth, payout: totalColl - commPerMonth };
    });
  }
  const commRate = months === 20 ? COMM_PER_LAKH_20M : COMM_PER_LAKH_10M;
  const commPerMonth = commRate * lakh;
  const payings = getMonthlyPayings(cv, months);
  return payings.map((monthly, idx) => {
    const round = idx + 1;
    const totalColl = monthly * months;
    return { round, monthly, totalColl, commPerMonth, payout: totalColl - commPerMonth };
  });
}

function commissionPercentLabel(schedule: 'standard' | 'jfc', months: number) {
  if (months === 10) return schedule === 'standard' ? '3%' : '2%';
  if (months === 20) return schedule === 'standard' ? '1.5%' : '1%';
  return '';
}

const INR = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const INRi = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
function shortL(v: number) {
  if (v >= 10000000) return '₹' + (v / 10000000).toFixed(0) + ' Cr';
  if (v >= 100000) {
    const lakhs = v / 100000;
    return '₹' + (Number.isInteger(lakhs) ? lakhs.toFixed(0) : lakhs.toFixed(1)) + ' L';
  }
  return INRi(v);
}

function SummaryCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: 'teal' | 'gold' | 'purp' | 'green' | 'navy' }) {
  const borderColor = { teal: '#0f8b8d', gold: '#d97706', purp: '#6d28d9', green: '#1d4ed8', navy: '#0d1b2a' }[accent];
  const textColor = { teal: '#0f8b8d', gold: '#92400e', purp: '#6d28d9', green: '#1d4ed8', navy: '#0d1b2a' }[accent];
  return (
    <div className="bg-white border border-line rounded-lg p-3.5 shadow-sm" style={{ borderLeft: `4px solid ${borderColor}` }}>
      <div className="text-[11px] font-extrabold uppercase tracking-wide text-ink-muted">{label}</div>
      <div className="text-lg font-extrabold mt-0.5" style={{ color: textColor }}>{value}</div>
      <div className="text-xs text-ink-muted mt-0.5">{sub}</div>
    </div>
  );
}

export default function CalculatorPage() {
  const [selChit, setSelChit] = useState<number | null>(null);
  const [selMonths, setSelMonths] = useState<10 | 20 | null>(null);
  const [selRate, setSelRate] = useState<'standard' | 'jfc'>('standard');

  const cv = selChit ? selChit * 100000 : 0;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Chit Calculator</h2>
        <p className="text-ink-muted text-sm mt-1">The same commission model JFC actually uses — choose a chit value and duration.</p>
      </div>

      <div className="bg-white border border-line rounded-xl p-5 shadow-sm">
        <div className="text-[11px] font-extrabold uppercase tracking-wide text-[#0f8b8d] mb-2.5 flex items-center gap-2">
          <span className="inline-block w-[3px] h-[13px] bg-[#0f8b8d] rounded-sm" /> Chit Value
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {LAKH_VALUES.map((l) => (
            <button
              key={l}
              onClick={() => setSelChit(l)}
              className={`px-4 py-2 rounded-lg border text-sm font-bold cursor-pointer transition-colors ${
                selChit === l ? 'bg-[#0f8b8d] text-white border-[#0f8b8d]' : 'bg-white text-[#1b4965] border-line hover:border-[#0f8b8d] hover:text-[#0f8b8d]'
              }`}
            >
              {l} Lakh
            </button>
          ))}
        </div>

        <div className="text-[11px] font-extrabold uppercase tracking-wide text-[#0f8b8d] mb-2.5 flex items-center gap-2">
          <span className="inline-block w-[3px] h-[13px] bg-[#0f8b8d] rounded-sm" /> Duration
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {[10, 20].map((m) => (
            <button
              key={m}
              onClick={() => selChit && setSelMonths(m as 10 | 20)}
              className={`px-4 py-2 rounded-lg border text-sm font-bold cursor-pointer transition-colors ${
                selMonths === m ? 'bg-[#0f8b8d] text-white border-[#0f8b8d]' : 'bg-white text-[#1b4965] border-line hover:border-[#0f8b8d] hover:text-[#0f8b8d]'
              }`}
            >
              {m} Months
            </button>
          ))}
        </div>

        <div className="text-[11px] font-extrabold uppercase tracking-wide text-[#0f8b8d] mb-2.5 flex items-center gap-2">
          <span className="inline-block w-[3px] h-[13px] bg-[#0f8b8d] rounded-sm" /> Commission
        </div>
        <select
          value={selRate}
          onChange={(e) => setSelRate(e.target.value as 'standard' | 'jfc')}
          disabled={!selMonths}
          className="px-4 py-2 rounded-lg border border-line text-sm font-bold text-[#1b4965] cursor-pointer disabled:opacity-50"
        >
          {selMonths ? (
            <>
              <option value="standard">{commissionPercentLabel('standard', selMonths)} Commission (Standard Rate)</option>
              <option value="jfc">{commissionPercentLabel('jfc', selMonths)} Commission (JFC Actual Rate)</option>
            </>
          ) : (
            <option value="">Select duration first</option>
          )}
        </select>
      </div>

      {!selChit && (
        <div className="bg-white border-2 border-dashed border-line rounded-xl p-10 text-center text-ink-muted">
          <div className="text-lg font-bold text-navy mb-1.5">Select a chit value to begin</div>
          <div className="text-sm">Choose one of the Chit Value options above, then choose a duration.</div>
        </div>
      )}

      {selChit && !selMonths && (
        <div className="bg-white border-2 border-dashed border-line rounded-xl p-10 text-center text-ink-muted">
          <div className="text-lg font-bold text-navy mb-1.5">{selChit} Lakh selected — now choose a duration</div>
          <div className="text-sm">Pick 10 Months or 20 Months above to see the full payment schedule.</div>
        </div>
      )}

      {selChit && selMonths && (
        <CalculatorResult cv={cv} lakh={selChit} months={selMonths} rate={selRate} />
      )}
    </div>
  );
}

function CalculatorResult({ cv, lakh, months, rate }: { cv: number; lakh: number; months: number; rate: 'standard' | 'jfc' }) {
  const rows = buildRows(cv, months, rate);
  const commRate = rate === 'jfc' ? (months === 20 ? JFC_COMM_PER_LAKH_20M : JFC_COMM_PER_LAKH_10M) : months === 20 ? COMM_PER_LAKH_20M : COMM_PER_LAKH_10M;
  const commPerMonth = commRate * lakh;
  const totalComm = rows.reduce((s, r) => s + r.commPerMonth, 0);
  const baseMonthly = cv / months;
  const minPaying = Math.min(...rows.map((r) => r.monthly));
  const maxPaying = Math.max(...rows.map((r) => r.monthly));
  const totalPaying = rows.reduce((s, r) => s + r.monthly, 0);
  const maxPayout = Math.max(...rows.map((r) => r.payout));
  const minPayout = Math.min(...rows.map((r) => r.payout));
  const totalPayout = rows.reduce((s, r) => s + r.payout, 0);
  const grandTotal = rows.reduce((s, r) => s + r.totalColl, 0);
  const isEstimate = !(months === 20 && lakh === 50);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 items-stretch">
        <SummaryCard label="Chit Value" value={shortL(cv)} sub={`${months} months · ${months} members`} accent="teal" />
        <SummaryCard label="Base Monthly (No Discount)" value={INRi(baseMonthly)} sub={`= ${shortL(cv)} ÷ ${months}`} accent="teal" />
        <SummaryCard label="Min Monthly Paying" value={INRi(minPaying)} sub="Round 1 (max discount)" accent="gold" />
        <SummaryCard label="Max Monthly Paying" value={INRi(maxPaying)} sub={`Round ${months} (no discount)`} accent="teal" />
        <SummaryCard label="Commission / Month" value={INRi(commPerMonth)} sub={`₹${commRate.toLocaleString('en-IN')} × ${lakh}L (${months}M rate)`} accent="purp" />
        <SummaryCard label="Total Commission" value={INRi(totalComm)} sub={`${INRi(commPerMonth)} × ${months} months`} accent="purp" />
        <SummaryCard label="Max Payout to Member" value={INRi(maxPayout)} sub="Highest amount received" accent="green" />
        <SummaryCard label="Min Payout to Member" value={INRi(minPayout)} sub="Lowest amount received" accent="green" />
      </div>

      <div className="bg-white border border-line rounded-xl overflow-hidden shadow-md">
        <div className="bg-navy text-white px-5 py-3 flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-bold">{lakh} Lakh Chit — {months} Month Payment Schedule</h3>
          <span className="text-xs bg-white/15 px-3 py-1 rounded-full">
            {months} rounds &nbsp;|&nbsp; Rate: ₹{commRate.toLocaleString('en-IN')}/L &nbsp;|&nbsp; Commission: {INRi(commPerMonth)}/month &nbsp;|&nbsp; Total: {INRi(totalComm)}
          </span>
        </div>
        {isEstimate && (
          <div className="bg-[#fffbeb] border-b border-[#fde68a] px-5 py-2 text-xs text-[#78350f]">
            ⚠️ Monthly paying values are proportionally scaled from verified 50 Lakh / 20 Month data.
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="bg-[#1b4965] text-white text-xs font-extrabold uppercase tracking-wide px-4 py-3 text-center w-14">No.</th>
                <th className="bg-[#1b4965] text-white text-xs font-extrabold uppercase tracking-wide px-4 py-3 text-right">Monthly Paying<br /><span className="font-normal opacity-75 normal-case">Per Member</span></th>
                <th className="bg-[#1b4965] text-white text-xs font-extrabold uppercase tracking-wide px-4 py-3 text-right">Total Collection<br /><span className="font-normal opacity-75 normal-case">× {months} Members</span></th>
                <th className="bg-[#3b1a7a] text-[#e9d5ff] text-xs font-extrabold uppercase tracking-wide px-4 py-3 text-right">Commission<br /><span className="font-normal opacity-75 normal-case">Deducted</span></th>
                <th className="bg-[#1b4965] text-white text-xs font-extrabold uppercase tracking-wide px-4 py-3 text-right">Member Payout<br /><span className="font-normal opacity-75 normal-case">After Commission</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.round} className={`border-b border-[#e4ecf1] hover:bg-[#e8f6f6] transition-colors ${idx % 2 === 1 ? 'bg-[#f8fbfc]' : ''}`}>
                  <td className="text-center font-bold text-ink-muted text-xs px-4 py-2.5">{r.round}</td>
                  <td className="text-right font-bold text-navy px-4 py-2.5 whitespace-nowrap">{INR(r.monthly)}</td>
                  <td className="text-right font-semibold text-[#334155] px-4 py-2.5 whitespace-nowrap">{INR(r.totalColl)}</td>
                  <td className="text-right font-bold text-[#6d28d9] bg-[#6d28d90a] px-4 py-2.5 whitespace-nowrap">{INR(r.commPerMonth)}</td>
                  <td className="text-right font-bold text-[#1d4ed8] px-4 py-2.5 whitespace-nowrap">{INR(r.payout)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#eef5f7] border-t-2 border-[#1b4965]">
                <td className="text-center text-ink-muted text-xs uppercase tracking-wide px-4 py-3 font-extrabold">Total</td>
                <td className="text-right font-extrabold px-4 py-3 whitespace-nowrap">{INR(totalPaying)}</td>
                <td className="text-right font-extrabold px-4 py-3 whitespace-nowrap">{INR(grandTotal)}</td>
                <td className="text-right font-extrabold text-[#6d28d9] bg-[#f0eeff] px-4 py-3 whitespace-nowrap">{INR(totalComm)}</td>
                <td className="text-right font-extrabold text-[#1d4ed8] px-4 py-3 whitespace-nowrap">{INR(totalPayout)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
