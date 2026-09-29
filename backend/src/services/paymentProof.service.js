const { query } = require('../config/db');
const ApiError = require('../utils/ApiError');
const chitService = require('./chit.service');
const notificationService = require('./notification.service');

const MAX_IMAGE_BYTES = 6 * 1024 * 1024; // ~6MB raw, comfortably under the 8mb JSON body limit once base64-encoded

async function notifyDrawerOfPayment(chitId, monthIndex, memberId, createdById, chitMemberIds = []) {
  const { rows } = await query(
    `SELECT md.drawn_by_member_id, c.ref_number, m.name AS member_name
     FROM chit_month_data md
     JOIN chits c ON c.id = md.chit_id
     JOIN members m ON m.id = $3
     WHERE md.chit_id = $1 AND md.month_index = $2`,
    [chitId, monthIndex, memberId]
  );
  const row = rows[0];
  if (!row?.drawn_by_member_id || row.drawn_by_member_id === memberId) return;

  const { rows: contributionRows } = chitMemberIds.length ? await query(
    `SELECT slot_number FROM chit_members WHERE id = ANY($1::uuid[]) ORDER BY slot_number`,
    [chitMemberIds]
  ) : { rows: [] };
  const contributionLabel = contributionRows.length
    ? contributionRows.map((item) => `Contribution ${item.slot_number}`).join(', ')
    : 'legacy member-level payment';

  const chit = await chitService.getById(chitId);
  const expectedPerContribution = Number(chitService.chitMonthlyPaymentForRound(chit, monthIndex));
  const contributionCount = contributionRows.length || (await query(
    `SELECT COUNT(*)::int AS count FROM chit_members WHERE chit_id = $1 AND member_id = $2 AND is_active = TRUE`,
    [chitId, memberId]
  )).rows[0]?.count || 1;

  const { rows: confirmationRows } = await query(
    `INSERT INTO whatsapp_payment_actions
      (member_id, chit_id, chit_month_data_id, month_index, chit_member_ids, action, amount, metadata)
     SELECT $1, md.chit_id, md.id, md.month_index, $2::uuid[], 'DRAWER_CONFIRM', $3,
            jsonb_build_object('payer_member_id', $4, 'payer_name', $5)
     FROM chit_month_data md
     WHERE md.chit_id = $6 AND md.month_index = $7
     RETURNING id`,
    [row.drawn_by_member_id, chitMemberIds, expectedPerContribution * contributionCount, memberId, row.member_name, chitId, monthIndex]
  );
  const confirmationId = confirmationRows[0]?.id || null;

  await notificationService.dispatch({
    memberId: row.drawn_by_member_id,
    channel: 'WHATSAPP',
    type: 'PAYMENT_RECEIVED',
    subject: `${row.ref_number} - Month ${monthIndex + 1} payment received`,
    body: `${row.member_name} has paid the Month ${monthIndex + 1} installment for ${row.ref_number}. ${contributionLabel}. Please confirm the payment received. Reply: JFC_DRAWER:CONFIRM:${chitId}:${monthIndex}:${memberId}`,
    createdById,
  });
  return confirmationId;
}

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
async function submitProof({ chitId, monthIndex, memberId, chitMemberIds = [], imageData, imageMimeType, submittedById, autoConfirm = false, utrNumber = null, declaredAmount = null }) {
  if (!imageData) throw ApiError.badRequest('No image was provided.');
  await chitService.assertPaymentRequiredForMonth(chitId, monthIndex, memberId);
  const requestedSlotIds = [...new Set((Array.isArray(chitMemberIds) ? chitMemberIds : []).filter(Boolean))];
  const participants = await query(
    `SELECT id, member_id, slot_number
     FROM chit_members
     WHERE chit_id = $1 AND member_id = $2 AND is_active = TRUE
     ORDER BY slot_number`,
    [chitId, memberId]
  );
  if (!requestedSlotIds.length && participants.rows.length > 1) {
    throw ApiError.badRequest('This member has multiple contributions in this chit. Select the exact contribution(s) being paid.');
  }
  const selectedSlots = requestedSlotIds.length
    ? participants.rows.filter((p) => requestedSlotIds.includes(p.id))
    : participants.rows;
  if (!selectedSlots.length) throw ApiError.badRequest('Select at least one valid contribution for this payment.');
  if (requestedSlotIds.length && selectedSlots.length !== requestedSlotIds.length) {
    throw ApiError.badRequest('One or more selected contributions are invalid for this member.');
  }
  const selectedSlotIds = selectedSlots.map((p) => p.id);
  const { monthData } = await getOrCreateMonthData(chitId, monthIndex);

  const { rows: paidRows } = await query(
    `SELECT chit_member_id
     FROM chit_month_payments
     WHERE chit_month_data_id = $1
       AND chit_member_id = ANY($2::uuid[])
       AND paid = TRUE`,
    [monthData.id, selectedSlotIds]
  );
  const paidSlotIds = new Set(paidRows.map((row) => row.chit_member_id));
  if ([...paidSlotIds].length) {
    throw ApiError.conflict('One or more selected contributions are already marked Paid. Please select only pending contributions.');
  }

  if (declaredAmount != null) {
    const expectedPerContribution = Number(chitService.chitMonthlyPaymentForRound(chit, monthIndex));
    const expectedTotal = expectedPerContribution * selectedSlots.length;
    const declared = Number(declaredAmount);
    if (!Number.isFinite(declared) || declared <= 0) throw ApiError.badRequest('Declared payment amount must be greater than zero.');
    if (Math.abs(declared - expectedTotal) > 0.01) {
      throw ApiError.badRequest(`Declared amount ₹${declared.toFixed(2)} does not match the selected ${selectedSlots.length} contribution${selectedSlots.length === 1 ? '' : 's'} total of ₹${expectedTotal.toFixed(2)}.`);
    }
  }

  const approxBytes = (imageData.length * 3) / 4;
  if (approxBytes > MAX_IMAGE_BYTES) {
    throw ApiError.badRequest('That image is too large. Please upload a screenshot under 6MB.');
  }

  const { rows: pendingRows } = await query(
    `SELECT id FROM chit_payment_proofs
     WHERE chit_month_data_id = $1 AND member_id = $2 AND status = 'pending'
     ORDER BY created_at DESC LIMIT 1`,
    [monthData.id, memberId]
  );
  if (pendingRows[0]) {
    throw ApiError.conflict('You\'ve already submitted proof for this month and it\'s awaiting admin review. Please wait for confirmation before submitting another proof.');
  }

  // Confirmed/rejected proofs do not block a new proof when other contribution
  // slots are still pending. The selected slot payment state above is the
  // authoritative duplicate check.
  const status = autoConfirm ? 'confirmed' : 'pending';
  const { rows: insertedRows } = await query(
    `INSERT INTO chit_payment_proofs (chit_month_data_id, member_id, chit_member_ids, image_data, image_mime_type, submitted_by_id, status, reviewed_by_id, reviewed_at, utr_number, declared_amount)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [monthData.id, memberId, selectedSlotIds, imageData, imageMimeType, submittedById, status, autoConfirm ? submittedById : null, autoConfirm ? new Date() : null, utrNumber || null, declaredAmount == null ? null : Number(declaredAmount)]
  );
  const proof = insertedRows[0];

  if (autoConfirm) {
    for (const chitMemberId of selectedSlotIds) {
      await chitService.payForMonth(chitId, monthIndex, memberId, chitMemberId);
    }
    await notifyDrawerOfPayment(chitId, monthIndex, memberId, submittedById, selectedSlotIds);
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
async function markPaidManually(chitId, monthIndex, memberId, adminUserId, chitMemberIds = [], declaredAmount = null) {
  const requested = [...new Set((Array.isArray(chitMemberIds) ? chitMemberIds : []).filter(Boolean))];
  const participants = await query(
    `SELECT id FROM chit_members WHERE chit_id = $1 AND member_id = $2 AND is_active = TRUE ORDER BY slot_number`,
    [chitId, memberId]
  );
  const selected = requested.length ? participants.rows.filter((p) => requested.includes(p.id)).map((p) => p.id) : participants.rows.map((p) => p.id);
  if (!selected.length) throw ApiError.badRequest('Select at least one valid contribution.');
  if (requested.length && selected.length !== requested.length) throw ApiError.badRequest('One or more selected contributions are invalid.');
  if (declaredAmount != null) {
    const chit = await chitService.getById(chitId);
    const expectedPerContribution = Number(chitService.chitMonthlyPaymentForRound(chit, monthIndex));
    const expectedTotal = expectedPerContribution * selected.length;
    const declared = Number(declaredAmount);
    if (!Number.isFinite(declared) || declared <= 0) {
      throw ApiError.badRequest('Declared payment amount must be greater than zero.');
    }
    if (Math.abs(declared - expectedTotal) > 0.01) {
      throw ApiError.badRequest(`Declared amount ₹${declared.toFixed(2)} does not match the selected ${selected.length} contribution${selected.length === 1 ? '' : 's'} total of ₹${expectedTotal.toFixed(2)}.`);
    }
  }
  for (const chitMemberId of selected) {
    await chitService.payForMonth(chitId, monthIndex, memberId, chitMemberId);
  }
  await notifyDrawerOfPayment(chitId, monthIndex, memberId, adminUserId, selected);
  const { monthData } = await getOrCreateMonthData(chitId, monthIndex);
  // Record a lightweight audit row so this shows up the same way a proof
  // would (status confirmed, but with no image) - keeps the history clean.
  await query(
    `INSERT INTO chit_payment_proofs (chit_month_data_id, member_id, chit_member_ids, image_data, image_mime_type, submitted_by_id, status, reviewed_by_id, reviewed_at, declared_amount)
     VALUES ($1,$2,$4,'','application/x-manual-entry',$3,'confirmed',$3,now(),$5)
     ON CONFLICT (chit_month_data_id, member_id) DO UPDATE SET status = 'confirmed', reviewed_by_id = $3, reviewed_at = now(), chit_member_ids = $4, declared_amount = $5`,
    [monthData.id, memberId, adminUserId, selected, declaredAmount == null ? null : Number(declaredAmount)]
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
    const selectedIds = Array.isArray(proof.chit_member_ids) && proof.chit_member_ids.length ? proof.chit_member_ids : [];
    if (selectedIds.length) {
      for (const chitMemberId of selectedIds) {
        await chitService.payForMonth(chitId, monthIndex, proof.member_id, chitMemberId);
      }
    } else {
      const { rows: slots } = await query(
        `SELECT id FROM chit_members WHERE chit_id = $1 AND member_id = $2 AND is_active = TRUE`,
        [chitId, proof.member_id]
      );
      for (const slot of slots) {
        await chitService.payForMonth(chitId, monthIndex, proof.member_id, slot.id);
      }
    }
    await notifyDrawerOfPayment(chitId, monthIndex, proof.member_id, reviewerUserId, selectedIds);
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
     WHERE p.status = 'pending'
       AND ($1::uuid IS NULL OR cmd.chit_id = $1)
       AND p.member_id IS DISTINCT FROM cmd.drawn_by_member_id
     ORDER BY p.created_at ASC`,
    [chitId || null]
  );
  return rows;
}

