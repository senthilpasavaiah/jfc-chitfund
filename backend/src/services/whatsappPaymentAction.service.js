const { query, withTransaction } = require('../config/db');
const ApiError = require('../utils/ApiError');
const chitService = require('./chit.service');

const ACTIONS = ['NOT_YET', 'WILL_PAY', 'PAY_LATER', 'PAID', 'SELECT_CONTRIBUTIONS'];

async function getPendingContributions(memberId, chitId, monthIndex) {
  const { rows: monthRows } = await query(
    `SELECT id FROM chit_month_data WHERE chit_id = $1 AND month_index = $2 LIMIT 1`,
    [chitId, monthIndex]
  );
  const monthData = monthRows[0];
  if (!monthData) throw ApiError.notFound('Chit month not found.');

  const { rows: chitRows } = await query('SELECT * FROM chits WHERE id = $1 LIMIT 1', [chitId]);
  const chit = chitRows[0];
  if (!chit) throw ApiError.notFound('Chit not found.');

  const { rows } = await query(
    `SELECT cm.id AS chit_member_id, cm.slot_number, cm.member_id,
            COALESCE(cmp.paid, FALSE) AS paid
     FROM chit_members cm
     LEFT JOIN chit_month_payments cmp
       ON cmp.chit_month_data_id = $1 AND cmp.chit_member_id = cm.id
     WHERE cm.chit_id = $2 AND cm.member_id = $3 AND cm.is_active = TRUE
     ORDER BY cm.slot_number`,
    [monthData.id, chitId, memberId]
  );

  const legacy = await query(
    `SELECT paid FROM chit_month_payments
     WHERE chit_month_data_id = $1 AND member_id = $2 AND chit_member_id IS NULL
     ORDER BY paid DESC LIMIT 1`,
    [monthData.id, memberId]
  );
  const legacyPaid = legacy.rows[0]?.paid === true;

  return {
    monthDataId: monthData.id,
    contributions: rows
      .filter((row) => !row.paid && !legacyPaid)
      .map((row) => ({
        chitMemberId: row.chit_member_id,
        slotNumber: row.slot_number,
        amount: Number(chitService.chitMonthlyPaymentForRound(chit, monthIndex)),
      })),
  };
}

async function recordAction({
  memberId,
  chitId,
  monthIndex,
  action,
  chitMemberIds = [],
  amount = null,
  providerMessageId = null,
  metadata = {},
}) {
  if (!ACTIONS.includes(action)) throw ApiError.badRequest('Invalid WhatsApp payment action.');

  const pending = await getPendingContributions(memberId, chitId, monthIndex);
  const requested = [...new Set((Array.isArray(chitMemberIds) ? chitMemberIds : []).filter(Boolean))];

  if (action === 'PAID' || action === 'SELECT_CONTRIBUTIONS') {
    if (!requested.length) {
      throw ApiError.badRequest('Select the contribution(s) covered by this payment.');
    }
    const allowed = new Set(pending.contributions.map((item) => item.chitMemberId));
    if (requested.some((id) => !allowed.has(id))) {
      throw ApiError.badRequest('One or more selected contributions are not currently pending.');
    }
  }

  const { rows } = await query(
    `INSERT INTO whatsapp_payment_actions
      (member_id, chit_id, chit_month_data_id, month_index, chit_member_ids, action, amount, provider_message_id, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      memberId,
      chitId,
      pending.monthDataId,
      monthIndex,
      requested,
      action,
      amount,
      providerMessageId,
      metadata,
    ]
  );
  return rows[0];
}

async function listPending(memberId, chitId, monthIndex) {
  return getPendingContributions(memberId, chitId, monthIndex);
}

module.exports = { ACTIONS, getPendingContributions, recordAction, listPending };
