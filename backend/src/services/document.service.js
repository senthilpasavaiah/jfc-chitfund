const { query } = require('../config/db');
const ApiError = require('../utils/ApiError');

// Raw file size cap. Kept comfortably under the JSON body limit (see
// app.js) once inflated by base64 (~4/3 larger) plus room for the other
// form fields in the same request.
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB raw (~13.3MB base64)

const CATEGORIES = ['ACCOUNTS', 'REGISTRATION', 'BYLAWS', 'OTHER'];

async function upload({ title, category, description, fileName, fileMimeType, fileData, uploadedById }) {
  if (!title || !title.trim()) throw ApiError.badRequest('A title is required.');
  if (!CATEGORIES.includes(category)) throw ApiError.badRequest(`Category must be one of: ${CATEGORIES.join(', ')}`);
  if (!fileData) throw ApiError.badRequest('No file was provided.');
  const approxBytes = (fileData.length * 3) / 4;
  if (approxBytes > MAX_FILE_BYTES) {
    throw ApiError.badRequest('That file is too large. Please upload something under 10MB.');
  }

  const { rows } = await query(
    `INSERT INTO club_documents (title, category, description, file_name, file_mime_type, file_data, uploaded_by_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, title, category, description, file_name, file_mime_type, uploaded_by_id, uploaded_at`,
    [title.trim(), category, description || null, fileName, fileMimeType, fileData, uploadedById]
  );
  return rows[0];
}

/** Every club document, newest first - viewable by any authenticated user. */
async function list() {
  const { rows } = await query(
    `SELECT d.id, d.title, d.category, d.description, d.file_name, d.file_mime_type, d.uploaded_at,
            COALESCE(m.name, u.phone) AS uploaded_by_name
     FROM club_documents d
     LEFT JOIN users u ON u.id = d.uploaded_by_id
     LEFT JOIN members m ON m.user_id = u.id
     ORDER BY d.uploaded_at DESC`
  );
  return rows;
}

async function getFile(id) {
  const { rows } = await query('SELECT file_name, file_mime_type, file_data FROM club_documents WHERE id = $1', [id]);
  if (!rows[0]) throw ApiError.notFound('Document not found');
  return rows[0];
}

async function remove(id) {
  const { rows } = await query('DELETE FROM club_documents WHERE id = $1 RETURNING id', [id]);
  if (!rows[0]) throw ApiError.notFound('Document not found');
}

module.exports = { upload, list, getFile, remove, CATEGORIES };
