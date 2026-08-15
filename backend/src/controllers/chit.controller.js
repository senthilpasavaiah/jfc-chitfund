const chitService = require('../services/chit.service');
const { recordAudit } = require('../utils/audit');

async function create(req, res) {
  const chit = await chitService.create(req.body);
  await recordAudit({ userId: req.user.id, action: 'CHIT_CREATE', entityType: 'Chit', entityId: chit.id, ipAddress: req.ip });
  res.status(201).json({ success: true, data: chit });
}

async function list(req, res) {
  const chits = await chitService.list(req.query);
  res.json({ success: true, data: chits });
}

async function getById(req, res) {
  const chit = await chitService.getDetail(req.params.id, req.user);
  res.json({ success: true, data: chit });
}

async function deleteChit(req, res) {
  await chitService.deleteChit(req.params.id);
  await recordAudit({ userId: req.user.id, action: 'CHIT_DELETE', entityType: 'Chit', entityId: req.params.id, ipAddress: req.ip });
  res.json({ success: true, message: 'Chit deleted' });
}

async function addMembers(req, res) {
  await chitService.addMembers(req.params.id, req.body.memberIds);
  await recordAudit({ userId: req.user.id, action: 'CHIT_MEMBERS_ADD', entityType: 'Chit', entityId: req.params.id, metadata: { memberIds: req.body.memberIds }, ipAddress: req.ip });
  const chit = await chitService.getDetail(req.params.id, req.user);
  res.json({ success: true, data: chit });
}

async function removeMember(req, res) {
  await chitService.removeMember(req.params.id, Number(req.params.slotIndex));
  await recordAudit({ userId: req.user.id, action: 'CHIT_MEMBER_REMOVE', entityType: 'Chit', entityId: req.params.id, ipAddress: req.ip });
  const chit = await chitService.getDetail(req.params.id, req.user);
  res.json({ success: true, data: chit });
}

async function join(req, res) {
  await chitService.joinChit(req.params.id, req.user.memberId);
  await recordAudit({ userId: req.user.id, action: 'CHIT_JOIN', entityType: 'Chit', entityId: req.params.id, ipAddress: req.ip });
  const chit = await chitService.getDetail(req.params.id, req.user);
  res.json({ success: true, data: chit });
}

async function leave(req, res) {
  await chitService.leaveChit(req.params.id, req.user.memberId);
  await recordAudit({ userId: req.user.id, action: 'CHIT_LEAVE', entityType: 'Chit', entityId: req.params.id, ipAddress: req.ip });
  res.json({ success: true, message: 'You have left this chit.' });
}

async function getMonthDetail(req, res) {
  const chit = await chitService.getById(req.params.id);
  const detail = await chitService.getMonthDetail(chit, Number(req.params.monthIndex));
  res.json({ success: true, data: detail });
}

async function togglePaid(req, res) {
  await chitService.togglePaid(req.params.id, Number(req.params.monthIndex), req.body.memberId);
  await recordAudit({ userId: req.user.id, action: 'CHIT_PAYMENT_TOGGLE', entityType: 'Chit', entityId: req.params.id, metadata: { monthIndex: req.params.monthIndex, memberId: req.body.memberId }, ipAddress: req.ip });
  res.json({ success: true });
}

async function payForMonth(req, res) {
  await chitService.payForMonth(req.params.id, Number(req.params.monthIndex), req.user.memberId);
  res.json({ success: true, message: 'Marked as paid.' });
}

async function assignDraw(req, res) {
  await chitService.assignDraw(req.params.id, Number(req.params.monthIndex), req.body.memberId);
  await recordAudit({ userId: req.user.id, action: 'CHIT_DRAW_ASSIGN', entityType: 'Chit', entityId: req.params.id, metadata: { monthIndex: req.params.monthIndex, memberId: req.body.memberId }, ipAddress: req.ip });
  res.json({ success: true });
}

async function submitRequest(req, res) {
  await chitService.submitRequest(req.params.id, Number(req.params.monthIndex), req.user.memberId, req.body.type);
  res.json({ success: true });
}

async function cancelRequest(req, res) {
  await chitService.cancelRequest(req.params.id, Number(req.params.monthIndex), req.user.memberId);
  res.json({ success: true });
}

async function performShuffle(req, res) {
  const result = await chitService.performShuffle(req.params.id, Number(req.params.monthIndex), req.body.memberIds);
  await recordAudit({ userId: req.user.id, action: 'CHIT_SHUFFLE', entityType: 'Chit', entityId: req.params.id, metadata: { monthIndex: req.params.monthIndex, ...result }, ipAddress: req.ip });
  res.json({ success: true, data: result });
}

async function getLedger(req, res) {
  const ledger = await chitService.getLedger(req.params.id);
  res.json({ success: true, data: ledger });
}

module.exports = {
  create, list, getById, deleteChit, addMembers, removeMember, join, leave,
  getMonthDetail, togglePaid, payForMonth, assignDraw, submitRequest, cancelRequest,
  performShuffle, getLedger,
};
