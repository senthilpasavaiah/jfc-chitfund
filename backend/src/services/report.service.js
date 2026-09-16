const chitService = require('./chit.service');
const fundService = require('./fund.service');
const expenseService = require('./expense.service');

const PERIOD_MONTHS = {
  monthly: 1,
  quarterly: 3,
  'half-yearly': 6,
  yearly: 12,
};

function resolveRange({ period, from, to }) {
  if (from && to) return { from: new Date(from), to: new Date(to) };
  if (period === 'historical' || !period) return { from: null, to: null };

  const months = PERIOD_MONTHS[period];
  if (!months) throw new Error(`Unknown period: ${period}`);

  const to_ = new Date();
  const from_ = new Date();
  from_.setMonth(from_.getMonth() - months);
  return { from: from_, to: to_ };
}

/** True when `date` falls within `range`. An unbounded range (all-time) always matches. */
function inRange(date, range) {
  if (!range.from || !range.to) return true;
  if (!date) return false;
  const d = new Date(date);
  return d >= range.from && d <= range.to;
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/**
 * Builds the Association-level financial report.
 *
 * This is deliberately NOT a dump of every payment ever recorded. It answers
 * one question for a non-technical committee member: "where did the
 * Association's money come from, where did it go, and what's left over?"
 *
 *   Association Income
 *     - Chit Income:   each live chit's own auto-booked ledger income
 *                       (organizer commission + the Club's payout when its
 *                       reserved slot comes due) - the exact same numbers
 *                       shown on that chit's "Income & Expenses" panel -
 *                       plus historical (pre-app) chit profit, shown only
 *                       in the All-time view since those records predate
 *                       per-entry dates.
 *     - Other Income:   Donations + Santha collections.
 *   Association Expenses
 *     - Club's Contribution to Chits: the Club's own monthly payment as a
 *       participant in each chit (a real cash outflow, per the same
 *       auto-booked ledger).
 *     - Office & Miscellaneous Expenses: the day-to-day expenses ledger.
 *   Net Profit / Surplus = Total Income - Total Expenses
 *   Chit-wise summary: Chit -> Income -> Expenses -> Net, for anyone who
 *     wants the per-chit picture without wading through member-level detail
 *     (that detail lives on each Chit's own detail page, not here).
 *
 * Individual member paid/pending status is intentionally excluded - it
 * belongs to the respective Chit Detail page, not the Association report.
 */
async function buildReport({ period, from, to }) {
  const range = resolveRange({ period, from, to });
  const isAllTime = !range.from || !range.to;

  // --- Live chits: reuse each chit's own auto-booked ledger (chit.service),
  // the same data source as its "Income & Expenses" panel. A chit that
  // hadn't even started by the end of the selected range has nothing to do
  // with that period, so it's excluded from the summary entirely - not
  // just hidden in the UI - rather than listing it as a padded zero row.
  const allChits = await chitService.list({});
  const applicableChits = range.to
    ? allChits.filter((c) => !c.startDate || new Date(c.startDate) <= range.to)
    : allChits;
  const chitRows = await Promise.all(
    applicableChits.map(async (c) => {
      try {
        const ledger = await chitService.getLedger(c.id);
        const entries = ledger.entries.filter((e) => inRange(e.entry_date, range));
        const income = entries.filter((e) => e.type === 'income').reduce((s, e) => s + Number(e.amount), 0);
        const expense = entries.filter((e) => e.type === 'expense').reduce((s, e) => s + Number(e.amount), 0);
        return {
          type: 'live',
          id: c.id,
          refNumber: c.refNumber,
          status: c.status,
          income: round2(income),
          expense: round2(expense),
          net: round2(income - expense),
        };
      } catch (err) {
        // A chit with bad data (e.g. missing value_lakh - see
        // prisma/sql/014_backfill_value_lakh.sql) shouldn't fail the whole
        // report. Surface it clearly instead of silently reporting 0.
        return {
          type: 'live',
          id: c.id,
          refNumber: c.refNumber,
          status: c.status,
          income: 0,
          expense: 0,
          net: 0,
          error: err.message,
        };
      }
    })
  );
  const liveChitIncome = chitRows.reduce((s, c) => s + c.income, 0);
  const liveChitExpense = chitRows.reduce((s, c) => s + c.expense, 0);

  // --- Historical (pre-app) chit rounds - net profit only, no per-entry
  // date to filter by, so only surfaced when the query is either unbounded
  // (All-time) or entirely confined to before the New Management cutover
  // (a "Previous Management" style query) - never for a range that extends
  // into New Management, so it can never leak into that view.
  const includeHistoricalChitProfit =
    isAllTime || (range.to && new Date(range.to) < new Date(fundService.NEW_MANAGEMENT_START_DATE));
  const historyRows = includeHistoricalChitProfit ? await fundService.listChitProfitHistory() : [];
  const historicalChitIncome = historyRows.reduce((s, r) => s + Number(r.profit_amount), 0);
  const historicalChitRows = historyRows.map((r) => ({
    type: 'historical',
    id: r.id,
    refNumber: r.label,
    status: r.fiscal_year_label,
    income: round2(Number(r.profit_amount)),
    expense: null, // not tracked per-round for historical rounds
    net: round2(Number(r.profit_amount)),
  }));

  // --- Other Association income: Donations + Santha collections. ---
  const [donationRows, santhaRows] = await Promise.all([fundService.listDonations(), fundService.listSantha()]);
  const donationTotal = donationRows
    .filter((d) => inRange(d.donated_at, range))
    .reduce((s, d) => s + Number(d.amount), 0);
  const santhaTotal = santhaRows
    .filter((s) => inRange(s.entry_date, range))
    .reduce((s, r) => s + Number(r.amount), 0);
  const otherIncome = donationTotal + santhaTotal;

  // --- Association expenses: the office/miscellaneous expenses ledger. ---
  const expenseRows = await expenseService.list({ from: range.from, to: range.to });
  const operatingExpenses = expenseRows.reduce((s, e) => s + Number(e.amount), 0);

  const chitIncome = liveChitIncome + historicalChitIncome;
  const totalIncome = chitIncome + otherIncome;
  const totalExpenses = liveChitExpense + operatingExpenses;
  const netProfit = totalIncome - totalExpenses;

  return {
    period: period || 'historical',
    range: { from: range.from, to: range.to },

    association: {
      income: {
        chitIncome: round2(chitIncome),
        otherIncome: round2(otherIncome),
        total: round2(totalIncome),
      },
      expenses: {
        chitExpenses: round2(liveChitExpense),
        operatingExpenses: round2(operatingExpenses),
        total: round2(totalExpenses),
      },
      netProfit: round2(netProfit),
    },

    incomeBreakdown: [
      {
        label: 'Chit Income (commission & Club payouts, active chits)',
        amount: round2(liveChitIncome),
      },
      ...(isAllTime
        ? [{ label: 'Historical Chit Profit (pre-app records)', amount: round2(historicalChitIncome) }]
        : []),
      { label: 'Donations', amount: round2(donationTotal) },
      { label: 'Santha Collections', amount: round2(santhaTotal) },
    ].filter((row) => row.amount !== 0 || row.label.startsWith('Chit Income')),

    expenseBreakdown: [
      { label: "Club's Contribution to Chits (as a participant)", amount: round2(liveChitExpense) },
      { label: 'Office & Miscellaneous Expenses', amount: round2(operatingExpenses) },
    ],

    chitSummary: [...chitRows, ...historicalChitRows],

    meta: {
      historicalRecordsIncluded: isAllTime,
      liveChitsReporting: chitRows.length,
      donationEntries: donationRows.filter((d) => inRange(d.donated_at, range)).length,
      santhaEntries: santhaRows.filter((s) => inRange(s.entry_date, range)).length,
      expenseEntries: expenseRows.length,
    },
  };
}

module.exports = { buildReport };
