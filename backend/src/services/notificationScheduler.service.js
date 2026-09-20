const { query } = require('../config/db');
const notificationService = require('./notification.service');
const chitService = require('./chit.service');

const IST_TIME_ZONE = 'Asia/Kolkata';
const REMINDER_START_DAY = 1;
const REMINDER_END_DAY = 15;

function istDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type)?.value || 0);
  return { year: get('year'), month: get('month'), day: get('day') };
}

function currentMonthIndex(startDate, now = new Date()) {
  if (!startDate) return null;
  const start = new Date(startDate);
  const today = istDateParts(now);
  const startIst = istDateParts(start);
  if (
    today.year < startIst.year ||
    (today.year === startIst.year && today.month < startIst.month) ||
    (today.year === startIst.year && today.month === startIst.month && today.day < startIst.day)
  ) return null;
  let index = (today.year - startIst.year) * 12 + (today.month - startIst.month);
  if (today.day < startIst.day) index -= 1;
  return Math.max(0, index);
}

async function getSystemAdminId() {
  const { rows } = await query(
    `SELECT id FROM users WHERE role = 'ADMIN' AND is_active = TRUE ORDER BY created_at ASC LIMIT 1`
  );
  return rows[0]?.id || null;
}

async function ensureMonthData(chitId, monthIndex) {
  const { rows } = await query(
    `INSERT INTO chit_month_data (chit_id, month_index)
     VALUES ($1, $2)
     ON CONFLICT (chit_id, month_index) DO UPDATE SET month_index = EXCLUDED.month_index
     RETURNING id`,
    [chitId, monthIndex]
  );
  return rows[0].id;
}

/**
 * Sends the current-month payment reminder during the 1st-15th window.
 * A reminder is generated at most once per member/chit/day and automatically
 * stops on subsequent runs as soon as that month's payment is marked paid.
 * The channel remains WHATSAPP internally so the same notification records can
 * later be handed to the real WhatsApp provider; the current UI renders it as Portal.
 */
async function runPaymentReminders(now = new Date()) {
  const today = istDateParts(now);
  if (today.day < REMINDER_START_DAY || today.day > REMINDER_END_DAY) {
    return { skipped: true, reason: 'outside-reminder-window', sent: 0 };
  }

  const adminId = await getSystemAdminId();
  if (!adminId) return { skipped: true, reason: 'no-active-admin', sent: 0 };

  const { rows: chits } = await query(
    `SELECT id, ref_number, name, value_lakh, total_months, rate_schedule, start_date
     FROM chits
     WHERE status = 'ACTIVE' AND start_date IS NOT NULL
     ORDER BY ref_number`
  );

  let sent = 0;
  for (const chit of chits) {
    const monthIndex = currentMonthIndex(chit.start_date, now);
    if (monthIndex === null || monthIndex < 0 || monthIndex >= Number(chit.total_months)) continue;

    const monthDataId = await ensureMonthData(chit.id, monthIndex);
    const monthLabel = new Date(new Date(chit.start_date).setMonth(new Date(chit.start_date).getMonth() + monthIndex))
      .toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: IST_TIME_ZONE });
    const expected = chitService.chitMonthlyPaymentForRound(chit, monthIndex);

    const { rows: participants } = await query(
      `SELECT cm.member_id, m.name, m.whatsapp_number, m.mobile_number,
              COALESCE(cmp.paid, FALSE) AS paid
       FROM chit_members cm
       JOIN members m ON m.id = cm.member_id
       LEFT JOIN chit_month_payments cmp
         ON cmp.chit_month_data_id = $1 AND cmp.member_id = cm.member_id
       WHERE cm.chit_id = $2 AND cm.is_active = TRUE
       ORDER BY m.name`,
      [monthDataId, chit.id]
    );

    for (const member of participants) {
      if (member.paid) continue;

      const subject = `${chit.ref_number} - ${monthLabel} payment reminder`;
      const { rows: alreadySent } = await query(
        `SELECT 1
         FROM notifications
         WHERE member_id = $1
           AND type = 'PAYMENT_REMINDER'
           AND subject = $2
           AND created_at >= ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date AT TIME ZONE 'Asia/Kolkata')
           AND created_at < (((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date + INTERVAL '1 day') AT TIME ZONE 'Asia/Kolkata')
         LIMIT 1`,
        [member.member_id, subject]
      );
      if (alreadySent.length) continue;

      await notificationService.dispatch({
        memberId: member.member_id,
        channel: 'WHATSAPP',
        type: 'PAYMENT_REMINDER',
        subject,
        body: `Your ${monthLabel} payment for ${chit.ref_number} is pending. Expected amount: ₹${Number(expected).toLocaleString('en-IN')}. Please complete the payment by the 15th. Once your payment is recorded, no further reminder will be generated for this month.`,
        createdById: adminId,
      });
      sent += 1;
    }
  }

  return { skipped: false, sent };
}

function start() {
  const run = () => runPaymentReminders().catch((error) => {
    console.error('[notification-scheduler] payment reminder failed:', error.message);
  });

  // Run shortly after server startup, then periodically. Duplicate protection
  // is database-backed, so repeated scheduler ticks cannot create same-day duplicates.
  setTimeout(run, 5000);
  const interval = setInterval(run, 6 * 60 * 60 * 1000);
  return () => clearInterval(interval);
}

module.exports = { runPaymentReminders, start };
