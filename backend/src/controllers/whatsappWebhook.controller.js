const whatsappWebhookService = require('../services/whatsappWebhook.service');
function verify(req, res) {
  const mode = req.query['hub.mode']; const token = req.query['hub.verify_token']; const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token && token === (process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '')) return res.status(200).send(challenge);
  return res.sendStatus(403);
}
async function receive(req, res) {
  if (!whatsappWebhookService.verifySignature(req.rawBody, req.headers['x-hub-signature-256'])) return res.sendStatus(403);
  const results = await whatsappWebhookService.handleWebhookPayload(req.body);
  res.status(200).json({ success: true, results });
}
module.exports = { verify, receive };