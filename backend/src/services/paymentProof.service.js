const { query } = require('../config/db');
const ApiError = require('../utils/ApiError');
const chitService = require('./chit.service');
const notificationService = require('./notification.service');

const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // ~6MB raw, comfortably under the 8mb JSON body limit once base64-encoded

async function getOrCreateMonthData(chitId, monthIndex) {
  const chit = await chitService.getById(chitId);
  const { rows } = await query(
    `SELECT * FROM chit_month_data WHERE chit_id = $1 AND month_index = $2`,
    [chitId, monthIndex]
  );
  if (rows[0]) return { chit, monthData: rows[0] };
  const inserted = await query(
    `INSERT INTO chit_month_data (chit_id, month_index) VALUES ($1,$2) RETURNING *`,
    [chitId, monthIndex]
  );
  return { chit, monthData: inserted.rows[0] };
}

/**
 * Member (or admin, on a member's behalf) submits a payment proof screenshot
 * for a chit month. Blocks duplicate submissions while one is pending or
 * already confirmed - a rejected proof CAN be resubmitted (overwrites in
 * place, resets to pending).
 */
async function submitProof({ chitId, monthIndex, memberId, imageData, imageMimeType, submittedById, autoConfirm = false }) {
  if (!imageData) throw ApiError.badRequest('No image was provided.');
  const approxBytes = (imageData.length * 3) / 4;
  if (approxBytes > MAX_IMAGE_BYTES) {
    throw ApiError.badRequest('That image is too large. Please upload a screenshot under 6MB.');
  }

  const { monthData } = await getOrCreateMonthData(chitId, monthIndex);

  const { rows: existingRows } = await query(
    `SELECT * FROM chit_payment_proofs WHERE chit_month_data_id = $1 AND member_id = $2`,
    [monthData.id, memberId]
  );
  const existing = existingRows[0];

  if (existing && existing.status === 'confirmed') {
    throw ApiError.conflict('This month is already confirmed as paid. You can\'t submit another payment for it.');
  }
  if (existing && existing.status === 'pending') {
    throw ApiError.conflict('You\'ve already submitted proof for this month and it\'s awaiting admin review. Please wait for confirmation before submitting again.');
  }

  const status = autoConfirm ? 'confirmed' : 'pending';
  let proof;
  if (existing) {
    const { rows } = await query(
      `UPDATE chit_payment_proofs
       SET image_data = $1, image_mime_type = $2, status = $3, submitted_by_id = $4,
           reviewed_by_id = $5, reviewed_at = $6, rejection_reason = NULL, created_at = now()
       WHERE id = $7 RETURNING *`,
      [imageData, imageMimeType, status, submittedById, autoConfirm ? submittedById : null, autoConfirm ? new Date() : null, existing.id]
    );
    proof = rows[0];
  } else {
    const { rows } = await query(
      `INSERT INTO chit_payment_proofs (chit_month_data_id, member_id, image_data, image_mime_type, submitted_by_id, status, reviewed_by_id, reviewed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [monthData.id, memberId, imageData, imageMimeType, submittedById, status, autoConfirm ? submittedById : null, autoConfirm ? new Date() : null]
    );
    proof = rows[0];
  }

  if (autoConfirm) {
    await chitService.payForMonth(chitId, monthIndex, memberId);
  }

  const { rows: memberRows } = await query('SELECT name FROM members WHERE id = $1', [memberId]);
  const memberName = memberRows[0]?.name || 'A member';
  await notificationService.dispatch({
    memberId,
    channel: 'WHATSAPP',
    type: 'PAYMENT_RECEIVED',
    subject: autoConfirm ? 'Payment recorded by admin' : 'Payment proof submitted',
    body: autoConfirm
      ? `${memberName}'s payment was recorded directly by an admin.`
      : `${memberName} submitted a payment screenshot for review.`,
    createdById: submittedById,
  });

  return proof;
}

