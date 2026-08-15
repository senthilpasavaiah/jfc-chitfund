const { query, withTransaction } = require('../config/db');
const ApiError = require('../utils/ApiError');

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

async function generateChitRef() {
  const year = new Date().getFullYear();
  const { rows } = await query(`SELECT COUNT(*)::int AS count FROM chits WHERE ref_number LIKE $1`, [`CHIT-${year}-%`]);
  const seq = String(rows[0].count + 1).padStart(3, '0');
  return `CHIT-${year}-${seq}`;
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

async function list({ tab }) {
  const { rows } = await query(`SELECT * FROM chits ORDER BY created_at DESC`);
  const serialized = rows.map(serializeChit);
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

  const existingMemberIds = new Set(participants.map((p) => p.member_id));
  const occupiedSlots = new Set(participants.map((p) => p.slot_number));
  occupiedSlots.add(CLUB_SLOT_INDEX);

  return withTransaction(async (client) => {
    for (const memberId of memberIds) {
      if (existingMemberIds.has(memberId)) continue;
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
        `INSERT INTO chit_members (chit_id, member_id, slot_number) VALUES ($1,$2,$3)
         ON CONFLICT (chit_id, member_id) DO UPDATE SET is_active = TRUE, slot_number = $3`,
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
  if (participants.some((p) => p.member_id === memberId)) return;

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
    `INSERT INTO chit_members (chit_id, member_id, slot_number) VALUES ($1,$2,$3)
     ON CONFLICT (chit_id, member_id) DO UPDATE SET is_active = TRUE, slot_number = $3`,
    [chitId, memberId, freeSlot]
  );
}

async function leaveChit(chitId, memberId) {
  await query(`DELETE FROM chit_members WHERE chit_id = $1 AND member_id = $2`, [chitId, memberId]);
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

async function assignDraw(chitId, monthIndex, memberId) {
  if (monthIndex === CLUB_SLOT_INDEX) {
    throw ApiError.badRequest("Month 2 is always reserved for Jolly Friends Club - it can't be reassigned.");
  }
  const chit = await getById(chitId);
  const monthDataByIndex = await ensureMonthData(chit);
  const md = monthDataByIndex.get(monthIndex);
  if (md.shuffled) {
    throw ApiError.badRequest("This month was already decided by shuffle - the result is final and can't be changed.");
  }
  await query(`UPDATE chit_month_data SET drawn_by_member_id = $1 WHERE id = $2`, [memberId || null, md.id]);
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

async function performShuffle(chitId, monthIndex, memberIds) {
  if (monthIndex === CLUB_SLOT_INDEX) {
    throw ApiError.badRequest("Month 2 is reserved for Jolly Friends Club - shuffling isn't needed for it.");
  }
  const chit = await getById(chitId);
  const elapsed = chitMonthsElapsed(chit.start_date, chit.total_months);
  if (monthIndex > elapsed) {
    throw ApiError.badRequest('Shuffling only opens once this becomes the current month.');
  }
  const monthDataByIndex = await ensureMonthData(chit);
  const md = monthDataByIndex.get(monthIndex);
  if (md.shuffled) {
    throw ApiError.badRequest('Shuffle has already been used for this month.');
  }
  if (!memberIds || memberIds.length === 0) {
    throw ApiError.badRequest('Select at least one participant to include in the shuffle.');
  }

  const winnerId = memberIds[Math.floor(Math.random() * memberIds.length)];
  await query(`UPDATE chit_month_data SET drawn_by_member_id = $1, shuffled = TRUE WHERE id = $2`, [winnerId, md.id]);
  const winnerName = await getMemberName(winnerId);
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

module.exports = {
  CLUB_SLOT_INDEX,
  CLUB_NAME,
  create,
  list,
  getById,
  deleteChit,
  getDetail,
  addMembers,
  removeMember,
  joinChit,
  leaveChit,
  getMonthDetail,
  togglePaid,
  payForMonth,
  assignDraw,
  submitRequest,
  cancelRequest,
  performShuffle,
  getLedger,
  chitCapacity,
  getChitStatus,
};
