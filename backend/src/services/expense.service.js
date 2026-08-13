const { query } = require('../config/db');
const ApiError = require('../utils/ApiError');

async function create({ category, description, amount, spentAt }, recordedById) {
  const { rows } = await query(
    `INSERT INTO expenses (category, description, amount, spent_at, recorded_by_id)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [category, description, amount, spentAt || new Date(), recordedById]
  );
  return rows[0];
}

async function list({ category, from, to } = {}) {
  const conditions = [];
  const params = [];
  if (category) {
    params.push(category);
    conditions.push(`category = $${params.length}`);
  }
  if (from) {
    params.push(from);
    conditions.push(`spent_at >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`spent_at <= $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await query(`SELECT * FROM expenses ${where} ORDER BY spent_at DESC`, params);
  return rows;
}

async function remove(id) {
  const { rows } = await query('DELETE FROM expenses WHERE id = $1 RETURNING id', [id]);
  if (!rows[0]) throw ApiError.notFound('Expense not found');
}

async function update(id, { category, description, amount, spentAt }) {
  const { rows } = await query(
    `UPDATE expenses SET category = COALESCE($1, category), description = COALESCE($2, description),
            amount = COALESCE($3, amount), spent_at = COALESCE($4, spent_at)
     WHERE id = $5 RETURNING *`,
    [category || null, description || null, amount ?? null, spentAt || null, id]
  );
  if (!rows[0]) throw ApiError.notFound('Expense not found');
  return rows[0];
}

module.exports = { create, list, remove, update };
