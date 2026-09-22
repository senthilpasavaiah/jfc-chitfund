const express = require('express');
const { body, param } = require('express-validator');
const paymentProofController = require('../controllers/paymentProof.controller');
const chitController = require('../controllers/chit.controller');
const { authenticate, authorize } = require('../middleware/auth');
const { requireChitAccess } = require('../middleware/chitAccess');
const validate = require('../middleware/validate');

const router = express.Router();
router.use(authenticate);

const idParam = [param('id').isUUID()];
const monthParams = [param('id').isUUID(), param('monthIndex').isInt({ min: 0 })];

router.get('/', chitController.list);
router.get('/:id', idParam, validate, requireChitAccess, chitController.getById);

router.post(
  '/',
  authorize('ADMIN', 'MANAGER'),
  [
    body('valueLakh').isFloat({ gt: 0 }).withMessage('Chit value (in Lakh) is required'),
    body('totalMonths').isIn([10, 20]).withMessage('Total months must be 10 or 20'),
    body('rateSchedule').optional().isIn(['standard', 'jfc']),
    body('startDate').optional().isISO8601(),
  ],
  validate,
  chitController.create
);
router.delete('/:id', authorize('ADMIN'), idParam, validate, chitController.deleteChit);
router.patch(
  '/:id/ref-number',
  authorize('ADMIN'),
  [...idParam, body('refNumber').trim().notEmpty().withMessage('Reference number is required')],
  validate,
  chitController.updateRefNumber
);
router.post(
  '/:id/months/:monthIndex/multiple-draw',
  authorize('ADMIN', 'MANAGER'),
  [...monthParams, body('memberIds').isArray({ min: 2 }), body('memberIds.*').isUUID(), body('gapMonthIndexes').isArray({ min: 1 }), body('gapMonthIndexes.*').isInt({ min: 0 })],
  validate,
  chitController.assignMultipleDraw
);

router.post(
  '/:id/members',
  authorize('ADMIN', 'MANAGER'),
  [...idParam, body('memberIds').isArray({ min: 1 })],
  validate,
  chitController.addMembers
);
router.delete(
  '/:id/members/:slotIndex',
  authorize('ADMIN', 'MANAGER'),
  [...idParam, param('slotIndex').isInt({ min: 0 })],
  validate,
  chitController.removeMember
);

router.post('/:id/join', idParam, validate, chitController.join);
router.post('/:id/leave', idParam, validate, chitController.leave);

router.get('/:id/months/:monthIndex', monthParams, validate, requireChitAccess, chitController.getMonthDetail);

router.patch(
  '/:id/months/:monthIndex/payment',
  authorize('ADMIN', 'MANAGER', 'COLLECTOR'),
  [...monthParams, body('memberId').isUUID()],
  validate,
  chitController.togglePaid
);
router.post(
  '/:id/months/:monthIndex/payment/mark-all',
  authorize('ADMIN', 'MANAGER', 'COLLECTOR'),
  monthParams,
  validate,
  chitController.markAllPaid
);
router.post('/:id/months/:monthIndex/pay', monthParams, validate, chitController.payForMonth);

router.patch(
  '/:id/months/:monthIndex/draw',
  authorize('ADMIN', 'MANAGER'),
  [...monthParams, body('memberId').optional({ nullable: true }).isUUID(), body('replace').optional().isBoolean()],
  validate,
  chitController.assignDraw
);
router.delete(
  '/:id/months/:monthIndex/draw',
  authorize('ADMIN', 'MANAGER'),
  monthParams,
  validate,
  chitController.recallDraw
);
router.post(
  '/:id/months/:monthIndex/shuffle',
  authorize('ADMIN', 'MANAGER'),
  [...monthParams, body('memberIds').isArray({ min: 1 })],
  validate,
  chitController.performShuffle
);

router.post(
  '/:id/months/:monthIndex/request',
  [...monthParams, body('type').isIn(['mandatory', 'planning', 'none'])],
  validate,
  chitController.submitRequest
);
router.delete('/:id/months/:monthIndex/request', monthParams, validate, chitController.cancelRequest);

router.get('/:id/ledger', idParam, validate, requireChitAccess, chitController.getLedger);

// Payment proof workflow
router.post(
  '/:id/months/:monthIndex/payment-proof',
  [
    ...monthParams,
    body('imageData').notEmpty().withMessage('Image data is required'),
    body('imageMimeType').matches(/^image\//).withMessage('Must be an image'),
    body('memberId').optional().isUUID(),
  ],
  validate,
  paymentProofController.submit
);
router.get('/:id/months/:monthIndex/payment-proof', monthParams, validate, requireChitAccess, paymentProofController.getForMonth);
router.post(
  '/:id/months/:monthIndex/payment-manual',
  authorize('ADMIN', 'MANAGER', 'COLLECTOR'),
  [...monthParams, body('memberId').isUUID()],
  validate,
  paymentProofController.markManual
);
router.get(
  '/payment-proofs/pending',
  authorize('ADMIN', 'MANAGER'),
  paymentProofController.listPending
);
router.patch(
  '/payment-proofs/:proofId/review',
  authorize('ADMIN', 'MANAGER'),
  [param('proofId').isUUID(), body('decision').isIn(['confirm', 'reject'])],
  validate,
  paymentProofController.review
);
router.get('/payment-proofs/:proofId/image', [param('proofId').isUUID()], validate, paymentProofController.getImage);

module.exports = router;
