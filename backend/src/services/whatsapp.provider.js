const META_GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || 'v23.0';
const GRAPH_BASE = 'https://graph.facebook.com';

function isEnabled() {
  return String(process.env.WHATSAPP_ENABLED || '').toLowerCase() === 'true';
}

function getConfig() {
  return {
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    reminderTemplate: process.env.WHATSAPP_PAYMENT_REMINDER_TEMPLATE || '',
    drawerPaymentTemplate: process.env.WHATSAPP_DRAWER_PAYMENT_TEMPLATE || '',
    templateLanguage: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en_US',
  };
}

function normalisePhone(value) {
  return String(value || '').replace(/[^0-9]/g, '');
}

async function sendTemplate({ to, templateName, languageCode, bodyParameters = [] }) {
  const config = getConfig();
  if (!config.accessToken || !config.phoneNumberId) {
    throw new Error('WhatsApp is enabled but WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID is missing.');
  }
  if (!templateName) {
    throw new Error('WhatsApp template name is required for an outbound template message.');
  }

  const recipient = normalisePhone(to);
  if (!recipient) throw new Error('Recipient does not have a valid WhatsApp number.');

  const components = bodyParameters.length
    ? [{ type: 'body', parameters: bodyParameters.map((text) => ({ type: 'text', text: String(text) })) }]
    : [];

  const response = await fetch(
    `${GRAPH_BASE}/${META_GRAPH_VERSION}/${config.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode || config.templateLanguage },
          ...(components.length ? { components } : {}),
        },
      }),
    }
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `WhatsApp API returned HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

/**
 * Sends only when explicitly enabled. With the default configuration
 * (WHATSAPP_ENABLED is not "true") this function performs no network call.
 */
async function sendNotification({ member, type, subject, body }) {
  if (!isEnabled()) return { enabled: false, sent: false };

  const to = member?.whatsapp_number || member?.mobile_number;
  if (!to) throw new Error('Member has no WhatsApp/mobile number configured.');

  const config = getConfig();

  // Proactive payment reminders use an approved template. Other notification
  // types remain logged until their production-safe templates/interactive
  // flows are configured.
  if (type === 'PAYMENT_REMINDER') {
    if (!config.reminderTemplate) {
      throw new Error('WHATSAPP_PAYMENT_REMINDER_TEMPLATE is not configured.');
    }
    const result = await sendTemplate({
      to,
      templateName: config.reminderTemplate,
      languageCode: config.templateLanguage,
      bodyParameters: [member.name || '', subject || '', body || ''],
    });
    return { enabled: true, sent: true, providerMessageId: result?.messages?.[0]?.id || null };
  }

  if (type === 'PAYMENT_RECEIVED') {
    if (!config.drawerPaymentTemplate) {
      throw new Error('WHATSAPP_DRAWER_PAYMENT_TEMPLATE is not configured.');
    }
    const result = await sendTemplate({
      to,
      templateName: config.drawerPaymentTemplate,
      languageCode: config.templateLanguage,
      bodyParameters: [member.name || '', subject || '', body || ''],
    });
    return { enabled: true, sent: true, providerMessageId: result?.messages?.[0]?.id || null };
  }

  // Deliberately defer other automated types until their approved templates
  // and interactive flows are configured.
  return { enabled: true, sent: false, deferred: true };
}

module.exports = { isEnabled, sendNotification, sendTemplate };


async function sendText({ to, body }) {
  const config = getConfig();
  if (!isEnabled()) return { enabled: false, sent: false };
  if (!config.accessToken || !config.phoneNumberId) {
    throw new Error('WhatsApp is enabled but WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID is missing.');
  }
  const recipient = normalisePhone(to);
  if (!recipient) throw new Error('Recipient does not have a valid WhatsApp number.');
  const response = await fetch(
    `${GRAPH_BASE}/${META_GRAPH_VERSION}/${config.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: recipient,
        type: 'text',
        text: { body },
      }),
    }
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `WhatsApp API returned HTTP ${response.status}`;
    throw new Error(message);
  }
  return { enabled: true, sent: true, providerMessageId: payload?.messages?.[0]?.id || null };
}

async function downloadMedia(mediaId) {
  const config = getConfig();
  if (!isEnabled()) throw new Error('WhatsApp is disabled.');
  if (!config.accessToken || !mediaId) throw new Error('WhatsApp media access is not configured.');
  const metaResponse = await fetch(`${GRAPH_BASE}/${META_GRAPH_VERSION}/${mediaId}`, {
    headers: { Authorization: `Bearer ${config.accessToken}` },
  });
  const meta = await metaResponse.json().catch(() => ({}));
  if (!metaResponse.ok || !meta?.url) {
    throw new Error(meta?.error?.message || `WhatsApp media lookup failed with HTTP ${metaResponse.status}`);
  }
  const mediaResponse = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${config.accessToken}` },
  });
  if (!mediaResponse.ok) {
    throw new Error(`WhatsApp media download failed with HTTP ${mediaResponse.status}`);
  }
  const buffer = Buffer.from(await mediaResponse.arrayBuffer());
  return {
    imageData: buffer.toString('base64'),
    imageMimeType: meta.mime_type || mediaResponse.headers.get('content-type') || 'image/jpeg',
    sha256: meta.sha256 || null,
  };
}

module.exports.sendText = sendText;
module.exports.downloadMedia = downloadMedia;
