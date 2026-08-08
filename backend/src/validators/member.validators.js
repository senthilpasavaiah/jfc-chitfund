const { body, param, query } = require('express-validator');

const createMemberRules = [
  body('name').trim().isLength({ min: 2 }).withMessage('Name is required'),
  body('mobileNumber')
    .trim()
    .matches(/^[0-9]{10}$/)
    .withMessage('Mobile number must be a 10-digit number'),
  body('whatsappNumber').optional({ checkFalsy: true }).trim(),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email'),
  body('aadhaarNumber')
    .optional({ checkFalsy: true })
    .matches(/^[0-9]{12}$/)
    .withMessage('Aadhaar number must be exactly 12 digits'),
  body('permanentAddress').optional({ checkFalsy: true }).trim(),
  body('currentAddress').optional({ checkFalsy: true }).trim(),
];

const updateMemberRules = [
  param('id').isUUID().withMessage('Invalid member id'),
  body('name').optional().trim().isLength({ min: 2 }),
  body('mobileNumber').optional().trim().matches(/^[0-9]{10}$/),
  body('email').optional({ checkFalsy: true }).isEmail(),
  body('aadhaarNumber').optional({ checkFalsy: true }).matches(/^[0-9]{12}$/),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
];

const listMembersRules = [
  query('status').optional().isIn(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
  query('search').optional().trim(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('pageSize').optional().isInt({ min: 1, max: 100 }).toInt(),
];

const idParamRule = [param('id').isUUID().withMessage('Invalid member id')];

module.exports = { createMemberRules, updateMemberRules, listMembersRules, idParamRule };
