const { query } = require('../config/db');
const ApiError = require('../utils/ApiError');

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
  const donationTotal = await query(`SELECT COALESCE(SUM(amount),0)::float AS total FROM donations`);
  const santhaTotal = await query(`SELECT COALESCE(SUM(amount),0)::float AS total FROM santha_entries`);
  const chitProfitTotal = await query(`SELECT COALESCE(SUM(profit_amount),0)::float AS total FROM chit_profit_history`);
  const settlementTotals = await query(
    `SELECT COALESCE(SUM(principal),0)::float AS principal, COALESCE(SUM(profit_6pct),0)::float AS profit
     FROM settlement_summary`
  );

  const incomeViaChit = chitProfitTotal.rows[0].total;
  const incomeViaDonation = donationTotal.rows[0].total;
  const incomeViaSantha = santhaTotal.rows[0].total;
  const currentlyInHand = settlementTotals.rows[0].principal;
  const accruedProfit = settlementTotals.rows[0].profit;

  return {
    incomeViaChit,
    incomeViaDonation,
    incomeViaSantha,
    totalIncome: incomeViaChit + incomeViaDonation + incomeViaSantha,
    currentlyInHand,
    accruedProfit,
    finalSettlementValue: currentlyInHand + accruedProfit,
  };
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
};