async function getProofAccess(proofId) {
  const { rows } = await query('SELECT id, member_id FROM chit_payment_proofs WHERE id = $1', [proofId]);
  if (!rows[0]) throw ApiError.notFound('Payment proof not found');
  return rows[0];
}

async function getProofImage(proofId) {
  const { rows } = await query('SELECT image_data, image_mime_type FROM chit_payment_proofs WHERE id = $1', [proofId]);
  if (!rows[0]) throw ApiError.notFound('Payment proof not found');
  return rows[0];
}

async function getForMonth(chitId, monthIndex, memberId) {
  const { rows } = await query(
    `SELECT p.id, p.status, p.created_at, p.reviewed_at, p.rejection_reason,
           p.chit_member_ids
     FROM chit_payment_proofs p
     JOIN chit_month_data cmd ON cmd.id = p.chit_month_data_id
     WHERE cmd.chit_id = $1 AND cmd.month_index = $2 AND p.member_id = $3
     ORDER BY p.created_at DESC
     LIMIT 1`,
    [chitId, monthIndex, memberId]
  );
  return rows[0] || null;
}

async function attachUtrToPendingProof(memberId, chitId, monthIndex, utrNumber) {
  const { rows } = await query(
    `SELECT p.id
     FROM chit_payment_proofs p
     JOIN chit_month_data md ON md.id = p.chit_month_data_id
     WHERE p.member_id = $1 AND md.chit_id = $2 AND md.month_index = $3 AND p.status = 'pending'
     ORDER BY p.created_at DESC
     LIMIT 1`,
    [memberId, chitId, monthIndex]
  );
  if (!rows[0]) return null;
  const { rows: updated } = await query(
    `UPDATE chit_payment_proofs SET utr_number = $1 WHERE id = $2 RETURNING *`,
    [utrNumber, rows[0].id]
  );
  return updated[0] || null;
}

module.exports = {
  submitProof,
  markPaidManually,
  reviewProof,
  listPending,
  getProofImage,
  getForMonth,
  attachUtrToPendingProof,
  getProofAccess,
};
