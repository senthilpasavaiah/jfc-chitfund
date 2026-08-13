const express = require('express');
const memberController = require('../controllers/member.controller');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createMemberRules, updateMemberRules, listMembersRules, idParamRule } = require('../validators/member.validators');

const router = express.Router();

router.use(authenticate);

router.get('/', listMembersRules, validate, memberController.list);
router.get('/:id', idParamRule, validate, memberController.getById);
router.get('/:id/payments', idParamRule, validate, memberController.paymentHistory);

router.post('/', authorize('ADMIN', 'MANAGER'), createMemberRules, validate, memberController.create);
router.patch('/:id', authorize('ADMIN', 'MANAGER'), updateMemberRules, validate, memberController.update);
router.delete('/:id', authorize('ADMIN'), idParamRule, validate, memberController.remove);
router.post('/:id/reset-password', authorize('ADMIN', 'MANAGER'), idParamRule, validate, memberController.resetPassword);

module.exports = router;
