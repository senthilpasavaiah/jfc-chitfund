const express = require('express');
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const fundService = require('../services/fund.service');
const chitService = require('../services/chit.service');
const paymentService = require('../services/payment.service');

const router = express.Router();
router.use(authenticate);

router.get('/summary', async (req, res) => {
  const [members, classicPaymentsThisMonth, expensesThisMonth, pendingSummary, growth] = await Promise.all([
    query(`SELECT
             COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active,
             COUNT(*)::int AS total
           FROM members`),
    query(`SELECT COALESCE(SUM(amount), 0)::float AS total
           FROM payments
           WHERE date_trunc('month', paid_at) = date_trunc('month', now())`),
    query(`SELECT COALESCE(SUM(amount), 0)::float AS total
           FROM expenses
           WHERE date_trunc('month', spent_at) = date_trunc('month', now())`),
    paymentService.currentPendingSummary(),
    fundService.growthSeries(),
  ]);

  // Chit status is computed from dates (upcoming/ongoing/completed), not a
  // stored column - the old ACTIVE/CLOSED column is legacy and never updates.
  const allChits = await chitService.list({});
  const activeChits = allChits.filter((c) => c.status === 'ongoing').length;
  const closedChits = allChits.filter((c) => c.status === 'completed').length;

  const classicTotalResult = await query(`SELECT COALESCE(SUM(amount), 0)::float AS total FROM payments`);

  // Real chit-fund contributions (confirmed via payment proof / manual entry)
  // - the classic `payments` table only covers the older auction-style
  // chits, so combine both so "collected" reflects everything.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [chitCollectionsAllTime, chitCollectionsThisMonth] = await Promise.all([
    chitService.getConfirmedChitCollections(),
    chitService.getConfirmedChitCollections({ from: monthStart }),
  ]);

  const monthlyCollection = classicPaymentsThisMonth.rows[0].total + chitCollectionsThisMonth.total;
  const totalCollection = classicTotalResult.rows[0].total + chitCollectionsAllTime.total;

  // Single source of truth: fundService.summary() is also what the Fund
  // page calls (GET /fund/summary), and it now folds in each chit's own
  // live expense entries (chit_auto_ledger) alongside the office `expenses`
  // table. Previously this route ran its own separate SUM(amount) FROM
  // expenses query here, which never saw chit-related expenses at all -
  // that's why the Expenses card didn't move when a chit's financial data
  // changed, and why it could disagree with the Fund page.
  const fundsSummary = await fundService.summary();
  // Reads straight from chit_month_data - the exact field Assign/Shuffle/
  // Recall write to - so this panel can't drift out of sync with the
  // actual assignment shown on the Chit Detail page.
  const currentMonthDrawers = await chitService.getCurrentMonthDrawers();

  res.json({
    success: true,
    data: {
      totalMembers: members.rows[0].total,
      activeMembers: members.rows[0].active,
      activeChits,
      closedChits,
      monthlyCollection,
      monthlyExpenses: expensesThisMonth.rows[0].total,
      pendingPayments: pendingSummary,
      totalCollection,
      totalExpenses: fundsSummary.totalExpenses,
      profit: totalCollection - fundsSummary.totalExpenses,
      incomeViaChit: fundsSummary.incomeViaChit,
      incomeViaDonation: fundsSummary.incomeViaDonation,
      incomeViaSantha: fundsSummary.incomeViaSantha,
      totalIncome: fundsSummary.totalIncome,
      currentlyInHand: fundsSummary.currentlyInHand,
      accruedProfit: fundsSummary.accruedProfit,
      finalSettlementValue: fundsSummary.finalSettlementValue,
      currentMonthDrawers,
      fundGrowth: growth,
    },
  });
});

router.get('/recent-activity', async (req, res) => {
  const { rows } = await query(
    `SELECT a.action, a.entity_type, a.entity_id, a.created_at, u.phone AS actor_phone, u.role AS actor_role
     FROM audit_logs a
     LEFT JOIN users u ON u.id = a.user_id
     ORDER BY a.created_at DESC
     LIMIT 25`
  );
  res.json({ success: true, data: rows });
});

module.exports = router;
