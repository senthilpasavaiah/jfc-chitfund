const express = require('express');
const { body, param } = require('express-validator');
const chitController = require('../controllers/chit.controller');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { createChitRules, idParamRule, addMemberRules, completeAuctionRules } = require('../validators/chit.validators');

const router = express.Router();

router.use(authenticate);

router.get('/', chitController.list);
router.get('/:id', idParamRule, validate, chitController.getById);

router.post('/', authorize('ADMIN', 'MANAGER'), createChitRules, validate, chitController.create);
router.post('/:id/members', authorize('ADMIN', 'MANAGER'), addMemberRules, validate, chitController.addMember);
router.delete(
  '/:id/members/:memberId',
  authorize('ADMIN', 'MANAGER'),
  [param('id').isUUID(), param('memberId').isUUID()],
  validate,
  chitController.removeMember
);

router.post(
  '/:id/start',
  authorize('ADMIN', 'MANAGER'),
  [param('id').isUUID(), body('startDate').optional().isISO8601()],
  validate,
  chitController.start
);
router.post('/:id/close', authorize('ADMIN', 'MANAGER'), idParamRule, validate, chitController.close);

router.post(
  '/:id/auctions/:auctionId/complete',
  authorize('ADMIN', 'MANAGER'),
  completeAuctionRules,
  validate,
  chitController.completeAuction
);

module.exports = router;
