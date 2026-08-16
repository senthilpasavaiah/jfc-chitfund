const paymentProofService = require('../services/paymentProof.service');
const { recordAudit } = require('../utils/audit');

async function submit(req, res) {
  // A member submits their own proof (goes to pending review). An
  // admin/manager can submit on behalf of a member - since the admin IS
  // the authority, that's auto-confirmed immediately rather than queued.
  const memberId = req.body.memberId || req.user.memberId;
  const isAdminSubmitting = req.user.role === 'ADMIN' || req.user.role === 'MANAGER';
  const proof = await paymentProofService.submitProof({
    chitId: req.params.id,
    monthIndex: Number(req.params.monthIndex),
    memberId,
    imageData: req.body.imageData,
    imageMimeType: req.body.imageMimeType,
    submittedById: req.user.id,
    autoConfirm: isAdminSubmitting,
  });
  await recordAudit({ userId: req.user.id, action: 'PAYMENT_PROOF_SUBMIT', entityType: 'ChitPaymentProof', entityId: proof.id, ipAddress: req.ip });
  res.status(201).json({ success: true, data: { id: proof.id, status: proof.status, createdAt: proof.created_at } });
}

async function markManual(req, res) {
  await paymentProofService.markPaidManually(req.params.id, Number(req.params.monthIndex), req.body.memberId, req.user.id);
  await recordAudit({ userId: req.user.id, action: 'PAYMENT_MARK_MANUAL', entityType: 'Chit', entityId: req.params.id, metadata: { monthIndex: req.params.monthIndex, memberId: req.body.memberId }, ipAddress: req.ip });
  res.json({ success: true, message: 'Marked as paid (manual entry, no screenshot).' });
}

async function review(req, res) {
  const proof = await paymentProofService.reviewProof(req.params.proofId, {
    decision: req.body.decision,
    reviewerUserId: req.user.id,
    rejectionReason: req.body.rejectionReason,
  });
  await recordAudit({ userId: req.user.id, action: 'PAYMENT_PROOF_REVIEW', entityType: 'ChitPaymentProof', entityId: proof.id, metadata: { decision: req.body.decision }, ipAddress: req.ip });
  res.json({ success: true, data: { id: proof.id, status: proof.status } });
}

async function listPending(req, res) {
  const rows = await paymentProofService.listPending(req.query.chitId);
  res.json({ success: true, data: rows });
}

async function getImage(req, res) {
  const { image_data: imageData, image_mime_type: mimeType } = await paymentProofService.getProofImage(req.params.proofId);
  res.setHeader('Content-Type', mimeType);
  res.send(Buffer.from(imageData, 'base64'));
}

async function getForMonth(req, res) {
  const memberId = req.query.memberId || req.user.memberId;
  const proof = await paymentProofService.getForMonth(req.params.id, Number(req.params.monthIndex), memberId);
  res.json({ success: true, data: proof });
}

module.exports = { submit, markManual, review, listPending, getImage, getForMonth };
