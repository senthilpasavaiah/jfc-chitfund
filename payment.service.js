const { query, withTransaction } = require('../config/db');
const ApiError = require('../utils/ApiError');
const chitService = require('./chit.service');

// Late fine policy for the legacy installment engine.
const FINE_RATE_PER_WEEK = 0.01;
const FINE_CAP_RATIO = 0.1;
const NEW_MANAGEMENT_START_DATE = '2026-07-01';

function calculateFine(baseAmount, dueDate, paidAt) {
  const msLate = new Date(paidAt) - new Date(dueDate);
  if (msLate <= 0) return 0;
  const weeksLate = Math.ceil(msLate / (7 * 24 * 60 * 60 * 1000));
  const fine = Number(baseAmount) * FINE_RATE_PER_WEEK * weeksLate;
  const cap = Number(baseAmount) * FINE_CAP_RATIO;
  return Number(Math.min(fine, cap).toFixed(2));
}

async function generateReceiptNumber(client) {
  const { rows } = await client.query(`SELECT COUNT(*)::int AS count FROM payments`);
  const seq = rows[0].count + 1;
  const year = new Date().getFullYear();
  return `JFC-${year}-${String(seq).padStart(5, '0')}`;
}

async function record(recordedById, { installmentId, amount, method, referenceNumber, isAdvance, notes }) {
  return withTransaction(async (client) => {
    const instResult = await client.query('SELECT * FROM installments WHERE id = $1 FOR UPDATE', [installmentId]);
    const installment = instResult.rows[0];
    if (!installment) throw ApiError.notFound('Installment not found');
    if (installment.status === 'PAID') throw ApiError.badRequest('This installment is already fully paid');
    if (installment.status === 'WAIVED') throw ApiError.badRequest('This installment has been waived');

    const paidAt = new Date();
    let fineAmount = Number(installment.fine_amount);
    if (!isAdvance && paidAt > new Date(installment.due_date) && installment.status !== 'PAID') {
      fineAmount = calculateFine(installment.base_amount, installment.due_date, paidAt);
      await client.query('UPDATE installments SET fine_amount = $1, status = $2 WHERE id = $3', [fineAmount, 'LATE', installmentId]);
    }

    const receiptNumber = await generateReceiptNumber(client);
    const paymentResult = await client.query(
      `INSERT INTO payments (installment_id, member_id, amount, method, reference_number, paid_at, recorded_by_id, receipt_number, is_advance, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [installmentId, installment.member_id, amount, method || 'CASH', referenceNumber || null, paidAt, recordedById, receiptNumber, !!isAdvance, notes || null]
    );

    const totalPaidResult = await client.query(`SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE installment_id = $1`, [installmentId]);
    const totalPaid = Number(totalPaidResult.rows[0].total);
    const amountDue = Number(installment.base_amount) + fineAmount - Number(installment.dividend_adjustment);

    if (totalPaid >= amountDue) {
      await client.query(`UPDATE installments SET status = 'PAID', updated_at = now() WHERE id = $1`, [installmentId]);
    }

    return { payment: paymentResult.rows[0], amountDue, totalPaid, remaining: Math.max(0, amountDue - totalPaid) };
  });
}

async function listByChit(chitId) {
  const { rows } = await query(
    `SELECT p.*, m.name AS member_name, i.month_number
     FROM payments p
     JOIN members m ON m.id = p.member_id
     JOIN installments i ON i.id = p.installment_id
     WHERE i.chit_id = $1
     ORDER BY p.paid_at DESC`,
    [chitId]
  );
  return rows;
}

async function pendingInstallments({ chitId, memberId } = {}) {
  const conditions = [`status IN ('PENDING','LATE')`];
  const params = [];
  if (chitId) {
    params.push(chitId);
    conditions.push(`chit_id = $${params.length}`);
  }
  if (memberId) {
    params.push(memberId);
    conditions.push(`member_id = $${params.length}`);
  }
  const { rows } = await query(`SELECT * FROM installments WHERE ${conditions.join(' AND ')} ORDER BY due_date ASC`, params);
  return rows;
}

function parseMemberIds(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap((v) => String(v).split(',')).filter(Boolean);
  return String(value).split(',').map((v) => v.trim()).filter(Boolean);
}

function dateOnly(date) {
  return date ? new Date(date).toISOString().slice(0, 10) : null;
}

function monthDate(startDate, monthIndex) {
  if (!startDate) return null;
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + Number(monthIndex));
  return d;
}

function statusForPaid(paid, dueDate) {
  if (paid) return 'PAID';
  if (!dueDate) return 'PENDING';
  return new Date(dueDate) < new Date() ? 'OVERDUE' : 'UPCOMING';
}

function rowMatches(row, filters) {
  if (filters.chitId && row.chitId !== filters.chitId) return false;
  if (filters.memberIds.length && !filters.memberIds.includes(row.memberId)) return false;
  if (filters.status && filters.status !== 'ALL' && row.status !== filters.status) return false;
  if (filters.month && !row.monthDate?.startsWith(filters.month)) return false;
  if (filters.from && row.monthDate && row.monthDate < filters.from) return false;
  if (filters.to && row.monthDate && row.monthDate > filters.to) return false;
  return true;
}

/**
 * Unified payment view for the Payment page.
 * It combines the legacy installment/payment engine with the current JFC
 * chit_month_payments engine so the UI has one consistent source of truth.
 */
async function paymentOverview(filters = {}, includeOptions = true) {
  const normalized = {
    chitId: filters.chitId || null,
    memberIds: parseMemberIds(filters.memberIds),
    status: filters.status || 'ALL',
    month: filters.month || null,
    from: filters.from || null,
    to: filters.to || null,
  };

  const [classicResult, chitResult] = await Promise.all([
    query(`
      SELECT i.id, i.chit_id, i.member_id, i.month_number, i.due_date,
             i.base_amount, i.fine_amount, i.dividend_adjustment, i.status,
             c.ref_number, c.name AS chit_name,
             m.name AS member_name, m.mobile_number,
             COALESCE(SUM(p.amount),0)::float AS paid_amount
      FROM installments i
      JOIN chits c ON c.id = i.chit_id
      JOIN members m ON m.id = i.member_id
      LEFT JOIN payments p ON p.installment_id = i.id
      GROUP BY i.id, c.ref_number, c.name, m.name, m.mobile_number
      ORDER BY i.due_date DESC
    `),
    query(`
      SELECT c.id AS chit_id, c.ref_number, c.name AS chit_name, c.value_lakh,
             c.total_months, c.rate_schedule, c.start_date,
             cm.member_id, m.name AS member_name, m.mobile_number,
             gs.month_index,
             COALESCE(cmp.paid, FALSE) AS paid
      FROM chits c
      JOIN chit_members cm ON cm.chit_id = c.id AND cm.is_active = TRUE
      JOIN members m ON m.id = cm.member_id
      CROSS JOIN LATERAL generate_series(0, c.total_months - 1) AS gs(month_index)
      LEFT JOIN chit_month_data cmd ON cmd.chit_id = c.id AND cmd.month_index = gs.month_index
      LEFT JOIN chit_month_payments cmp ON cmp.chit_month_data_id = cmd.id AND cmp.member_id = cm.member_id
      ORDER BY c.start_date DESC NULLS LAST, c.ref_number, gs.month_index, m.name
    `),
  ]);

  const rows = [];
  for (const r of classicResult.rows) {
    const due = new Date(r.due_date);
    const amountDue = Number(r.base_amount) + Number(r.fine_amount) - Number(r.dividend_adjustment);
    const paid = Number(r.paid_amount || 0);
    const status = r.status === 'PAID' || paid >= amountDue ? 'PAID' : paid > 0 ? 'PARTIAL' : (due < new Date() ? 'OVERDUE' : 'PENDING');
    rows.push({
      id: `legacy-${r.id}`,
      source: 'legacy',
      chitId: r.chit_id,
      chitRef: r.ref_number,
      chitName: r.chit_name,
      memberId: r.member_id,
      memberName: r.member_name,
      mobileNumber: r.mobile_number,
      monthIndex: Number(r.month_number) - 1,
      monthLabel: `Month ${r.month_number}`,
      monthDate: dateOnly(r.due_date),
      dueDate: dateOnly(r.due_date),
      expected: amountDue,
      paid: paid,
      balance: Math.max(0, amountDue - paid),
      status,
      installmentId: r.id,
    });
  }

  for (const r of chitResult.rows) {
    const due = monthDate(r.start_date, r.month_index);
    const expected = chitService.chitMonthlyPaymentForRound(r, Number(r.month_index));
    const paid = r.paid === true;
    const status = statusForPaid(paid, due);
    rows.push({
      id: `chit-${r.chit_id}-${r.member_id}-${r.month_index}`,
      source: 'chit',
      chitId: r.chit_id,
      chitRef: r.ref_number,
      chitName: r.chit_name,
      memberId: r.member_id,
      memberName: r.member_name,
      mobileNumber: r.mobile_number,
      monthIndex: Number(r.month_index),
      monthLabel: due ? due.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : `Month ${Number(r.month_index) + 1}`,
      monthDate: dateOnly(due),
      dueDate: dateOnly(due),
      expected,
      paid: paid ? expected : 0,
      balance: paid ? 0 : expected,
      status,
      installmentId: null,
    });
  }

  const filtered = rows.filter((row) => rowMatches(row, normalized));
  const summary = filtered.reduce((acc, row) => {
    acc.expected += row.expected;
    acc.collected += row.paid;
    if (row.status !== 'PAID') acc.pending += row.balance;
    if (row.status === 'OVERDUE') acc.overdue += row.balance;
    if (row.status !== 'PAID' && row.status !== 'UPCOMING') acc.pendingCount += 1;
    if (row.status === 'PAID') acc.paidCount += 1;
    return acc;
  }, { expected: 0, collected: 0, pending: 0, overdue: 0, pendingCount: 0, paidCount: 0 });

  let options = { chits: [], members: [] };
  if (includeOptions) {
    const [chitsResult, membersResult] = await Promise.all([
      query(`SELECT id, ref_number, name, value_lakh, total_months, start_date, status FROM chits ORDER BY start_date DESC NULLS LAST, ref_number ASC`),
      query(`SELECT id, name, mobile_number, status FROM members ORDER BY name ASC`),
    ]);
    options = { chits: chitsResult.rows, members: membersResult.rows };
  }

  return { rows: filtered, summary, options };
}

/** Pending amount/count used by Dashboard. New Management only, due now or overdue. */
async function currentPendingSummary() {
  const [legacy, chit] = await Promise.all([
    query(`
      SELECT i.base_amount, i.fine_amount, i.dividend_adjustment,
             COALESCE(SUM(p.amount),0)::float AS paid_amount
      FROM installments i
      JOIN chits c ON c.id = i.chit_id
      LEFT JOIN payments p ON p.installment_id = i.id
      WHERE i.status IN ('PENDING','LATE')
        AND i.due_date >= $1
        AND i.due_date <= now()
        AND COALESCE(c.start_date, i.due_date) >= $1
      GROUP BY i.id
    `, [NEW_MANAGEMENT_START_DATE]),
    query(`
      SELECT c.id AS chit_id, c.value_lakh, c.total_months, c.rate_schedule, c.start_date,
             cm.member_id, gs.month_index, COALESCE(cmp.paid, FALSE) AS paid
      FROM chits c
      JOIN chit_members cm ON cm.chit_id = c.id AND cm.is_active = TRUE
      CROSS JOIN LATERAL generate_series(0, c.total_months - 1) AS gs(month_index)
      LEFT JOIN chit_month_data cmd ON cmd.chit_id = c.id AND cmd.month_index = gs.month_index
      LEFT JOIN chit_month_payments cmp ON cmp.chit_month_data_id = cmd.id AND cmp.member_id = cm.member_id
      WHERE c.start_date >= $1
        AND c.start_date IS NOT NULL
    `, [NEW_MANAGEMENT_START_DATE]),
  ]);

  const total = legacy.rows.reduce((sum, row) => {
    const due = Number(row.base_amount) + Number(row.fine_amount) - Number(row.dividend_adjustment);
    return sum + Math.max(0, due - Number(row.paid_amount || 0));
  }, 0);
  const count = legacy.rows.reduce((n, row) => {
    const due = Number(row.base_amount) + Number(row.fine_amount) - Number(row.dividend_adjustment);
    return n + (Number(row.paid_amount || 0) < due ? 1 : 0);
  }, 0);

  let chitTotal = 0;
  let chitCount = 0;
  for (const row of chit.rows) {
    const dueDate = monthDate(row.start_date, Number(row.month_index));
    if (!dueDate || dueDate > new Date() || row.paid) continue;
    chitTotal += chitService.chitMonthlyPaymentForRound(row, Number(row.month_index));
    chitCount += 1;
  }
  return { total: Number((total + chitTotal).toFixed(2)), count: count + chitCount };
}

/** Collection summary used by Reports; it includes actual member payments but never treats them as Association profit. */
async function collectionSummary({ from, to } = {}) {
  const result = await paymentOverview({ from, to, status: 'ALL' }, false);
  const byChit = new Map();
  for (const row of result.rows) {
    const item = byChit.get(row.chitId) || { chitId: row.chitId, chitRef: row.chitRef, expected: 0, collected: 0, pending: 0, overdue: 0 };
    item.expected += row.expected;
    item.collected += row.paid;
    item.pending += row.status === 'PAID' ? 0 : row.balance;
    item.overdue += row.status === 'OVERDUE' ? row.balance : 0;
    byChit.set(row.chitId, item);
  }
  return { ...result.summary, byChit: Array.from(byChit.values()) };
}

module.exports = {
  record,
  listByChit,
  pendingInstallments,
  calculateFine,
  paymentOverview,
  currentPendingSummary,
  collectionSummary,
};
