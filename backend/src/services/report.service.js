const { query } = require('../config/db');
const chitService = require('./chit.service');

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

async function buildReport({ period, from, to }) {
  const range = resolveRange({ period, from, to });
  const params = [];
  let dateClause = '';
  if (range.from && range.to) {
    params.push(range.from, range.to);
    dateClause = `AND paid_at BETWEEN $1 AND $2`;
  }

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

  const monthlyResult = await query(
    `SELECT date_trunc('month', paid_at) AS month, COALESCE(SUM(amount), 0)::float AS collected
     FROM payments WHERE 1=1 ${dateClause}
     GROUP BY 1 ORDER BY 1 ASC`,
    params
  );

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

  const chitCollections = await chitService.getConfirmedChitCollections({ from: range.from, to: range.to });
  const allChits = await chitService.list({});

  const totalCollected = totalsResult.rows[0].total_collected + chitCollections.total;
  const totalExpenses = expensesResult.rows[0].total_expenses;

  const monthlyMap = new Map();
  for (const r of monthlyResult.rows) {
    const key = new Date(r.month).toISOString().slice(0, 7);
    monthlyMap.set(key, (monthlyMap.get(key) || 0) + r.collected);
  }
  for (const r of chitCollections.byMonth) {
    monthlyMap.set(r.month, (monthlyMap.get(r.month) || 0) + r.collected);
  }
  const monthlyBreakdown = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, collected]) => ({ month, collected }));

  const chitCollectedById = new Map(chitCollections.byChit.map((c) => [c.id, c]));
  const chitBreakdown = allChits.map((c) => {
    const collected = chitCollectedById.get(c.id);
    return {
      id: c.id,
      refNumber: c.refNumber,
      name: c.refNumber,
      status: c.status,
      collected: collected ? collected.collected : 0,
      paymentCount: collected ? collected.paymentCount : 0,
    };
  });

  const memberMap = new Map();
  for (const r of memberResult.rows) {
    memberMap.set(r.id, { id: r.id, name: r.name, mobileNumber: r.mobile_number, totalPaid: r.total_paid, paymentCount: r.payment_count });
  }
  for (const r of chitCollections.byMember) {
    const existing = memberMap.get(r.id);
    if (existing) {
      existing.totalPaid += r.totalPaid;
      existing.paymentCount += r.paymentCount;
    } else {
      memberMap.set(r.id, { id: r.id, name: r.name, mobileNumber: r.mobileNumber, totalPaid: r.totalPaid, paymentCount: r.paymentCount });
    }
  }
  const memberBreakdown = Array.from(memberMap.values()).sort((a, b) => b.totalPaid - a.totalPaid);

  return {
    period: period || 'historical',
    range: { from: range.from, to: range.to },
    summary: {
      totalCollected,
      paymentCount: totalsResult.rows[0].payment_count + chitCollections.count,
      totalExpenses,
      expenseCount: expensesResult.rows[0].expense_count,
      net: totalCollected - totalExpenses,
    },
    monthlyBreakdown,
    chitBreakdown,
    memberBreakdown,
  };
}

module.exports = { buildReport };
