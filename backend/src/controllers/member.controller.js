const memberService = require('../services/member.service');
const { recordAudit } = require('../utils/audit');

async function create(req, res) {
  const member = await memberService.create(req.body);
  await recordAudit({ userId: req.user.id, action: 'MEMBER_CREATE', entityType: 'Member', entityId: member.id, ipAddress: req.ip });
  res.status(201).json({ success: true, data: member });
}

async function list(req, res) {
  const result = await memberService.list(req.query, req.user);
  res.json({ success: true, ...result });
}

async function getById(req, res) {
  const member = await memberService.getById(req.params.id, req.user);
  res.json({ success: true, data: member });
}

async function update(req, res) {
  const member = await memberService.update(req.params.id, req.body);
  await recordAudit({ userId: req.user.id, action: 'MEMBER_UPDATE', entityType: 'Member', entityId: member.id, ipAddress: req.ip });
  res.json({ success: true, data: member });
}

async function remove(req, res) {
  await memberService.remove(req.params.id);
  await recordAudit({ userId: req.user.id, action: 'MEMBER_DEACTIVATE', entityType: 'Member', entityId: req.params.id, ipAddress: req.ip });
  res.json({ success: true, message: 'Member deactivated' });
}

async function paymentHistory(req, res) {
  const history = await memberService.paymentHistory(req.params.id);
  res.json({ success: true, data: history });
}

module.exports = { create, list, getById, update, remove, paymentHistory };
