const { query, withTransaction } = require('../config/db');
const ApiError = require('../utils/ApiError');

function serialize(row) {
  if (!row) return null;
  return {
    id: row.id,
    refNumber: row.ref_number,
    name: row.name,
    chitValue: Number(row.chit_value),
    totalMonths: row.total_months,
    monthlyInstallment: Number(row.monthly_installment),
    commissionPercent: Number(row.commission_percent),
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function create(input) {
  const { refNumber, name, chitValue, totalMonths, commissionPercent } = input;
  const monthlyInstallment = Number(chitValue) / Number(totalMonths);

  const existing = await query('SELECT id FROM chits WHERE ref_number = $1', [refNumber]);
  if (existing.rows.length) throw ApiError.conflict('A chit with this reference number already exists');

  const { rows } = await query(
    `INSERT INTO chits (ref_number, name, chit_value, total_months, monthly_installment, commission_percent)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [refNumber, name, chitValue, totalMonths, monthlyInstallment.toFixed(2), commissionPercent || 5.0]
  );
  return serialize(rows[0]);
}

async function list({ status } = {}) {
  const params = [];
  let where = '';
  if (status) {
    params.push(status);
    where = `WHERE status = $1`;
  }
  const { rows } = await query(`SELECT * FROM chits ${where} ORDER BY created_at DESC`, params);
  return rows.map(serialize);
}

async function getById(id) {
  const { rows } = await query('SELECT * FROM chits WHERE id = $1', [id]);
  if (!rows[0]) throw ApiError.notFound('Chit not found');

  const members = await query(
    `SELECT cm.*, m.name, m.mobile_number FROM chit_members cm
     JOIN members m ON m.id = cm.member_id
     WHERE cm.chit_id = $1 ORDER BY cm.slot_number NULLS LAST, cm.joined_at`,
    [id]
  );
  const auctions = await query(`SELECT * FROM auctions WHERE chit_id = $1 ORDER BY month_number`, [id]);

  return {
    ...serialize(rows[0]),
    members: members.rows.map((r) => ({
      id: r.id,
      memberId: r.member_id,
      name: r.name,
      mobileNumber: r.mobile_number,
      slotNumber: r.slot_number,
      isActive: r.is_active,
    })),
    auctions: auctions.rows.map((a) => ({
      id: a.id,
      monthNumber: a.month_number,
      scheduledDate: a.scheduled_date,
      status: a.status,
      winnerId: a.winner_id,
      discountAmount: a.discount_amount ? Number(a.discount_amount) : null,
      dividendPerMember: a.dividend_per_member ? Number(a.dividend_per_member) : null,
      organizerCommission: a.organizer_commission ? Number(a.organizer_commission) : null,
    })),
  };
}

async function addMember(chitId, { memberId, slotNumber }) {
  const chit = await query('SELECT status FROM chits WHERE id = $1', [chitId]);
  if (!chit.rows[0]) throw ApiError.notFound('Chit not found');
  if (chit.rows[0].status !== 'DRAFT') {
    throw ApiError.badRequest('Members can only be added while the chit is in DRAFT status');
  }

  const member = await query('SELECT id FROM members WHERE id = $1', [memberId]);
  if (!member.rows[0]) throw ApiError.notFound('Member not found');

  const { rows } = await query(
    `INSERT INTO chit_members (chit_id, member_id, slot_number) VALUES ($1,$2,$3) RETURNING *`,
    [chitId, memberId, slotNumber || null]
  );
  return rows[0];
}

async function removeMember(chitId, memberId) {
  const chit = await query('SELECT status FROM chits WHERE id = $1', [chitId]);
  if (!chit.rows[0]) throw ApiError.notFound('Chit not found');
  if (chit.rows[0].status !== 'DRAFT') {
    throw ApiError.badRequest('Members can only be removed while the chit is in DRAFT status');
  }
  await query('DELETE FROM chit_members WHERE chit_id = $1 AND member_id = $2', [chitId, memberId]);
}

/**
 * Starts a chit: generates one installment row per member per month, and
 * one auction record per month, then flips status to ACTIVE.
 * Requires the chit to have exactly `totalMonths` active members - this is
 * the standard chit-fund convention (one member wins the pot per month).
 */
async function start(chitId, { startDate } = {}) {
  return withTransaction(async (client) => {
    const chitResult = await client.query('SELECT * FROM chits WHERE id = $1 FOR UPDATE', [chitId]);
    const chit = chitResult.rows[0];
    if (!chit) throw ApiError.notFound('Chit not found');
    if (chit.status !== 'DRAFT') throw ApiError.badRequest('Only a DRAFT chit can be started');

    const membersResult = await client.query(
      'SELECT member_id FROM chit_members WHERE chit_id = $1 AND is_active = TRUE',
      [chitId]
    );
    const members = membersResult.rows;
    if (members.length !== chit.total_months) {
      throw ApiError.badRequest(
        `This chit has ${chit.total_months} months but ${members.length} member(s) assigned. ` +
          `Standard chit funds require exactly one member per month.`
      );
    }

    const start = startDate ? new Date(startDate) : new Date();

    for (let month = 1; month <= chit.total_months; month += 1) {
      const dueDate = new Date(start);
      dueDate.setMonth(dueDate.getMonth() + (month - 1));

      for (const { member_id: memberId } of members) {
        await client.query(
          `INSERT INTO installments (chit_id, member_id, month_number, due_date, base_amount)
           VALUES ($1,$2,$3,$4,$5)`,
          [chitId, memberId, month, dueDate, chit.monthly_installment]
        );
      }

      await client.query(
        `INSERT INTO auctions (chit_id, month_number, scheduled_date) VALUES ($1,$2,$3)`,
        [chitId, month, dueDate]
      );
    }

    const updated = await client.query(
      `UPDATE chits SET status = 'ACTIVE', start_date = $1 WHERE id = $2 RETURNING *`,
      [start, chitId]
    );
    return serialize(updated.rows[0]);
  });
}

async function close(chitId) {
  const pending = await query(
    `SELECT COUNT(*)::int AS count FROM installments WHERE chit_id = $1 AND status != 'PAID' AND status != 'WAIVED'`,
    [chitId]
  );
  if (pending.rows[0].count > 0) {
    throw ApiError.badRequest(`Cannot close: ${pending.rows[0].count} installment(s) are not yet paid or waived`);
  }
  const { rows } = await query(
    `UPDATE chits SET status = 'CLOSED', end_date = now() WHERE id = $1 RETURNING *`,
    [chitId]
  );
  if (!rows[0]) throw ApiError.notFound('Chit not found');
  return serialize(rows[0]);
}

/**
 * Completes an auction: records the winner and discount bid, computes the
 * organizer's commission and the per-member dividend, then credits that
 * dividend against every non-winning member's installment for the month.
 *
 * Formula (standard chit-fund convention):
 *   organizerCommission = chitValue * commissionPercent / 100
 *   dividendPool        = discountAmount - organizerCommission
 *   dividendPerMember   = dividendPool / (activeMemberCount - 1)   [winner excluded]
 */
async function completeAuction(chitId, auctionId, { winnerId, discountAmount, notes }) {
  return withTransaction(async (client) => {
    const chitResult = await client.query('SELECT * FROM chits WHERE id = $1 FOR UPDATE', [chitId]);
    const chit = chitResult.rows[0];
    if (!chit) throw ApiError.notFound('Chit not found');
    if (chit.status !== 'ACTIVE') throw ApiError.badRequest('Chit must be ACTIVE to complete an auction');

    const auctionResult = await client.query('SELECT * FROM auctions WHERE id = $1 AND chit_id = $2', [auctionId, chitId]);
    const auction = auctionResult.rows[0];
    if (!auction) throw ApiError.notFound('Auction not found');
    if (auction.status !== 'SCHEDULED') throw ApiError.badRequest('This auction has already been completed or cancelled');

    const winnerCheck = await client.query(
      'SELECT 1 FROM chit_members WHERE chit_id = $1 AND member_id = $2 AND is_active = TRUE',
      [chitId, winnerId]
    );
    if (!winnerCheck.rows[0]) throw ApiError.badRequest('Winner must be an active member of this chit');

    // A member can only win once per chit.
    const alreadyWon = await client.query(
      `SELECT 1 FROM auctions WHERE chit_id = $1 AND winner_id = $2 AND status = 'COMPLETED'`,
      [chitId, winnerId]
    );
    if (alreadyWon.rows[0]) throw ApiError.badRequest('This member has already won a previous month in this chit');

    const membersResult = await client.query(
      'SELECT member_id FROM chit_members WHERE chit_id = $1 AND is_active = TRUE',
      [chitId]
    );
    const activeMembers = membersResult.rows.map((r) => r.member_id);
    const nonWinners = activeMembers.filter((m) => m !== winnerId);

    const chitValue = Number(chit.chit_value);
    const commissionPercent = Number(chit.commission_percent);
    const organizerCommission = Number(((chitValue * commissionPercent) / 100).toFixed(2));
    const dividendPool = Number(discountAmount) - organizerCommission;
    if (dividendPool < 0) {
      throw ApiError.badRequest('Discount amount is smaller than the organizer commission - dividend cannot be negative');
    }
    const dividendPerMember = nonWinners.length > 0 ? Number((dividendPool / nonWinners.length).toFixed(2)) : 0;

    await client.query(
      `UPDATE auctions
       SET status = 'COMPLETED', winner_id = $1, discount_amount = $2, organizer_commission = $3,
           dividend_per_member = $4, notes = $5, completed_at = now()
       WHERE id = $6`,
      [winnerId, discountAmount, organizerCommission, dividendPerMember, notes || null, auctionId]
    );

    for (const memberId of nonWinners) {
      await client.query(
        `UPDATE installments SET dividend_adjustment = $1, updated_at = now()
         WHERE chit_id = $2 AND member_id = $3 AND month_number = $4`,
        [dividendPerMember, chitId, memberId, auction.month_number]
      );
    }

    return {
      auctionId,
      winnerId,
      discountAmount: Number(discountAmount),
      organizerCommission,
      dividendPerMember,
      nonWinnerCount: nonWinners.length,
    };
  });
}

module.exports = { create, list, getById, addMember, removeMember, start, close, completeAuction, serialize };
