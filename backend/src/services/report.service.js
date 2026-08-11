const { query } = require('../config/db');

const PERIOD_MONTHS = {
  monthly: 1,
  quarterly: 3,
  'half-yearly': 6,
  yearly: 12,
};

/** Resolves a period key (or explicit from/to) into a date range. */
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

async function buildReport({ period, from, to }) {
  const range = resolveRange({ period, from, to });
  const params = [];
  let dateClause = '';
  if (range.from && range.to) {
    params.push(range.from, range.to);
    dateClause = `AND paid_at BETWEEN $1 AND $2`;
  }

  // Overall totals for the period
  const totalsResult = await query(
    `SELECT COALESCE(SUM(amount), 0)::float AS total_collected, COUNT(*)::int AS payment_count
     FROM payments WHERE 1=1 ${dateClause}`,
    params
  );

  const expenseDateClause = range.from && range.to ? `AND spent_at BETWEEN $1 AND $2` : '';
  const expensesResult = await query(
    `SELECT COALESCE(SUM(amount), 0)::float AS total_expenses, COUNT(*)::int AS expense_count
     FROM expenses WHERE 1=1 ${expenseDateClause}`,
    params
  );

  // Monthly breakdown within the range (or all-time grouped by month for historical)
  const monthlyResult = await query(
    `SELECT date_trunc('month', paid_at) AS month, COALESCE(SUM(amount), 0)::float AS collected
     FROM payments WHERE 1=1 ${dateClause}
     GROUP BY 1 ORDER BY 1 ASC`,
    params
  );

  // Chit-wise summary
  const chitParams = range.from && range.to ? [range.from, range.to] : [];
  const chitDateClause = range.from && range.to ? `AND p.paid_at BETWEEN $1 AND $2` : '';
  const chitResult = await query(
    `SELECT c.id, c.ref_number, c.name, c.status,
            COALESCE(SUM(p.amount), 0)::float AS collected,
            COUNT(DISTINCT p.id)::int AS payment_count
     FROM chits c
     LEFT JOIN installments i ON i.chit_id = c.id
     LEFT JOIN payments p ON p.installment_id = i.id ${chitDateClause}
     GROUP BY c.id, c.ref_number, c.name, c.status
     ORDER BY c.created_at DESC`,
    chitParams
  );

  // Member-wise payment summary
  const memberResult = await query(
    `SELECT m.id, m.name, m.mobile_number,
            COALESCE(SUM(p.amount), 0)::float AS total_paid,
            COUNT(p.id)::int AS payment_count
     FROM members m
     LEFT JOIN payments p ON p.member_id = m.id ${range.from && range.to ? 'AND p.paid_at BETWEEN $1 AND $2' : ''}
     GROUP BY m.id, m.name, m.mobile_number
     HAVING COUNT(p.id) > 0
     ORDER BY total_paid DESC`,
    params
  );

  const totalCollected = totalsResult.rows[0].total_collected;
  const totalExpenses = expensesResult.rows[0].total_expenses;

  return {
    period: period || 'historical',
    range: { from: range.from, to: range.to },
    summary: {
      totalCollected,
      paymentCount: totalsResult.rows[0].payment_count,
      totalExpenses,
      expenseCount: expensesResult.rows[0].expense_count,
      net: totalCollected - totalExpenses,
    },
    monthlyBreakdown: monthlyResult.rows.map((r) => ({ month: r.month, collected: r.collected })),
    chitBreakdown: chitResult.rows.map((r) => ({
      id: r.id,
      refNumber: r.ref_number,
      name: r.name,
      status: r.status,
      collected: r.collected,
      paymentCount: r.payment_count,
    })),
    memberBreakdown: memberResult.rows.map((r) => ({
      id: r.id,
      name: r.name,
      mobileNumber: r.mobile_number,
      totalPaid: r.total_paid,
      paymentCount: r.payment_count,
    })),
  };
}

module.exports = { buildReport };
