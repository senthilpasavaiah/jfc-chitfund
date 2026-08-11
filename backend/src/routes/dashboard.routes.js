const express = require('express');
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const fundService = require('../services/fund.service');

const router = express.Router();
router.use(authenticate);

router.get('/summary', async (req, res) => {
  const [members, chits, collections, pending, expenses] = await Promise.all([
    query(`SELECT
             COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active,
             COUNT(*)::int AS total
           FROM members`),
    query(`SELECT
             COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS active,
             COUNT(*) FILTER (WHERE status = 'CLOSED')::int AS closed
           FROM chits`),
    query(`SELECT COALESCE(SUM(amount), 0)::float AS total
           FROM payments
           WHERE date_trunc('month', paid_at) = date_trunc('month', now())`),
    query(`SELECT COALESCE(SUM(base_amount + fine_amount - dividend_adjustment), 0)::float AS total,
                  COUNT(*)::int AS count
           FROM installments WHERE status IN ('PENDING','LATE')`),
    query(`SELECT COALESCE(SUM(amount), 0)::float AS total
           FROM expenses
           WHERE date_trunc('month', spent_at) = date_trunc('month', now())`),
  ]);

  const totalCollectionResult = await query(`SELECT COALESCE(SUM(amount), 0)::float AS total FROM payments`);
  const totalCollection = totalCollectionResult.rows[0].total;
  const totalExpenseResult = await query(`SELECT COALESCE(SUM(amount), 0)::float AS total FROM expenses`);
  const totalExpense = totalExpenseResult.rows[0].total;

  const fundsSummary = await fundService.summary();

  res.json({
    success: true,
    data: {
      totalMembers: members.rows[0].total,
      activeMembers: members.rows[0].active,
      activeChits: chits.rows[0].active,
      closedChits: chits.rows[0].closed,
      monthlyCollection: collections.rows[0].total,
      monthlyExpenses: expenses.rows[0].total,
      pendingPayments: { total: pending.rows[0].total, count: pending.rows[0].count },
      totalCollection,
      totalExpenses: totalExpense,
      profit: totalCollection - totalExpense,
      // Funds figures - imported from JFC_Santha_Settlement_2026.xlsx, plus
      // whatever is recorded going forward. See fund.service.js for the
      // exact aggregation - nothing here is hardcoded.
      incomeViaChit: fundsSummary.incomeViaChit,
      incomeViaDonation: fundsSummary.incomeViaDonation,
      incomeViaSantha: fundsSummary.incomeViaSantha,
      totalIncome: fundsSummary.totalIncome,
      currentlyInHand: fundsSummary.currentlyInHand,
      accruedProfit: fundsSummary.accruedProfit,
      finalSettlementValue: fundsSummary.finalSettlementValue,
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
