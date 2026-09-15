const { query } = require('../config/db');
const ApiError = require('../utils/ApiError');

// The permanent management cut-off, per the verified reconciliation
// (JFC_Santha_FINAL_Separated_Reconciled_2026.xlsx). Everything dated
// strictly before this belongs to Previous Management; this date and
// everything after belongs to New Management. This is a business-rule
// boundary, not a financial figure - it's never used to compute an amount
// on its own, only to filter which rows fall on which side of it.
const NEW_MANAGEMENT_START_DATE = '2026-07-01';

/**
 * Ensures every live chit's auto-ledger is up to date before we sum it -
 * cheap for the handful of chits JFC actually runs, and guarantees the
 * dashboard reflects reality even if nobody's opened a chit's Income &
 * Expenses panel recently (which is what normally triggers the sync).
 */
async function syncAllChitLedgers() {
  const chitService = require('./chit.service');
  const logger = require('../config/logger');
  const { rows } = await query(`SELECT id, ref_number FROM chits`);
  for (const { id, ref_number } of rows) {
    try {
      await chitService.syncAccounting(id);
    } catch (err) {
      // A single chit with bad data (e.g. missing value_lakh) shouldn't
      // take down the whole Dashboard/Reports summary - log it and keep
      // going so the rest of the figures still load.
      logger.error(`syncAccounting failed for chit ${ref_number} (${id}): ${err.message}`);
    }
  }
}

async function listDonations() {
  const { rows } = await query(
    `SELECT d.*, m.status AS member_status FROM donations d
     LEFT JOIN members m ON m.id = d.member_id
     ORDER BY d.donated_at DESC, d.created_at DESC`
  );
  return rows;
}

async function addDonation({ memberId, memberName, amount, donatedAt }) {
  const { rows } = await query(
    `INSERT INTO donations (member_id, member_name, amount, donated_at)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [memberId || null, memberName, amount, donatedAt || new Date()]
  );
  return rows[0];
}

async function updateDonation(id, { memberName, amount, donatedAt }) {
  const { rows } = await query(
    `UPDATE donations SET member_name = COALESCE($1, member_name), amount = COALESCE($2, amount),
            donated_at = COALESCE($3, donated_at)
     WHERE id = $4 RETURNING *`,
    [memberName || null, amount ?? null, donatedAt || null, id]
  );
  if (!rows[0]) throw ApiError.notFound('Donation entry not found');
  return rows[0];
}

async function listSantha() {
  const { rows } = await query(
    `SELECT s.*, m.status AS member_status FROM santha_entries s
     LEFT JOIN members m ON m.id = s.member_id
     ORDER BY s.entry_date DESC NULLS LAST, s.created_at DESC`
  );
  return rows;
}

async function addSantha({ memberId, memberName, roundLabel, amount, entryDate }) {
  const { rows } = await query(
    `INSERT INTO santha_entries (member_id, member_name, round_label, amount, entry_date)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [memberId || null, memberName, roundLabel, amount, entryDate || new Date()]
  );
  return rows[0];
}

async function updateSantha(id, { memberName, amount, entryDate }) {
  const { rows } = await query(
    `UPDATE santha_entries SET member_name = COALESCE($1, member_name), amount = COALESCE($2, amount),
            entry_date = COALESCE($3, entry_date)
     WHERE id = $4 RETURNING *`,
    [memberName || null, amount ?? null, entryDate || null, id]
  );
  if (!rows[0]) throw ApiError.notFound('Santha entry not found');
  return rows[0];
}

async function listChitProfitHistory() {
  const { rows } = await query(`SELECT * FROM chit_profit_history ORDER BY fiscal_year_label, created_at`);
  return rows;
}

async function listSettlement() {
  const { rows } = await query(`SELECT * FROM settlement_summary ORDER BY fiscal_year_label`);
  const totals = await query(
    `SELECT COALESCE(SUM(santha_donation),0)::float AS total_santha_donation,
            COALESCE(SUM(chit_profit),0)::float AS total_chit_profit,
            COALESCE(SUM(expenses),0)::float AS total_expenses,
            COALESCE(SUM(principal),0)::float AS total_principal,
            COALESCE(SUM(profit_6pct),0)::float AS total_profit
     FROM settlement_summary`
  );
  const t = totals.rows[0];
  return {
    years: rows,
    totals: {
      ...t,
      finalSettlementValue: t.total_principal + t.total_profit,
    },
  };
}

