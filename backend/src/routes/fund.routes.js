const express = require('express');
const { body, param } = require('express-validator');
const fundController = require('../controllers/fund.controller');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();
router.use(authenticate);

router.get('/summary', fundController.summary);

router.get('/donations', fundController.listDonations);
router.post(
  '/donations',
  authorize('ADMIN', 'MANAGER'),
  [
    body('memberName').trim().notEmpty().withMessage('Member name is required'),
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number'),
    body('memberId').optional({ checkFalsy: true }).isUUID(),
    body('donatedAt').optional().isISO8601(),
  ],
  validate,
  fundController.addDonation
);
router.patch(
  '/donations/:id',
  authorize('ADMIN', 'MANAGER'),
  [
    param('id').isUUID(),
    body('memberName').optional().trim().notEmpty(),
    body('amount').optional().isFloat({ gt: 0 }),
    body('donatedAt').optional().isISO8601(),
  ],
  validate,
  fundController.updateDonation
);

router.get('/santha', fundController.listSantha);
router.post(
  '/santha',
  authorize('ADMIN', 'MANAGER'),
  [
    body('memberName').trim().notEmpty().withMessage('Member name is required'),
    body('roundLabel').trim().notEmpty().withMessage('Round label is required (e.g. "Santha to Ravi")'),
    body('amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number'),
    body('memberId').optional({ checkFalsy: true }).isUUID(),
    body('entryDate').optional().isISO8601(),
  ],
  validate,
  fundController.addSantha
);
router.patch(
  '/santha/:id',
  authorize('ADMIN', 'MANAGER'),
  [
    param('id').isUUID(),
    body('memberName').optional().trim().notEmpty(),
    body('amount').optional().isFloat({ gt: 0 }),
    body('entryDate').optional().isISO8601(),
  ],
  validate,
  fundController.updateSantha
);

router.get('/chit-profit-history', fundController.listChitProfitHistory);

router.get('/settlement', fundController.listSettlement);
router.post(
  '/settlement',
  authorize('ADMIN'),
  [
    body('fiscalYearLabel').trim().notEmpty(),
    body('santhaDonation').isFloat({ min: 0 }),
    body('chitProfit').isFloat({ min: 0 }),
    body('expenses').isFloat({ min: 0 }),
  ],
  validate,
  fundController.addSettlementYear
);

module.exports = router;
