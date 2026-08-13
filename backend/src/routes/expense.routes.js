const express = require('express');
const { body, param } = require('express-validator');
const expenseService = require('../services/expense.service');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { recordAudit } = require('../utils/audit');

const router = express.Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const expenses = await expenseService.list(req.query);
  res.json({ success: true, data: expenses });
});

router.post(
  '/',
  authorize('ADMIN', 'MANAGER'),
  [
    body('category').isIn(['OFFICE', 'MISCELLANEOUS']),
    body('description').trim().notEmpty(),
    body('amount').isFloat({ gt: 0 }),
    body('spentAt').optional().isISO8601(),
  ],
  validate,
  async (req, res) => {
    const expense = await expenseService.create(req.body, req.user.id);
    await recordAudit({ userId: req.user.id, action: 'EXPENSE_CREATE', entityType: 'Expense', entityId: expense.id, ipAddress: req.ip });
    res.status(201).json({ success: true, data: expense });
  }
);

router.delete('/:id', authorize('ADMIN'), [param('id').isUUID()], validate, async (req, res) => {
  await expenseService.remove(req.params.id);
  await recordAudit({ userId: req.user.id, action: 'EXPENSE_DELETE', entityType: 'Expense', entityId: req.params.id, ipAddress: req.ip });
  res.json({ success: true, message: 'Expense deleted' });
});

router.patch(
  '/:id',
  authorize('ADMIN', 'MANAGER'),
  [
    param('id').isUUID(),
    body('category').optional().isIn(['OFFICE', 'MISCELLANEOUS']),
    body('description').optional().trim().notEmpty(),
    body('amount').optional().isFloat({ gt: 0 }),
    body('spentAt').optional().isISO8601(),
  ],
  validate,
  async (req, res) => {
    const expense = await expenseService.update(req.params.id, req.body);
    await recordAudit({ userId: req.user.id, action: 'EXPENSE_UPDATE', entityType: 'Expense', entityId: req.params.id, ipAddress: req.ip });
    res.json({ success: true, data: expense });
  }
);

module.exports = router;
