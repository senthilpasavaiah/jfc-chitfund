const { query, withTransaction } = require('../config/db');
const ApiError = require('../utils/ApiError');
const notificationService = require('./notification.service');

const CLUB_SLOT_INDEX = 1; // "Member 2" - always Jolly Friends Club
const CLUB_NAME = 'Jolly Friends Club';

// ---------------------------------------------------------------------------
// Pure math helpers - copied exactly from the prototype's own formulas
// (same ones the Chit Calculator page uses), so every number matches.
// ---------------------------------------------------------------------------

function chitCommissionRate(months, rateSchedule) {
  if (rateSchedule === 'standard') return months === 20 ? 1500 : 3000;
  return months === 20 ? 1000 : 2000; // 'jfc' (default)
}

function getChitMonthlyPayings(valueLakh, months, rateSchedule) {
  const cv = valueLakh * 100000;
  const base = cv / months;
  const maxDisc = rateSchedule === 'standard' ? 0.26 : 0.1;
  const result = [];
  for (let i = 1; i <= months; i++) {
    let diff = 0;
    if (i !== 2 && i !== months) {
      const pos = i < 2 ? i : i - 1;
      const frac = 1 - (pos - 1) / (months - 2);
      diff = Math.round((base * maxDisc * Math.max(frac, 0)) / 250) * 250;
    }
    result.push(Math.round(base - diff));
  }
  return result;
}

function chitMonthlyPaymentForRound(chit, monthIndex) {
  const rateSchedule = chit.rate_schedule || 'jfc';
  const payings = getChitMonthlyPayings(chit.value_lakh, chit.total_months, rateSchedule);
  return payings[monthIndex] !== undefined ? payings[monthIndex] : Math.round((chit.value_lakh * 100000) / chit.total_months);
}

function chitPayoutForRound(chit, monthIndex) {
  const rateSchedule = chit.rate_schedule || 'jfc';
  const monthlyPayment = chitMonthlyPaymentForRound(chit, monthIndex);
  const commPerMonth = monthIndex === CLUB_SLOT_INDEX ? 0 : chitCommissionRate(chit.total_months, rateSchedule) * chit.value_lakh;
  return monthlyPayment * chit.total_months - commPerMonth;
}

function chitEndDate(startDate, months) {
  if (!startDate) return null;
  const end = new Date(startDate);
  end.setMonth(end.getMonth() + months);
  end.setDate(end.getDate() - 1);
  return end;
}

function chitMonthsElapsed(startDate, months) {
  if (!startDate) return 0;
  const start = new Date(startDate);
  const today = new Date();
  let n = (today.getFullYear() - start.getFullYear()) * 12 + (today.getMonth() - start.getMonth());
  if (today.getDate() < start.getDate()) n--;
  return Math.max(0, Math.min(months, n));
}

function chitMonthDate(startDate, monthIndex) {
  if (!startDate) return null;
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + monthIndex);
  return d;
}

