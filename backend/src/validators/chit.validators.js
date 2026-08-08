const { body, param } = require('express-validator');

const createChitRules = [
  body('refNumber').trim().notEmpty().withMessage('Reference number is required'),
  body('name').trim().isLength({ min: 2 }).withMessage('Chit name is required'),
  body('chitValue').isFloat({ gt: 0 }).withMessage('Chit value must be a positive number'),
  body('totalMonths').isInt({ min: 2 }).withMessage('Total months must be at least 2'),
  body('commissionPercent').optional().isFloat({ min: 0, max: 100 }),
];

const idParamRule = [param('id').isUUID().withMessage('Invalid chit id')];

const addMemberRules = [
  param('id').isUUID(),
  body('memberId').isUUID().withMessage('Valid memberId is required'),
  body('slotNumber').optional().isInt({ min: 1 }),
];

const completeAuctionRules = [
  param('id').isUUID(),
  param('auctionId').isUUID(),
  body('winnerId').isUUID().withMessage('Valid winnerId is required'),
  body('discountAmount').isFloat({ min: 0 }).withMessage('Discount amount must be zero or positive'),
];

module.exports = { createChitRules, idParamRule, addMemberRules, completeAuctionRules };
