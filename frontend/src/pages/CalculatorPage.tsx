import { useState } from 'react';

function formatINR(amount: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

export default function CalculatorPage() {
  const [chitValue, setChitValue] = useState('400000');
  const [months, setMonths] = useState('20');
  const [commissionPercent, setCommissionPercent] = useState('5');
  const [discountAmount, setDiscountAmount] = useState('40000');
  const [memberCount, setMemberCount] = useState('20');

  const value = Number(chitValue) || 0;
  const monthsNum = Number(months) || 1;
  const commission = Number(commissionPercent) || 0;
  const discount = Number(discountAmount) || 0;
  const members = Number(memberCount) || 1;

  const monthlyInstallment = value / monthsNum;
  const organizerCommission = (value * commission) / 100;
  const dividendPool = Math.max(0, discount - organizerCommission);
  const nonWinners = Math.max(1, members - 1);
  const dividendPerMember = dividendPool / nonWinners;
  const winnerReceives = value - discount;
  const effectiveInstallmentForNonWinner = monthlyInstallment - dividendPerMember;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Chit Calculator</h2>
        <p className="text-ink-muted text-sm mt-1">
          Estimate the monthly installment, dividend, and auction payout for a chit — the same formula the system uses when you complete an auction.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="ledger-card p-5 space-y-4">
          <h3 className="font-medium mb-1">Chit setup</h3>
          <div>
            <label className="block text-xs text-ink-muted mb-1">Total chit value (₹)</label>
            <input type="number" value={chitValue} onChange={(e) => setChitValue(e.target.value)} className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-ink-muted mb-1">Total months / members</label>
            <input type="number" value={months} onChange={(e) => setMonths(e.target.value)} className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-ink-muted mb-1">Organizer commission (%)</label>
            <input type="number" value={commissionPercent} onChange={(e) => setCommissionPercent(e.target.value)} className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
          </div>

          <h3 className="font-medium mb-1 pt-2 border-t border-line">This month's auction</h3>
          <div>
            <label className="block text-xs text-ink-muted mb-1">Winning discount bid (₹)</label>
            <input type="number" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs text-ink-muted mb-1">Active members this month</label>
            <input type="number" value={memberCount} onChange={(e) => setMemberCount(e.target.value)} className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="ledger-card p-5 space-y-3">
          <h3 className="font-medium mb-2">Result</h3>
          <div className="flex justify-between text-sm border-b border-line pb-2">
            <span className="text-ink-muted">Base monthly installment</span>
            <span className="font-tabular font-medium">{formatINR(monthlyInstallment)}</span>
          </div>
          <div className="flex justify-between text-sm border-b border-line pb-2">
            <span className="text-ink-muted">Organizer commission</span>
            <span className="font-tabular font-medium">{formatINR(organizerCommission)}</span>
          </div>
          <div className="flex justify-between text-sm border-b border-line pb-2">
            <span className="text-ink-muted">Dividend pool (discount − commission)</span>
            <span className="font-tabular font-medium">{formatINR(dividendPool)}</span>
          </div>
          <div className="flex justify-between text-sm border-b border-line pb-2">
            <span className="text-ink-muted">Dividend per non-winning member</span>
            <span className="font-tabular font-medium text-navy">{formatINR(dividendPerMember)}</span>
          </div>
          <div className="flex justify-between text-sm border-b border-line pb-2">
            <span className="text-ink-muted">Effective installment for non-winners</span>
            <span className="font-tabular font-medium">{formatINR(effectiveInstallmentForNonWinner)}</span>
          </div>
          <div className="flex justify-between text-sm pt-1">
            <span className="text-ink-muted">Amount the winner receives this month</span>
            <span className="font-tabular font-bold text-gold-dim bg-navy inline-block px-2 py-0.5 rounded">
              {formatINR(winnerReceives)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
