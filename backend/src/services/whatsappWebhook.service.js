const crypto = require('crypto');
const { query } = require('../config/db');
const whatsappPaymentActionService = require('./whatsappPaymentAction.service');
const whatsappProvider = require('./whatsapp.provider');

function normalisePhone(value) { return String(value || '').replace(/[^0-9]/g, ''); }
function timingSafeEqualHex(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}
function verifySignature(rawBody, signature) {
  const appSecret = process.env.WHATSAPP_APP_SECRET || '';
  if (!appSecret || !rawBody || !signature) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  return timingSafeEqualHex(expected, String(signature));
}
async function findMemberByWhatsApp(waId) {
  const normalized = normalisePhone(waId);
  if (!normalized) return null;
  const { rows } = await query(
    "SELECT id, name, mobile_number, whatsapp_number FROM members WHERE regexp_replace(COALESCE(whatsapp_number, mobile_number, ''), '[^0-9]', '', 'g') = $1 LIMIT 1",
    [normalized]
  );
  return rows[0] || null;
}
function parseInboundMessage(message) {
  const interactive = message?.interactive;
  const buttonId = interactive?.button_reply?.id || interactive?.list_reply?.id || '';
  const text = String(message?.text?.body || '').trim();
  return { providerMessageId: message?.id || null, from: message?.from || '', actionId: buttonId || text, image: message?.image || null };
}
function parseAction(actionId) {
  const raw = String(actionId || '').trim();
  const upper = raw.toUpperCase();
  if (['NOT_YET', 'WILL_PAY', 'PAY_LATER', 'PAID'].includes(upper)) return { action: upper };
  const match = raw.match(/^JFC_PAY:([^:]+):(\d+):(BOTH|[0-9a-f-]+)$/i);
  if (match) return { chitId: match[1], monthIndex: Number(match[2]), selection: match[3] };
  const contextMatch = raw.match(/^JFC_ACTION:([^:]+):(\d+):(NOT_YET|WILL_PAY|PAY_LATER|PAID)$/i);
  if (contextMatch) return { chitId: contextMatch[1], monthIndex: Number(contextMatch[2]), action: contextMatch[3].toUpperCase() };
  return null;
}
async function sendSelectionPrompt(member, chitId, monthIndex, pending) {
  const lines = pending.map((item) => 'Contribution ' + (item.slotNumber ?? '-') + ' — ₹' + Number(item.amount || 0).toLocaleString('en-IN') + '\nReply: JFC_PAY:' + chitId + ':' + monthIndex + ':' + item.chitMemberId);
  if (pending.length > 1) lines.push('Both contributions — ₹' + pending.reduce((sum, item) => sum + Number(item.amount || 0), 0).toLocaleString('en-IN') + '\nReply: JFC_PAY:' + chitId + ':' + monthIndex + ':BOTH');
  return whatsappProvider.sendText({ to: member.whatsapp_number || member.mobile_number, body: 'Please select which contribution you paid for Month ' + (monthIndex + 1) + ':\n\n' + lines.join('\n\n') + '\n\nAfter selecting, please send the payment screenshot/receipt. The payment will remain pending until admin verification.' });
}
async function handleMessage(message) {
  const parsed = parseInboundMessage(message);
  const member = await findMemberByWhatsApp(parsed.from);
  if (!member) return { handled: false, reason: 'member_not_found' };
  const parsedAction = parseAction(parsed.actionId);
  if (!parsedAction) return { handled: false, reason: 'unsupported_action' };
  if (parsedAction.selection) {
    const pending = await whatsappPaymentActionService.listPending(member.id, parsedAction.chitId, parsedAction.monthIndex);
    const selectedIds = parsedAction.selection === 'BOTH' ? pending.map((item) => item.chitMemberId) : pending.filter((item) => item.chitMemberId === parsedAction.selection).map((item) => item.chitMemberId);
    if (!selectedIds.length) return { handled: false, reason: 'invalid_or_already_paid_contribution' };
    const result = await whatsappPaymentActionService.recordAction({ memberId: member.id, chitId: parsedAction.chitId, monthIndex: parsedAction.monthIndex, action: 'PAID', chitMemberIds: selectedIds, providerMessageId: parsed.providerMessageId, metadata: { source: 'whatsapp_webhook' } });
    await whatsappProvider.sendText({ to: member.whatsapp_number || member.mobile_number, body: 'Payment selection received for ' + selectedIds.length + ' contribution' + (selectedIds.length === 1 ? '' : 's') + '. Please send the payment screenshot/receipt and UTR/reference number. Admin verification is required before the portal is marked Paid.' });
    return { handled: true, action: 'PAID', result };
  }
  if (!parsedAction.chitId || parsedAction.monthIndex == null) return { handled: false, reason: 'missing_payment_context' };
  if (parsedAction.action === 'PAID') {
    const pending = await whatsappPaymentActionService.listPending(member.id, parsedAction.chitId, parsedAction.monthIndex);
    if (!pending.length) return { handled: false, reason: 'no_pending_contributions' };
    if (pending.length > 1) {
      const result = await whatsappPaymentActionService.recordAction({ memberId: member.id, chitId: parsedAction.chitId, monthIndex: parsedAction.monthIndex, action: 'SELECT_CONTRIBUTIONS', providerMessageId: parsed.providerMessageId, metadata: { source: 'whatsapp_webhook', pendingCount: pending.length } });
      await sendSelectionPrompt(member, parsedAction.chitId, parsedAction.monthIndex, pending);
      return { handled: true, action: 'SELECT_CONTRIBUTIONS', result };
    }
    const result = await whatsappPaymentActionService.recordAction({ memberId: member.id, chitId: parsedAction.chitId, monthIndex: parsedAction.monthIndex, action: 'PAID', chitMemberIds: [pending[0].chitMemberId], providerMessageId: parsed.providerMessageId, metadata: { source: 'whatsapp_webhook' } });
    await whatsappProvider.sendText({ to: member.whatsapp_number || member.mobile_number, body: 'Payment response received for Contribution ' + (pending[0].slotNumber ?? '-') + '. Please send the payment screenshot/receipt and UTR/reference number. Admin verification is required before the portal is marked Paid.' });
    return { handled: true, action: 'PAID', result };
  }
  const result = await whatsappPaymentActionService.recordAction({ memberId: member.id, chitId: parsedAction.chitId, monthIndex: parsedAction.monthIndex, action: parsedAction.action, providerMessageId: parsed.providerMessageId, metadata: { source: 'whatsapp_webhook' } });
  return { handled: true, action: parsedAction.action, result };
}
async function handleWebhookPayload(payload) {
  const messages = [];
  for (const entry of payload?.entry || []) for (const change of entry?.changes || []) for (const message of change?.value?.messages || []) messages.push(message);
  const results = [];
  for (const message of messages) results.push(await handleMessage(message));
  return results;
}
module.exports = { verifySignature, handleWebhookPayload, findMemberByWhatsApp };