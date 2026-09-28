const { parseAction, parseInboundMessage } = require('../services/whatsappWebhook.service');

describe('WhatsApp webhook parsing', () => {
  test('parses contextual payment actions', () => {
    expect(parseAction('JFC_ACTION:abc-123:4:PAID')).toEqual({
      chitId: 'abc-123', monthIndex: 4, action: 'PAID',
    });
  });

  test('parses contribution selection and BOTH', () => {
    expect(parseAction('JFC_PAY:abc-123:4:BOTH').selection).toBe('BOTH');
    expect(parseAction('JFC_PAY:abc-123:4:slot-1').selection).toBe('slot-1');
  });

  test('parses drawer confirmation only with explicit context', () => {
    expect(parseAction('JFC_DRAWER:CONFIRM:abc-123:4:member-1')).toEqual({
      drawerAction: 'CONFIRM', chitId: 'abc-123', monthIndex: 4, payerMemberId: 'member-1',
    });
  });

  test('parses UTR as plain text', () => {
    const message = parseInboundMessage({
      id: 'wamid.test',
      from: '919999999999',
      text: { body: 'UTR: 123456789' },
    });
    expect(message.actionId).toBe('UTR: 123456789');
  });
});
