const express = require('express');
const { body, query: queryParam } = require('express-validator');
const controller = require('../controllers/whatsappPaymentAction.controller');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();
router.use(authenticate);

router.get(
  '/pending',
  [
    queryParam('chitId').isUUID(),
    queryParam('monthIndex').isInt({ min: 0 }),
  ],
  validate,
  controller.pending
);

router.post(
  '/',
  [
    body('chitId').isUUID(),
    body('monthIndex').isInt({ min: 0 }),
    body('action').isIn(['NOT_YET', 'WILL_PAY', 'PAY_LATER', 'PAID', 'SELECT_CONTRIBUTIONS']),
    body('memberId').optional().isUUID(),
    body('chitMemberIds').optional().isArray(),
    body('amount').optional().isFloat({ min: 0 }),
    body('providerMessageId').optional().isString(),
    body('metadata').optional().isObject(),
  ],
  validate,
  controller.record
);

module.exports = router;
