const { query, withTransaction } = require('../config/db');
const ApiError = require('../utils/ApiError');
const { encryptField, maskAadhaar } = require('../utils/crypto');

/**
 * Serializes a member row for the API response.
 *
 * `viewer` restricts what's visible, matching the prototype's own rule:
 * non-admin/manager viewers only see full details (phone, real Aadhaar
 * last-4) on their OWN record; every other member's row is fully masked
 * and has no phone number at all. This is enforced here (not just in the
 * frontend) since the data itself is sensitive.
 */
function serialize(row, viewer) {
  if (!row) return null;
  const isPrivileged = viewer && (viewer.role === 'ADMIN' || viewer.role === 'MANAGER');
  const isOwnRecord = viewer && viewer.memberId === row.id;
  const canSeeFull = !viewer || isPrivileged || isOwnRecord;

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    photoUrl: row.photo_url,
    mobileNumber: isPrivileged || isOwnRecord ? row.mobile_number : null,
    whatsappNumber: isPrivileged || isOwnRecord ? row.whatsapp_number : null,
    email: canSeeFull ? row.email : null,
    permanentAddress: canSeeFull ? row.permanent_address : null,
    currentAddress: canSeeFull ? row.current_address : null,
    aadhaarMasked: canSeeFull ? maskAadhaar(row.aadhaar_last4) : 'XXXX XXXX XXXX',
    status: row.status,
    joinedDate: row.joined_date,
    notes: canSeeFull ? row.notes : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function create(input) {
  const { name, mobileNumber, whatsappNumber, email, aadhaarNumber, permanentAddress, currentAddress, notes } = input;

  const existing = await query('SELECT id FROM members WHERE mobile_number = $1', [mobileNumber]);
  if (existing.rows.length) throw ApiError.conflict('A member with this mobile number already exists');

  if (aadhaarNumber) {
    const dupCheck = await query('SELECT id FROM members WHERE aadhaar_last4 = $1 AND status = \'ACTIVE\'', [aadhaarNumber.slice(-4)]);
    if (dupCheck.rows.length) {
      throw ApiError.conflict(
        'Another active member already shares these last-4 Aadhaar digits. Aadhaar-based login requires the last 4 digits to be unique among active members.'
      );
    }
  }

  const aadhaarEncrypted = aadhaarNumber ? encryptField(aadhaarNumber) : null;
  const aadhaarLast4 = aadhaarNumber ? aadhaarNumber.slice(-4) : null;

  return withTransaction(async (client) => {
    // Every member gets a linked login account up front (no password yet -
    // they set one themselves on first login via their Aadhaar last-4).
    const userResult = await client.query(
      `INSERT INTO users (phone, email, role) VALUES ($1, $2, 'MEMBER') RETURNING id`,
      [mobileNumber, email || null]
    );
    const userId = userResult.rows[0].id;

    const { rows } = await client.query(
      `INSERT INTO members
        (user_id, name, mobile_number, whatsapp_number, email, aadhaar_encrypted, aadhaar_last4, permanent_address, current_address, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [userId, name, mobileNumber, whatsappNumber || mobileNumber, email || null, aadhaarEncrypted, aadhaarLast4, permanentAddress || null, currentAddress || null, notes || null]
    );
    return serialize(rows[0]);
  });
}

async function list({ status, search, page = 1, pageSize = 20 } = {}, viewer) {
  const conditions = [];
  const params = [];

  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(name ILIKE $${params.length} OR mobile_number ILIKE $${params.length})`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await query(`SELECT COUNT(*)::int AS count FROM members ${where}`, params);
  const total = countResult.rows[0].count;

  const offset = (page - 1) * pageSize;
  params.push(pageSize, offset);
  const { rows } = await query(
    `SELECT * FROM members ${where} ORDER BY name ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return {
    data: rows.map((r) => serialize(r, viewer)),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

async function getById(id, viewer) {
  const { rows } = await query('SELECT * FROM members WHERE id = $1', [id]);
  if (!rows[0]) throw ApiError.notFound('Member not found');
  return serialize(rows[0], viewer);
}

async function update(id, input) {
  const existing = await query('SELECT * FROM members WHERE id = $1', [id]);
  if (!existing.rows[0]) throw ApiError.notFound('Member not found');

  const fields = [];
  const params = [];
  const map = {
    name: 'name',
    mobileNumber: 'mobile_number',
    whatsappNumber: 'whatsapp_number',
    email: 'email',
    permanentAddress: 'permanent_address',
    currentAddress: 'current_address',
    status: 'status',
    notes: 'notes',
  };

  for (const [key, column] of Object.entries(map)) {
    if (input[key] !== undefined) {
      params.push(input[key]);
      fields.push(`${column} = $${params.length}`);
    }
  }

  if (input.aadhaarNumber) {
    params.push(encryptField(input.aadhaarNumber));
    fields.push(`aadhaar_encrypted = $${params.length}`);
    params.push(input.aadhaarNumber.slice(-4));
    fields.push(`aadhaar_last4 = $${params.length}`);
  }

  if (!fields.length) return serialize(existing.rows[0]);

  fields.push(`updated_at = now()`);
  params.push(id);
  const { rows } = await query(
    `UPDATE members SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING *`,
    params
  );
  return serialize(rows[0]);
}

async function remove(id) {
  // Soft delete: chit fund records must be retained for financial/audit
  // history, so members are deactivated rather than hard-deleted.
  const { rows } = await query(
    `UPDATE members SET status = 'INACTIVE', updated_at = now() WHERE id = $1 RETURNING id`,
    [id]
  );
  if (!rows[0]) throw ApiError.notFound('Member not found');
}

async function paymentHistory(memberId) {
  const { rows } = await query(
    `SELECT p.*, i.month_number, i.chit_id, c.name AS chit_name
     FROM payments p
     JOIN installments i ON i.id = p.installment_id
     JOIN chits c ON c.id = i.chit_id
     WHERE p.member_id = $1
     ORDER BY p.paid_at DESC`,
    [memberId]
  );
  return rows;
}

module.exports = { create, list, getById, update, remove, paymentHistory, serialize };
