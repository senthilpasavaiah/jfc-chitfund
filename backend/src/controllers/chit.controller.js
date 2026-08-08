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
  const chit = await chitService.getById(req.params.id);
  res.json({ success: true, data: chit });
}

async function addMember(req, res) {
  const cm = await chitService.addMember(req.params.id, req.body);
  await recordAudit({ userId: req.user.id, action: 'CHIT_MEMBER_ADD', entityType: 'Chit', entityId: req.params.id, metadata: { memberId: req.body.memberId }, ipAddress: req.ip });
  res.status(201).json({ success: true, data: cm });
}

async function removeMember(req, res) {
  await chitService.removeMember(req.params.id, req.params.memberId);
  await recordAudit({ userId: req.user.id, action: 'CHIT_MEMBER_REMOVE', entityType: 'Chit', entityId: req.params.id, metadata: { memberId: req.params.memberId }, ipAddress: req.ip });
  res.json({ success: true, message: 'Member removed from chit' });
}

async function start(req, res) {
  const chit = await chitService.start(req.params.id, req.body);
  await recordAudit({ userId: req.user.id, action: 'CHIT_START', entityType: 'Chit', entityId: chit.id, ipAddress: req.ip });
  res.json({ success: true, data: chit });
}

async function close(req, res) {
  const chit = await chitService.close(req.params.id);
  await recordAudit({ userId: req.user.id, action: 'CHIT_CLOSE', entityType: 'Chit', entityId: chit.id, ipAddress: req.ip });
  res.json({ success: true, data: chit });
}

async function completeAuction(req, res) {
  const result = await chitService.completeAuction(req.params.id, req.params.auctionId, req.body);
  await recordAudit({
    userId: req.user.id,
    action: 'AUCTION_COMPLETE',
    entityType: 'Auction',
    entityId: req.params.auctionId,
    metadata: result,
    ipAddress: req.ip,
  });
  res.json({ success: true, data: result });
}

module.exports = { create, list, getById, addMember, removeMember, start, close, completeAuction };
