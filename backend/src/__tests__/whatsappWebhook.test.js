const crypto = require('crypto');
const { parseAction, parseInboundMessage, verifySignature } = require('../services/whatsappWebhook.service');

describe('WhatsApp webhook parsing', () => {
  test('parses contextual payment actions', () => {
    expect(parseAction('JFC_ACTION:abc-123:4:PAID')).toEqual({
      chitId: 'abc-123', monthIndex: 4, action: 'PAID',
    });
  });

  test('parses contribution selection and BOTH', () => {
    expect(parseAction('JFC_PAY:abc-123:4:BOTH').selection).toBe('BOTH');
    expect(parseAction('JFC_PAY:abc-123:4:123e4567-e89b-12d3-a456-426614174000').selection).toBe('123e4567-e89b-12d3-a456-426614174000');
  });

  test('parses drawer confirmation only with explicit context', () => {
    expect(parseAction('JFC_DRAWER:CONFIRM:abc-123:4:123e4567-e89b-12d3-a456-426614174001')).toEqual({
      drawerAction: 'CONFIRM', chitId: 'abc-123', monthIndex: 4, payerMemberId: '123e4567-e89b-12d3-a456-426614174001',
    });
  });

  test('parses Meta template quick-reply payload as the contextual action', () => {
    const message = parseInboundMessage({
      id: 'wamid.button',
      from: '919999999999',
      button: {
        text: 'Paid',
        payload: 'JFC_ACTION:abc-123:4:PAID',
      },
    });
    expect(message.actionId).toBe('JFC_ACTION:abc-123:4:PAID');
  });

  test('parses UTR as plain text', () => {
    const message = parseInboundMessage({
      id: 'wamid.test',
      from: '919999999999',
      text: { body: 'UTR: 123456789' },
    });
    expect(message.actionId).toBe('UTR: 123456789');
  });
  test('verifies Meta webhook signature and rejects a tampered payload', () => {
    const previous = process.env.WHATSAPP_APP_SECRET;
    process.env.WHATSAPP_APP_SECRET = 'test-secret';
    const rawBody = Buffer.from('{"hello":"world"}');
    const signature = 'sha256=' + crypto.createHmac('sha256', 'test-secret').update(rawBody).digest('hex');
    expect(verifySignature(rawBody, signature)).toBe(true);
    expect(verifySignature(rawBody, signature.slice(0, -1) + (signature.endsWith('0') ? '1' : '0'))).toBe(false);
    if (previous === undefined) delete process.env.WHATSAPP_APP_SECRET;
    else process.env.WHATSAPP_APP_SECRET = previous;
  });
});
