const express = require('express');
const { param } = require('express-validator');
const documentController = require('../controllers/document.controller');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();
router.use(authenticate);

// Any signed-in user (admin, manager, or member) can view and download club
// documents - only uploading/removing is restricted below.
router.get('/', documentController.list);
router.get('/:id/file', [param('id').isUUID()], validate, documentController.getFile);

// Admin-only for now. To open this up to managers too later, add
// 'MANAGER' to these two authorize() calls - nothing else needs to change.
router.post('/', authorize('ADMIN'), documentController.upload);
router.delete('/:id', authorize('ADMIN'), [param('id').isUUID()], validate, documentController.remove);

module.exports = router;
