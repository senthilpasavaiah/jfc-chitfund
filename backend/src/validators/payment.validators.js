const { body, param } = require('express-validator');

const recordPaymentRules = [
  body('installmentId').isUUID().withMessage('Valid installmentId is required'),
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be a positive number'),
  body('method').optional().isIn(['CASH', 'BANK_TRANSFER', 'UPI', 'CHEQUE', 'OTHER']),
  body('referenceNumber').optional({ checkFalsy: true }).trim(),
  body('isAdvance').optional().isBoolean(),
];

const listPaymentsRules = [
  param('id').optional().isUUID(),
];

module.exports = { recordPaymentRules, listPaymentsRules };