function chitMonthLabel(startDate, monthIndex) {
  const d = chitMonthDate(startDate, monthIndex);
  if (!d) return `Month ${monthIndex + 1}`;
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

function getChitStatus(startDate, months) {
  const today = new Date().toISOString().slice(0, 10);
  if (!startDate) return 'upcoming';
  const startStr = new Date(startDate).toISOString().slice(0, 10);
  if (startStr > today) return 'upcoming';
  const end = chitEndDate(startDate, months);
  const endStr = end ? end.toISOString().slice(0, 10) : null;
  if (endStr && endStr < today) return 'completed';
  return 'ongoing';
}

function chitCapacity(totalMonths) {
  return totalMonths - 1;
}

// 7 historical (pre-app) chit rounds already exist as "Chit-1".."Chit-7" in
// chit_profit_history - live chits continue that numbering from 8 onward,
// never restart at 1.
const HISTORICAL_CHIT_COUNT = 7;

async function generateChitRef() {
  const year = new Date().getFullYear();
  const { rows } = await query(`SELECT ref_number FROM chits WHERE ref_number LIKE $1`, [`CHIT-${year}-%`]);
  let maxSeq = HISTORICAL_CHIT_COUNT;
  for (const r of rows) {
    const match = r.ref_number.match(/CHIT-\d{4}-(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxSeq) maxSeq = n;
    }
  }
  const seq = String(maxSeq + 1).padStart(3, '0');
  return `CHIT-${year}-${seq}`;
}

async function updateRefNumber(chitId, newRefNumber) {
  const existing = await query('SELECT id FROM chits WHERE ref_number = $1 AND id != $2', [newRefNumber, chitId]);
  if (existing.rows.length) throw ApiError.conflict('That reference number is already in use by another chit.');
  const { rows } = await query('UPDATE chits SET ref_number = $1 WHERE id = $2 RETURNING *', [newRefNumber, chitId]);
  if (!rows[0]) throw ApiError.notFound('Chit not found');
  return serializeChit(rows[0]);
}

function serializeChit(row) {
  const status = getChitStatus(row.start_date, row.total_months);
  return {
    id: row.id,
    refNumber: row.ref_number,
    valueLakh: Number(row.value_lakh),
    totalMonths: row.total_months,
    rateSchedule: row.rate_schedule,
    startDate: row.start_date,
    endDate: chitEndDate(row.start_date, row.total_months),
    status,
    baseMonthly: Math.round((Number(row.value_lakh) * 100000) / row.total_months),
    commissionPerMonth: chitCommissionRate(row.total_months, row.rate_schedule) * Number(row.value_lakh),
    monthsElapsed: chitMonthsElapsed(row.start_date, row.total_months),
    monthsRemaining: row.total_months - chitMonthsElapsed(row.start_date, row.total_months),
    createdAt: row.created_at,
  };
}

async function create({ valueLakh, totalMonths, rateSchedule, startDate }) {
  const refNumber = await generateChitRef();
  const valueLakhCol = Number(valueLakh);
  const { rows } = await query(
    `INSERT INTO chits (ref_number, name, chit_value, value_lakh, total_months, monthly_installment, rate_schedule, start_date, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'ACTIVE') RETURNING *`,
    [
      refNumber,
      refNumber,
      valueLakhCol * 100000,
      valueLakhCol,
      totalMonths,
      Math.round((valueLakhCol * 100000) / totalMonths),
      rateSchedule || 'jfc',
      startDate || new Date(),
    ]
  );
  return serializeChit(rows[0]);
}

/**
 * Returns whether `memberId` currently holds an active slot in `chitId`.
 * Admins/Managers should never be routed through this - they bypass the
 * participant check entirely at the call site.
 */
async function isChitParticipant(chitId, memberId) {
  if (!memberId) return false;
  const { rows } = await query(
    `SELECT 1 FROM chit_members WHERE chit_id = $1 AND member_id = $2 AND is_active = TRUE LIMIT 1`,
    [chitId, memberId]
  );
  return rows.length > 0;
}

/**
 * `viewer` (req.user) is optional so internal/background callers can still
 * get the plain list. When provided, each chit is annotated with whether
 * this viewer participates in it and whether they're allowed to open it -
 * the list itself (which chits show up) is unchanged for everyone, only the
 * per-card `canAccess` flag differs.
 */
async function list({ tab }, viewer) {
  const { rows } = await query(`SELECT * FROM chits ORDER BY created_at DESC`);

  let participantChitIds = null;
  const isPrivileged = viewer && (viewer.role === 'ADMIN' || viewer.role === 'MANAGER');
  if (viewer && !isPrivileged) {
    const { rows: memberRows } = await query(
      `SELECT DISTINCT chit_id FROM chit_members WHERE member_id = $1 AND is_active = TRUE`,
      [viewer.memberId]
    );
    participantChitIds = new Set(memberRows.map((r) => r.chit_id));
  }

  const serialized = rows.map((row) => {
    const chit = serializeChit(row);
    if (!viewer) return chit;
    const isParticipant = isPrivileged ? false : !!participantChitIds?.has(row.id);
    const canAccess = isPrivileged || isParticipant;
    return { ...chit, isParticipant, canAccess };
  });
  if (!tab) return serialized;
  return serialized.filter((c) => c.status === tab);
}

async function getById(chitId) {
  const { rows } = await query(`SELECT * FROM chits WHERE id = $1`, [chitId]);
  if (!rows[0]) throw ApiError.notFound('Chit not found');
  return rows[0];
}

async function deleteChit(chitId) {
  const { rows } = await query(`DELETE FROM chits WHERE id = $1 RETURNING id`, [chitId]);
  if (!rows[0]) throw ApiError.notFound('Chit not found');
}

async function getParticipants(chitId) {
  const { rows } = await query(
    `SELECT cm.*, m.name, m.mobile_number, m.status AS member_status
     FROM chit_members cm JOIN members m ON m.id = cm.member_id
     WHERE cm.chit_id = $1 AND cm.is_active = TRUE
     ORDER BY cm.slot_number`,
    [chitId]
  );
  return rows;
}

async function getSlotArray(chit) {
  const participants = await getParticipants(chit.id);
  const slots = new Array(chit.total_months).fill(null);
  slots[CLUB_SLOT_INDEX] = { slotIndex: CLUB_SLOT_INDEX, memberId: null, name: CLUB_NAME, isClub: true };
  for (const p of participants) {
    slots[p.slot_number] = { slotIndex: p.slot_number, memberId: p.member_id, name: p.name, isClub: false };
  }
  return slots;
}

async function addMembers(chitId, memberIds) {
  const chit = await getById(chitId);
  const capacity = chitCapacity(chit.total_months);
  const participants = await getParticipants(chitId);
  const filled = participants.length;
  const remaining = capacity - filled;
  if (memberIds.length === 0) throw ApiError.badRequest('Select at least one member to add.');
  if (memberIds.length > remaining) {
    throw ApiError.badRequest(`Only ${remaining} slot${remaining !== 1 ? 's' : ''} left in this chit.`);
  }

  // A member CAN take more than one slot in the same chit (multiple
  // "shares") - so memberIds may legitimately contain the same id more than
  // once, and we don't skip repeats here.
  const occupiedSlots = new Set(participants.map((p) => p.slot_number));
  occupiedSlots.add(CLUB_SLOT_INDEX);

  return withTransaction(async (client) => {
    for (const memberId of memberIds) {
      let freeSlot = null;
      for (let i = 0; i < chit.total_months; i++) {
        if (!occupiedSlots.has(i)) {
          freeSlot = i;
          break;
        }
      }
      if (freeSlot === null) break;
      occupiedSlots.add(freeSlot);
      await client.query(
        `INSERT INTO chit_members (chit_id, member_id, slot_number) VALUES ($1,$2,$3)`,
        [chitId, memberId, freeSlot]
      );
    }
  });
}

async function removeMember(chitId, slotIndex) {
  if (slotIndex === CLUB_SLOT_INDEX) throw ApiError.badRequest("The club's reserved slot can't be removed.");
  await query(`DELETE FROM chit_members WHERE chit_id = $1 AND slot_number = $2`, [chitId, slotIndex]);
}

async function joinChit(chitId, memberId) {
  const chit = await getById(chitId);
  const participants = await getParticipants(chitId);
  const capacity = chitCapacity(chit.total_months);
  if (participants.length >= capacity) throw ApiError.badRequest('This chit is already full.');
  // A member can hold more than one slot - no "already joined" block here.

  const occupied = new Set(participants.map((p) => p.slot_number));
  occupied.add(CLUB_SLOT_INDEX);
  let freeSlot = null;
  for (let i = 0; i < chit.total_months; i++) {
    if (!occupied.has(i)) {
      freeSlot = i;
      break;
    }
  }
  if (freeSlot === null) throw ApiError.badRequest('This chit is already full.');
  await query(
    `INSERT INTO chit_members (chit_id, member_id, slot_number) VALUES ($1,$2,$3)`,
    [chitId, memberId, freeSlot]
  );
}

/** Leaves one specific slot - a member holding multiple slots keeps their others. */
async function leaveChit(chitId, memberId, slotIndex) {
  if (slotIndex !== undefined && slotIndex !== null) {
    await query(`DELETE FROM chit_members WHERE chit_id = $1 AND member_id = $2 AND slot_number = $3`, [chitId, memberId, slotIndex]);
    return;
  }
  // No slot specified - if they only hold one slot, remove that one; if they
  // hold several, refuse rather than guessing which one to drop.
  const { rows } = await query(`SELECT slot_number FROM chit_members WHERE chit_id = $1 AND member_id = $2`, [chitId, memberId]);
  if (rows.length === 0) return;
  if (rows.length > 1) {
    throw ApiError.badRequest('You hold more than one slot in this chit - specify which slot to leave.');
  }
  await query(`DELETE FROM chit_members WHERE chit_id = $1 AND member_id = $2 AND slot_number = $3`, [chitId, memberId, rows[0].slot_number]);
}

async function ensureMonthData(chit) {
  const { rows: existing } = await query(`SELECT * FROM chit_month_data WHERE chit_id = $1`, [chit.id]);
  const byIndex = new Map(existing.map((r) => [r.month_index, r]));

  for (let i = 0; i < chit.total_months; i++) {
    if (!byIndex.has(i)) {
      const { rows } = await query(
        `INSERT INTO chit_month_data (chit_id, month_index) VALUES ($1,$2) RETURNING *`,
        [chit.id, i]
      );
      byIndex.set(i, rows[0]);
    }
  }
  return byIndex;
}

async function getMemberName(memberId) {
  if (!memberId) return null;
  const { rows } = await query('SELECT name FROM members WHERE id = $1', [memberId]);
  return rows[0]?.name || null;
}

async function getMonthTimeline(chit) {
  const monthDataByIndex = await ensureMonthData(chit);
  const capacity = chitCapacity(chit.total_months);

  const timeline = [];
  for (let i = 0; i < chit.total_months; i++) {
    const md = monthDataByIndex.get(i);
    const isClub = i === CLUB_SLOT_INDEX;

    const paymentsResult = await query(
      `SELECT paid FROM chit_month_payments WHERE chit_month_data_id = $1`,
      [md.id]
    );
    const paidCount = paymentsResult.rows.filter((p) => p.paid).length;

    timeline.push({
      monthIndex: i,
      label: chitMonthLabel(chit.start_date, i),
      drawnBy: isClub ? CLUB_NAME : md.drawn_by_member_id ? await getMemberName(md.drawn_by_member_id) : null,
      drawnByMemberId: isClub ? null : md.drawn_by_member_id,
      shuffled: isClub ? true : md.shuffled,
      paidCount,
      capacity,
    });
  }
  return timeline;
}

async function getMonthDetail(chit, monthIndex) {
  const monthDataByIndex = await ensureMonthData(chit);
  const md = monthDataByIndex.get(monthIndex);
  const slots = await getSlotArray(chit);
  const isClub = monthIndex === CLUB_SLOT_INDEX;

  const paymentsResult = await query(
    `SELECT member_id, paid FROM chit_month_payments WHERE chit_month_data_id = $1`,
    [md.id]
  );
  const paidByMember = new Map(paymentsResult.rows.map((p) => [p.member_id, p.paid]));

  const requestsResult = await query(
    `SELECT r.member_id, r.type, m.name FROM chit_month_requests r
     JOIN members m ON m.id = r.member_id WHERE r.chit_month_data_id = $1`,
    [md.id]
  );

  const participantSlots = slots.filter((s, idx) => s && !s.isClub && idx !== CLUB_SLOT_INDEX);

  const participants = participantSlots.map((s) => ({
    memberId: s.memberId,
    name: s.name,
    paid: !!paidByMember.get(s.memberId),
    isDrawer: md.drawn_by_member_id === s.memberId,
  }));

  return {
    monthIndex,
    label: chitMonthLabel(chit.start_date, monthIndex),
    isClub,
    // Lets the frontend grey out Assign/Shuffle for past and future months
    // without guessing - it's the same "current month" rule the backend
    // enforces in assignDraw/performShuffle, exposed here so the UI can
    // match it instead of drifting out of sync.
    isCurrentMonth: monthIndex === chitMonthsElapsed(chit.start_date, chit.total_months),
    drawnByName: isClub ? CLUB_NAME : md.drawn_by_member_id ? await getMemberName(md.drawn_by_member_id) : null,
    drawnByMemberId: isClub ? null : md.drawn_by_member_id,
    shuffled: isClub ? true : md.shuffled,
    participants,
    requests: requestsResult.rows.map((r) => ({ memberId: r.member_id, name: r.name, type: r.type })),
    monthlyPayment: chitMonthlyPaymentForRound(chit, monthIndex),
    payout: chitPayoutForRound(chit, monthIndex),
  };
}

async function togglePaid(chitId, monthIndex, memberId) {
  const chit = await getById(chitId);
  const monthDataByIndex = await ensureMonthData(chit);
  const md = monthDataByIndex.get(monthIndex);

  const { rows } = await query(
    `SELECT paid FROM chit_month_payments WHERE chit_month_data_id = $1 AND member_id = $2`,
    [md.id, memberId]
  );
  const current = rows[0]?.paid || false;
  await query(
    `INSERT INTO chit_month_payments (chit_month_data_id, member_id, paid) VALUES ($1,$2,$3)
     ON CONFLICT (chit_month_data_id, member_id) DO UPDATE SET paid = $3`,
    [md.id, memberId, !current]
  );
}

async function payForMonth(chitId, monthIndex, memberId) {
  const chit = await getById(chitId);
  const monthDataByIndex = await ensureMonthData(chit);
  const md = monthDataByIndex.get(monthIndex);
  await query(
    `INSERT INTO chit_month_payments (chit_month_data_id, member_id, paid) VALUES ($1,$2,TRUE)
     ON CONFLICT (chit_month_data_id, member_id) DO UPDATE SET paid = TRUE`,
    [md.id, memberId]
  );
}

/**
 * Marks every real participant of THIS chit as Paid for THIS month only.
 * "Real participant" = a row in chit_members - the Jolly Friends Club slot
 * is never a row there (it's a fixed, synthetic slot handled separately by
 * getSlotArray/getMonthDetail), so it's excluded automatically and no fake
 * payment record is ever created for it. Already-paid members are simply
 * re-affirmed as paid (ON CONFLICT ... DO UPDATE), so this never creates a
 * duplicate row and is safe to call more than once.
 */
async function markAllPaidForMonth(chitId, monthIndex) {
  const chit = await getById(chitId);
  const monthDataByIndex = await ensureMonthData(chit);
  const md = monthDataByIndex.get(monthIndex);
  const participants = await getParticipants(chitId);

  await withTransaction(async (client) => {
    for (const p of participants) {
      await client.query(
        `INSERT INTO chit_month_payments (chit_month_data_id, member_id, paid) VALUES ($1,$2,TRUE)
         ON CONFLICT (chit_month_data_id, member_id) DO UPDATE SET paid = TRUE`,
        [md.id, p.member_id]
      );
    }
  });

  return { monthIndex, markedCount: participants.length };
}

async function assignDraw(chitId, monthIndex, memberId, actingUserId) {
  if (monthIndex === CLUB_SLOT_INDEX) {
    throw ApiError.badRequest("Month 2 is always reserved for Jolly Friends Club - it can't be reassigned.");
  }
  const chit = await getById(chitId);
  const elapsed = chitMonthsElapsed(chit.start_date, chit.total_months);
  // Same "only the current month is actionable" rule as shuffle: past
  // months are already settled and locked, future months haven't opened
  // yet. Bug fix: this check didn't exist before, so a drawer could be
  // (re)assigned for any past or future month via direct API calls.
  if (monthIndex !== elapsed) {
    throw ApiError.badRequest(
      monthIndex < elapsed
        ? 'This month has already passed - drawer assignment is locked.'
        : 'Drawer assignment only opens once this becomes the current month.'
    );
  }
  const monthDataByIndex = await ensureMonthData(chit);
  const md = monthDataByIndex.get(monthIndex);
  if (md.shuffled) {
    throw ApiError.badRequest("This month was already decided by shuffle - the result is final and can't be changed.");
  }
  // Bug fix: previously only `shuffled` was checked here, so a month that
  // already had a manually-assigned drawer could silently be reassigned to
  // someone else. Once a drawer exists for a month (by any method), Assign
  // is locked for that month.
  if (md.drawn_by_member_id) {
    throw ApiError.badRequest('A drawer has already been assigned for this month.');
  }
  await query(`UPDATE chit_month_data SET drawn_by_member_id = $1 WHERE id = $2`, [memberId || null, md.id]);

  if (memberId) {
    const winnerName = await getMemberName(memberId);
    const monthLabel = chitMonthLabel(chit.start_date, monthIndex);
    await notificationService.dispatch({
      memberId,
      channel: 'WHATSAPP',
      type: 'AUCTION_WON',
      subject: 'You were assigned this month\'s draw',
      body: `${winnerName} was assigned as the drawer for ${chit.ref_number} - ${monthLabel}.`,
      createdById: actingUserId,
    });
  }
}

async function submitRequest(chitId, monthIndex, memberId, type) {
  if (monthIndex === CLUB_SLOT_INDEX) return;
  const chit = await getById(chitId);
  const monthDataByIndex = await ensureMonthData(chit);
  const md = monthDataByIndex.get(monthIndex);
  await query(
    `INSERT INTO chit_month_requests (chit_month_data_id, member_id, type) VALUES ($1,$2,$3)
     ON CONFLICT (chit_month_data_id, member_id) DO UPDATE SET type = $3`,
    [md.id, memberId, type]
  );
}

async function cancelRequest(chitId, monthIndex, memberId) {
  const chit = await getById(chitId);
  const monthDataByIndex = await ensureMonthData(chit);
  const md = monthDataByIndex.get(monthIndex);
  await query(`DELETE FROM chit_month_requests WHERE chit_month_data_id = $1 AND member_id = $2`, [md.id, memberId]);
}

async function performShuffle(chitId, monthIndex, memberIds, actingUserId) {
  if (monthIndex === CLUB_SLOT_INDEX) {
    throw ApiError.badRequest("Month 2 is reserved for Jolly Friends Club - shuffling isn't needed for it.");
  }
  const chit = await getById(chitId);
  const elapsed = chitMonthsElapsed(chit.start_date, chit.total_months);
  // Bug fix: this used to be `monthIndex > elapsed`, which correctly kept
  // future months locked but let PAST months be shuffled too (elapsed is
  // the current month's index, so anything strictly less than it is
  // already completed and must be locked, same as Assign).
  if (monthIndex !== elapsed) {
    throw ApiError.badRequest(
      monthIndex < elapsed
        ? 'This month has already passed - shuffling is locked.'
        : 'Shuffling only opens once this becomes the current month.'
    );
  }
  const monthDataByIndex = await ensureMonthData(chit);
  const md = monthDataByIndex.get(monthIndex);
  if (md.shuffled) {
    throw ApiError.badRequest('Shuffle has already been used for this month.');
  }
  // Bug fix: a month that already has a manually-assigned drawer could
  // previously be overwritten by shuffle since only `shuffled` was checked.
  if (md.drawn_by_member_id) {
    throw ApiError.badRequest('A drawer has already been assigned for this month - shuffle is locked.');
  }
  if (!memberIds || memberIds.length === 0) {
    throw ApiError.badRequest('Select at least one participant to include in the shuffle.');
  }

  const winnerId = memberIds[Math.floor(Math.random() * memberIds.length)];
  await query(`UPDATE chit_month_data SET drawn_by_member_id = $1, shuffled = TRUE WHERE id = $2`, [winnerId, md.id]);
  const winnerName = await getMemberName(winnerId);

  const monthLabel = chitMonthLabel(chit.start_date, monthIndex);
  await notificationService.dispatch({
    memberId: winnerId,
    channel: 'WHATSAPP',
    type: 'AUCTION_WON',
    subject: 'You won this month\'s shuffle!',
    body: `${winnerName} was picked by shuffle for ${chit.ref_number} - ${monthLabel}.`,
    createdById: actingUserId,
  });

  return { winnerId, winnerName };
}

async function syncAccounting(chitId) {
  const chit = await getById(chitId);
  const elapsed = chitMonthsElapsed(chit.start_date, chit.total_months);
  const monthDataByIndex = await ensureMonthData(chit);
  const rateSchedule = chit.rate_schedule || 'jfc';

  for (let i = 0; i <= elapsed && i < chit.total_months; i++) {
    const md = monthDataByIndex.get(i);
    if (md.accounted) continue;

    const entryDate = chitMonthDate(chit.start_date, i);
    const monthLabel = chitMonthLabel(chit.start_date, i);
    const commission = i === CLUB_SLOT_INDEX ? 0 : chitCommissionRate(chit.total_months, rateSchedule) * Number(chit.value_lakh);

    if (commission > 0) {
      await query(
        `INSERT INTO chit_auto_ledger (chit_id, month_index, month_label, entry_date, type, category, amount)
         VALUES ($1,$2,$3,$4,'income','Commission',$5)`,
        [chitId, i, monthLabel, entryDate, commission]
      );
    }
    if (i === CLUB_SLOT_INDEX) {
      const payout = chitPayoutForRound(chit, i);
      await query(
        `INSERT INTO chit_auto_ledger (chit_id, month_index, month_label, entry_date, type, category, amount)
         VALUES ($1,$2,$3,$4,'income','Club Payout (Month 2)',$5)`,
        [chitId, i, monthLabel, entryDate, payout]
      );
    }
    const myShare = chitMonthlyPaymentForRound(chit, i);
    await query(
      `INSERT INTO chit_auto_ledger (chit_id, month_index, month_label, entry_date, type, category, amount)
       VALUES ($1,$2,$3,$4,'expense','Club Contribution (as participant)',$5)`,
      [chitId, i, monthLabel, entryDate, myShare]
    );

    await query(`UPDATE chit_month_data SET accounted = TRUE WHERE id = $1`, [md.id]);
  }
}

async function getLedger(chitId) {
  await syncAccounting(chitId);
  const { rows } = await query(
    `SELECT * FROM chit_auto_ledger WHERE chit_id = $1 ORDER BY entry_date ASC, created_at ASC`,
    [chitId]
  );
  const income = rows.filter((r) => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0);
  const expense = rows.filter((r) => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0);
  return { entries: rows, income, expense, balance: income - expense };
}

async function getDetail(chitId, viewer) {
  const chitRow = await getById(chitId);
  const chit = serializeChit(chitRow);
  const slots = await getSlotArray(chitRow);
  const timeline = await getMonthTimeline(chitRow);
  const capacity = chitCapacity(chitRow.total_months);
  const filled = slots.filter((s) => s && !s.isClub).length;

  const isParticipant = viewer && viewer.memberId && slots.some((s) => s && s.memberId === viewer.memberId);

  return {
    ...chit,
    capacity,
    filled,
    isFull: filled >= capacity,
    isParticipant: !!isParticipant,
    participants: slots.map((s, i) => (s ? { slotIndex: i, memberId: s.memberId, name: s.name, isClub: s.isClub } : { slotIndex: i, memberId: null, name: null, isClub: false })),
    timeline,
  };
}


/**
 * Confirmed chit-fund collections across all live chits - shared by the
 * Dashboard and Reports pages so "how much has actually been collected"
 * includes real chit payments, not just the legacy classic-chit `payments`
 * table. Each paid chit_month_payments row's amount is derived from the
 * same declining-schedule formula the Calculator/chit engine itself uses.
 */
async function getConfirmedChitCollections({ from, to } = {}) {
  const { rows: paidRows } = await query(
    `SELECT cmp.member_id, cmd.month_index, cmd.chit_id, c.ref_number, c.value_lakh, c.total_months, c.rate_schedule, c.start_date,
            m.name AS member_name, m.mobile_number
     FROM chit_month_payments cmp
     JOIN chit_month_data cmd ON cmd.id = cmp.chit_month_data_id
     JOIN chits c ON c.id = cmd.chit_id
     JOIN members m ON m.id = cmp.member_id
     WHERE cmp.paid = TRUE`
  );

  const rangeStart = from ? new Date(from) : null;
  const rangeEnd = to ? new Date(to) : null;

  let total = 0;
  let count = 0;
  const byMonth = new Map();
  const byChit = new Map();
  const byMember = new Map();

  for (const row of paidRows) {
    const chit = { value_lakh: row.value_lakh, total_months: row.total_months, rate_schedule: row.rate_schedule };
    const amount = chitMonthlyPaymentForRound(chit, row.month_index);
    const paidMonthDate = chitMonthDate(row.start_date, row.month_index);

    if (rangeStart && paidMonthDate < rangeStart) continue;
    if (rangeEnd && paidMonthDate > rangeEnd) continue;

    total += amount;
    count += 1;

    const monthKey = paidMonthDate ? `${paidMonthDate.getFullYear()}-${String(paidMonthDate.getMonth() + 1).padStart(2, '0')}` : 'unknown';
    byMonth.set(monthKey, (byMonth.get(monthKey) || 0) + amount);

    const chitEntry = byChit.get(row.chit_id) || { refNumber: row.ref_number, collected: 0, paymentCount: 0 };
    chitEntry.collected += amount;
    chitEntry.paymentCount += 1;
    byChit.set(row.chit_id, chitEntry);

    const memberEntry = byMember.get(row.member_id) || { name: row.member_name, mobileNumber: row.mobile_number, totalPaid: 0, paymentCount: 0 };
    memberEntry.totalPaid += amount;
    memberEntry.paymentCount += 1;
    byMember.set(row.member_id, memberEntry);
  }

  return {
    total,
    count,
    byMonth: Array.from(byMonth.entries()).map(([month, collected]) => ({ month, collected })),
    byChit: Array.from(byChit.entries()).map(([id, v]) => ({ id, ...v })),
    byMember: Array.from(byMember.entries()).map(([id, v]) => ({ id, ...v })),
  };
}

module.exports = {
  chitMonthlyPaymentForRound,
  getConfirmedChitCollections,
  updateRefNumber,
  syncAccounting,
  CLUB_SLOT_INDEX,
  CLUB_NAME,
  create,
  list,
  getById,
  deleteChit,
  getDetail,
  isChitParticipant,
  addMembers,
  removeMember,
  joinChit,
  leaveChit,
  getMonthDetail,
  togglePaid,
  payForMonth,
  markAllPaidForMonth,
  assignDraw,
  submitRequest,
  cancelRequest,
  performShuffle,
  getLedger,
  chitCapacity,
  getChitStatus,
};
