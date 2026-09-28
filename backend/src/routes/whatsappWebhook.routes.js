const express = require('express');
const controller = require('../controllers/whatsappWebhook.controller');
const router = express.Router();
router.get('/webhook', controller.verify);
router.post('/webhook', controller.receive);
module.exports = router;