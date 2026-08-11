const fundService = require('../services/fund.service');
const { recordAudit } = require('../utils/audit');

async function listDonations(req, res) {
  const rows = await fundService.listDonations();
  res.json({ success: true, data: rows });
}

async function addDonation(req, res) {
  const row = await fundService.addDonation(req.body, req.user.id);
  await recordAudit({ userId: req.user.id, action: 'DONATION_ADD', entityType: 'Donation', entityId: row.id, ipAddress: req.ip });
  res.status(201).json({ success: true, data: row });
}

async function listSantha(req, res) {
  const rows = await fundService.listSantha();
  res.json({ success: true, data: rows });
}

async function addSantha(req, res) {
  const row = await fundService.addSantha(req.body);
  await recordAudit({ userId: req.user.id, action: 'SANTHA_ADD', entityType: 'SanthaEntry', entityId: row.id, ipAddress: req.ip });
  res.status(201).json({ success: true, data: row });
}

async function listChitProfitHistory(req, res) {
  const rows = await fundService.listChitProfitHistory();
  res.json({ success: true, data: rows });
}

async function listSettlement(req, res) {
  const data = await fundService.listSettlement();
  res.json({ success: true, data });
}

async function addSettlementYear(req, res) {
  const row = await fundService.addSettlementYear(req.body);
  await recordAudit({ userId: req.user.id, action: 'SETTLEMENT_YEAR_ADD', entityType: 'SettlementSummary', entityId: row.id, ipAddress: req.ip });
  res.status(201).json({ success: true, data: row });
}

async function summary(req, res) {
  const data = await fundService.summary();
  res.json({ success: true, data });
}

module.exports = {
  listDonations,
  addDonation,
  listSantha,
  addSantha,
  listChitProfitHistory,
  listSettlement,
  addSettlementYear,
  summary,
};
