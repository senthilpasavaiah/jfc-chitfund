const express = require('express');
const { param } = require('express-validator');
const paymentController = require('../controllers/payment.controller');
const { authenticate, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { recordPaymentRules } = require('../validators/payment.validators');

const router = express.Router();

router.use(authenticate);

router.get('/pending', paymentController.pending);
router.get('/chit/:chitId', [param('chitId').isUUID()], validate, paymentController.listByChit);
router.post('/', authorize('ADMIN', 'MANAGER', 'COLLECTOR'), recordPaymentRules, validate, paymentController.record);

module.exports = router;
