const { query, withTransaction } = require('../config/db');
const ApiError = require('../utils/ApiError');

// Late fine policy: 1% of the base installment amount per week overdue,
// capped at 10% of the base amount. Adjust to JFC's actual by-laws as needed.
const FINE_RATE_PER_WEEK = 0.01;
const FINE_CAP_RATIO = 0.1;

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

    // Apply/refresh late fine only for genuinely overdue, still-pending installments.
    let fineAmount = Number(installment.fine_amount);
    if (!isAdvance && paidAt > new Date(installment.due_date) && installment.status !== 'PAID') {
      fineAmount = calculateFine(installment.base_amount, installment.due_date, paidAt);
      await client.query('UPDATE installments SET fine_amount = $1, status = $2 WHERE id = $3', [
        fineAmount,
        'LATE',
        installmentId,
      ]);
    }

    const receiptNumber = await generateReceiptNumber(client);
    const paymentResult = await client.query(
      `INSERT INTO payments (installment_id, member_id, amount, method, reference_number, paid_at, recorded_by_id, receipt_number, is_advance, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        installmentId,
        installment.member_id,
        amount,
        method || 'CASH',
        referenceNumber || null,
        paidAt,
        recordedById,
        receiptNumber,
        !!isAdvance,
        notes || null,
      ]
    );

    // Check if the installment is now fully covered.
    const totalPaidResult = await client.query(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE installment_id = $1`,
      [installmentId]
    );
    const totalPaid = Number(totalPaidResult.rows[0].total);
    const amountDue =
      Number(installment.base_amount) + fineAmount - Number(installment.dividend_adjustment);

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
  const { rows } = await query(
    `SELECT * FROM installments WHERE ${conditions.join(' AND ')} ORDER BY due_date ASC`,
    params
  );
  return rows;
}

module.exports = { record, listByChit, pendingInstallments, calculateFine };
