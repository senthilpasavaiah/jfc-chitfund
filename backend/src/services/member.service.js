const { query, withTransaction } = require('../config/db');
const ApiError = require('../utils/ApiError');
const { encryptField, maskAadhaar } = require('../utils/crypto');

function serialize(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    photoUrl: row.photo_url,
    mobileNumber: row.mobile_number,
    whatsappNumber: row.whatsapp_number,
    email: row.email,
    permanentAddress: row.permanent_address,
    currentAddress: row.current_address,
    aadhaarMasked: maskAadhaar(row.aadhaar_last4),
    status: row.status,
    joinedDate: row.joined_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function create(input) {
  const { name, mobileNumber, whatsappNumber, email, aadhaarNumber, permanentAddress, currentAddress, notes } = input;

  const existing = await query('SELECT id FROM members WHERE mobile_number = $1', [mobileNumber]);
  if (existing.rows.length) throw ApiError.conflict('A member with this mobile number already exists');

  const aadhaarEncrypted = aadhaarNumber ? encryptField(aadhaarNumber) : null;
  const aadhaarLast4 = aadhaarNumber ? aadhaarNumber.slice(-4) : null;

  const { rows } = await query(
    `INSERT INTO members
      (name, mobile_number, whatsapp_number, email, aadhaar_encrypted, aadhaar_last4, permanent_address, current_address, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [name, mobileNumber, whatsappNumber || mobileNumber, email || null, aadhaarEncrypted, aadhaarLast4, permanentAddress || null, currentAddress || null, notes || null]
  );
  return serialize(rows[0]);
}

async function list({ status, search, page = 1, pageSize = 20 } = {}) {
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
    data: rows.map(serialize),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

async function getById(id) {
  const { rows } = await query('SELECT * FROM members WHERE id = $1', [id]);
  if (!rows[0]) throw ApiError.notFound('Member not found');
  return serialize(rows[0]);
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