/** Admin marks a member paid without any screenshot at all - a plain manual entry. */
async function markPaidManually(chitId, monthIndex, memberId, adminUserId) {
  await chitService.payForMonth(chitId, monthIndex, memberId);
  const { monthData } = await getOrCreateMonthData(chitId, monthIndex);
  // Record a lightweight audit row so this shows up the same way a proof
  // would (status confirmed, but with no image) - keeps the history clean.
  await query(
    `INSERT INTO chit_payment_proofs (chit_month_data_id, member_id, image_data, image_mime_type, submitted_by_id, status, reviewed_by_id, reviewed_at)
     VALUES ($1,$2,'','application/x-manual-entry',$3,'confirmed',$3,now())
     ON CONFLICT (chit_month_data_id, member_id) DO UPDATE SET status = 'confirmed', reviewed_by_id = $3, reviewed_at = now()`,
    [monthData.id, memberId, adminUserId]
  );
}

async function reviewProof(proofId, { decision, reviewerUserId, rejectionReason }) {
  const { rows } = await query('SELECT * FROM chit_payment_proofs WHERE id = $1', [proofId]);
  const proof = rows[0];
  if (!proof) throw ApiError.notFound('Payment proof not found');
  if (proof.status !== 'pending') throw ApiError.badRequest('This proof has already been reviewed.');

  if (decision === 'confirm') {
    await query(
      `UPDATE chit_payment_proofs SET status = 'confirmed', reviewed_by_id = $1, reviewed_at = now() WHERE id = $2`,
      [reviewerUserId, proofId]
    );
    const { rows: mdRows } = await query('SELECT chit_id, month_index FROM chit_month_data WHERE id = $1', [proof.chit_month_data_id]);
    const { chit_id: chitId, month_index: monthIndex } = mdRows[0];
    await chitService.payForMonth(chitId, monthIndex, proof.member_id);
  } else if (decision === 'reject') {
    await query(
      `UPDATE chit_payment_proofs SET status = 'rejected', reviewed_by_id = $1, reviewed_at = now(), rejection_reason = $2 WHERE id = $3`,
      [reviewerUserId, rejectionReason || null, proofId]
    );
  } else {
    throw ApiError.badRequest('decision must be "confirm" or "reject"');
  }

  const { rows: updated } = await query('SELECT * FROM chit_payment_proofs WHERE id = $1', [proofId]);
  return updated[0];
}

async function listPending(chitId) {
  const { rows } = await query(
    `SELECT p.id, p.status, p.created_at, p.image_mime_type,
            m.name AS member_name, m.id AS member_id,
            cmd.month_index, c.ref_number
     FROM chit_payment_proofs p
     JOIN chit_month_data cmd ON cmd.id = p.chit_month_data_id
     JOIN chits c ON c.id = cmd.chit_id
     JOIN members m ON m.id = p.member_id
     WHERE p.status = 'pending' AND ($1::uuid IS NULL OR cmd.chit_id = $1)
     ORDER BY p.created_at ASC`,
    [chitId || null]
  );
  return rows;
}

async function getProofImage(proofId) {
  const { rows } = await query('SELECT image_data, image_mime_type FROM chit_payment_proofs WHERE id = $1', [proofId]);
  if (!rows[0]) throw ApiError.notFound('Payment proof not found');
  return rows[0];
}

async function getForMonth(chitId, monthIndex, memberId) {
  const { rows } = await query(
    `SELECT p.id, p.status, p.created_at, p.reviewed_at, p.rejection_reason
     FROM chit_payment_proofs p
     JOIN chit_month_data cmd ON cmd.id = p.chit_month_data_id
     WHERE cmd.chit_id = $1 AND cmd.month_index = $2 AND p.member_id = $3`,
    [chitId, monthIndex, memberId]
  );
  return rows[0] || null;
}

module.exports = { submitProof, markPaidManually, reviewProof, listPending, getProofImage, getForMonth };
