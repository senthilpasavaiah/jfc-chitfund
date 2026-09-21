const paymentService = require('../services/payment.service');
const { recordAudit } = require('../utils/audit');

async function record(req, res) {
  const result = await paymentService.record(req.user.id, req.body);
  await recordAudit({
    userId: req.user.id,
    action: 'PAYMENT_RECORD',
    entityType: 'Payment',
    entityId: result.payment.id,
    metadata: { installmentId: req.body.installmentId, amount: req.body.amount },
    ipAddress: req.ip,
  });
  res.status(201).json({ success: true, data: result });
}

async function listByChit(req, res) {
  const payments = await paymentService.listByChit(req.params.chitId);
  res.json({ success: true, data: payments });
}

async function pending(req, res) {
  const installments = await paymentService.pendingInstallments(req.query);
  res.json({ success: true, data: installments });
}

async function overview(req, res) {
  const data = await paymentService.paymentOverview(req.query);
  res.json({ success: true, data });
}

async function options(req, res) {
  const data = await paymentService.paymentOverview({ status: 'ALL' });
  res.json({ success: true, data: data.options });
}

module.exports = { record, listByChit, pending, overview, options };
