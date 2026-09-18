const documentService = require('../services/document.service');
const { recordAudit } = require('../utils/audit');

async function list(req, res) {
  const rows = await documentService.list();
  res.json({ success: true, data: rows });
}

async function upload(req, res) {
  const doc = await documentService.upload({
    title: req.body.title,
    category: req.body.category,
    description: req.body.description,
    fileName: req.body.fileName,
    fileMimeType: req.body.fileMimeType,
    fileData: req.body.fileData,
    uploadedById: req.user.id,
  });
  await recordAudit({ userId: req.user.id, action: 'DOCUMENT_UPLOAD', entityType: 'ClubDocument', entityId: doc.id, metadata: { title: doc.title, category: doc.category }, ipAddress: req.ip });
  res.status(201).json({ success: true, data: doc });
}

async function getFile(req, res) {
  const { file_name: fileName, file_mime_type: mimeType, file_data: fileData } = await documentService.getFile(req.params.id);
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `inline; filename="${fileName.replace(/"/g, '')}"`);
  res.send(Buffer.from(fileData, 'base64'));
}

async function remove(req, res) {
  await documentService.remove(req.params.id);
  await recordAudit({ userId: req.user.id, action: 'DOCUMENT_DELETE', entityType: 'ClubDocument', entityId: req.params.id, ipAddress: req.ip });
  res.json({ success: true, message: 'Document deleted.' });
}

module.exports = { list, upload, getFile, remove };
