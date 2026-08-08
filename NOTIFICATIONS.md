# Notifications — current state and how to go live

## What happens today

`backend/src/services/notification.service.js` writes every notification
"intent" (recipient, channel, type, message body) to the `notifications`
table with `status = 'LOGGED'`. **Nothing is actually sent.** This was a
deliberate choice for this build, since the sandbox this was built in has no
route to any SMS/WhatsApp/Email provider anyway, and wiring up real
credentials is a decision (and a cost) for you to make, not something to
default into.

You can see every logged notification via:
```sql
SELECT * FROM notifications ORDER BY created_at DESC;
```

## What's already wired to call it

- `POST /api/auth/forgot-password` logs a reset-token message (channel: SMS)
- The auction/payment flows are natural next hook points for
  "auction reminder" / "payment received" messages — the `NotificationType`
  enum already has `PAYMENT_REMINDER`, `AUCTION_REMINDER`, `PAYMENT_RECEIVED`,
  `CHIT_STARTED`, `CHIT_CLOSED`, `AUCTION_WON` ready to use.

## Going live: WhatsApp

For India, the practical options are:
1. **Meta WhatsApp Cloud API** (direct from Meta) — free tier available, needs a Meta Business Account and a verified WhatsApp Business number.
2. **Twilio WhatsApp API** — easier onboarding, per-message cost, works through Twilio's sandbox for testing before you get your own number approved.

Either way, template messages (for OTPs, payment reminders) need to be
pre-approved by WhatsApp before they can be sent outside a 24-hour
customer-service window — factor that approval lead time in.

## Going live: SMS

Transactional SMS to Indian phone numbers legally requires **DLT
(Distributed Ledger Technology) registration** with TRAI, via your telecom
operator or an aggregator like Twilio's Indian SMS, MSG91, or Kaleyra. This
is a compliance step, not just an API key — expect a few days to a couple of
weeks for registration approval.

## Going live: Email

SendGrid or Amazon SES are both straightforward — an API key and a verified
sending domain gets you going same-day.

## Wiring it in

Replace the body of `dispatch()` in `notification.service.js`:

```javascript
async function dispatch({ memberId, channel, type, subject, body, createdById }) {
  // 1. Look up the member's phone/email/whatsapp number
  // 2. Call the provider's SDK (twilio, @sendgrid/mail, etc.)
  // 3. Store the result with status PENDING -> SENT or FAILED, not LOGGED
  const record = await query(`INSERT INTO notifications (...) VALUES (...) RETURNING *`, [...]);
  // await twilioClient.messages.create({...})  // or whichever provider
  return record.rows[0];
}
```

Keep provider credentials in `.env`, never in source.