async function addSettlementYear({ fiscalYearLabel, santhaDonation, chitProfit, expenses, notes }) {
  const principal = Number(santhaDonation) + Number(chitProfit) - Number(expenses);
  const profit6pct = Number((principal * 0.06).toFixed(2));
  const { rows } = await query(
    `INSERT INTO settlement_summary (fiscal_year_label, santha_donation, chit_profit, expenses, principal, profit_6pct, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [fiscalYearLabel, santhaDonation, chitProfit, expenses, principal, profit6pct, notes || null]
  );
  return rows[0];
}

/** Powers the dashboard's headline cards - all figures are live SUMs, never hardcoded. */
async function summary() {
  await syncAllChitLedgers();

  const donationTotal = await query(`SELECT COALESCE(SUM(amount),0)::float AS total FROM donations`);
  const santhaTotal = await query(`SELECT COALESCE(SUM(amount),0)::float AS total FROM santha_entries`);
  const chitProfitHistoryTotal = await query(`SELECT COALESCE(SUM(profit_amount),0)::float AS total FROM chit_profit_history`);
  // Bug fix: this used to filter `category = 'Commission'`, silently
  // excluding the "Club Payout (Month 2)" income rows - the Report page
  // (report.service.js) correctly sums EVERY income row per chit
  // (Commission + Club Payout), which is why a chit's ₹2,50,000 Club
  // Payout showed up there but never reached the Dashboard/Fund total.
  // Matching the Report's own definition (all `type = 'income'` rows,
  // no category filter) is what keeps the two from disagreeing - and
  // stays correct automatically if a category is ever renamed or added.
  const liveChitIncome = await query(
    `SELECT COALESCE(SUM(amount),0)::float AS total FROM chit_auto_ledger WHERE type = 'income'`
  );
  // Bug fix: the Dashboard's "Expenses" card and the Fund page's own
  // Expenses/Chit Profit totals used to be computed independently (in
  // dashboard.routes.js and FundsPage.tsx respectively) straight from the
  // plain `expenses` table - neither of them ever looked at
  // chit_auto_ledger's expense rows (each chit's own monthly contribution
  // as a participant). So when a chit's live accounting data changed,
  // office expenses still showed correctly, but the CHIT side of expenses
  // silently never moved. Computing it once here, and having both pages
  // consume this same value, is what makes Dashboard and Fund agree.
  const officeExpenses = await query(`SELECT COALESCE(SUM(amount),0)::float AS total FROM expenses`);
  const chitExpenses = await query(
    `SELECT COALESCE(SUM(amount),0)::float AS total FROM chit_auto_ledger WHERE type = 'expense'`
  );
  const settlementTotals = await query(
    `SELECT COALESCE(SUM(principal),0)::float AS principal, COALESCE(SUM(profit_6pct),0)::float AS profit
     FROM settlement_summary`
  );

  const incomeViaChit = chitProfitHistoryTotal.rows[0].total + liveChitIncome.rows[0].total;
  const incomeViaDonation = donationTotal.rows[0].total;
  const incomeViaSantha = santhaTotal.rows[0].total;
  const currentlyInHand = settlementTotals.rows[0].principal;
  const accruedProfit = settlementTotals.rows[0].profit;
  const totalExpenses = officeExpenses.rows[0].total + chitExpenses.rows[0].total;

  return {
    incomeViaChit,
    incomeViaDonation,
    incomeViaSantha,
    totalIncome: incomeViaChit + incomeViaDonation + incomeViaSantha,
    // Broken out so the UI can show/label each part separately as well as
    // the combined figure - same pattern already used for incomeViaChit.
    // (Renamed from liveChitCommission -> liveChitIncome: it now genuinely
    // covers all chit income, not just the Commission category.)
    liveChitIncome: liveChitIncome.rows[0].total,
    officeExpenses: officeExpenses.rows[0].total,
    chitExpenses: chitExpenses.rows[0].total,
    totalExpenses,
    currentlyInHand,
    accruedProfit,
    finalSettlementValue: currentlyInHand + accruedProfit,
  };
}

/**
 * Phase 1 of the Previous Management / New Management split (see
 * JFC_Santha_FINAL_Separated_Reconciled_2026.xlsx).
 *
 * Previous Management figures come from the Excel-verified settlement_summary
 * columns (santha_amount/donation_amount/unclassified_contribution added by
 * migration 016) plus the same principal/profit totals summary() already
 * uses - exactly the numbers in the workbook's Final_Reconciliation sheet,
 * derived from the DB, never hardcoded here.
 *
 * New Management figures are the SAME live sources Dashboard/Fund already
 * use (donations, santha_entries, expenses, chit_auto_ledger), just filtered
 * to NEW_MANAGEMENT_START_DATE onward - so a rupee here is never also
 * counted in Previous Management, and vice versa.
 */
async function getManagementSplit() {
  await syncAllChitLedgers();

  const handoverResult = await query(
    `SELECT amount, handover_date, source, description FROM management_handover ORDER BY handover_date ASC LIMIT 1`
  );
  if (handoverResult.rows.length === 0) {
    throw ApiError.internal('Management handover record is missing - run migration 016_management_handover.sql.');
  }
  const handover = handoverResult.rows[0];
  const openingBalance = Number(handover.amount);

  const settlementSplit = await query(
    `SELECT
       COALESCE(SUM(santha_amount),0)::float AS santha,
       COALESCE(SUM(donation_amount),0)::float AS donation,
       COALESCE(SUM(unclassified_contribution),0)::float AS unclassified,
       COALESCE(SUM(chit_profit),0)::float AS chit_profit,
       COALESCE(SUM(expenses),0)::float AS expenses,
       COALESCE(SUM(principal),0)::float AS principal,
       COALESCE(SUM(profit_6pct),0)::float AS profit
     FROM settlement_summary`
  );
  const st = settlementSplit.rows[0];

  const newDonations = await query(
    `SELECT COALESCE(SUM(amount),0)::float AS total FROM donations WHERE donated_at >= $1`,
    [NEW_MANAGEMENT_START_DATE]
  );
  const newSantha = await query(
    `SELECT COALESCE(SUM(amount),0)::float AS total FROM santha_entries WHERE entry_date >= $1`,
    [NEW_MANAGEMENT_START_DATE]
  );
  const newChitIncome = await query(
    `SELECT COALESCE(SUM(amount),0)::float AS total FROM chit_auto_ledger WHERE type = 'income' AND entry_date >= $1`,
    [NEW_MANAGEMENT_START_DATE]
  );
  const newExpensesOffice = await query(
    `SELECT COALESCE(SUM(amount),0)::float AS total FROM expenses WHERE spent_at >= $1`,
    [NEW_MANAGEMENT_START_DATE]
  );
  const newExpensesChit = await query(
    `SELECT COALESCE(SUM(amount),0)::float AS total FROM chit_auto_ledger WHERE type = 'expense' AND entry_date >= $1`,
    [NEW_MANAGEMENT_START_DATE]
  );

  const newIncome = newDonations.rows[0].total + newSantha.rows[0].total + newChitIncome.rows[0].total;
  const newExpenses = newExpensesOffice.rows[0].total + newExpensesChit.rows[0].total;
  const currentBalance = openingBalance + newIncome - newExpenses;

  return {
    boundaryDate: NEW_MANAGEMENT_START_DATE,
    previousManagement: {
      santha: st.santha,
      donation: st.donation,
      unclassifiedContribution: st.unclassified,
      chitProfit: st.chit_profit,
      expenses: st.expenses,
      principal: st.principal,
      profit: st.profit,
      finalSettlement: st.principal + st.profit,
      handoverAmount: openingBalance,
      handoverDate: handover.handover_date,
      handoverSource: handover.source,
    },
    newManagement: {
      openingBalance,
      donations: newDonations.rows[0].total,
      santha: newSantha.rows[0].total,
      chitIncome: newChitIncome.rows[0].total,
      income: newIncome,
      officeExpenses: newExpensesOffice.rows[0].total,
      chitExpenses: newExpensesChit.rows[0].total,
      expenses: newExpenses,
      currentBalance,
    },
  };
}

/**
 * Thin passthrough so fund.controller.js only ever talks to fundService,
 * consistent with the rest of this module (lazy require avoids a
 * module-load-order dependency on chit.service.js, same pattern already
 * used by syncAllChitLedgers above).
 */
async function listLiveChitFinancials() {
  const chitService = require('./chit.service');
  return chitService.getLiveChitFinancials();
}


module.exports = {
  listDonations,
  addDonation,
  updateDonation,
  listSantha,
  addSantha,
  updateSantha,
  listChitProfitHistory,
  listSettlement,
  addSettlementYear,
  summary,
  getManagementSplit,
  listLiveChitFinancials,
};
