const whatsappPaymentActionService = require('../services/whatsappPaymentAction.service');

async function record(req, res, next) {
  try {
    const memberId = req.body.memberId || req.user.memberId;
    const result = await whatsappPaymentActionService.recordAction({
      memberId,
      chitId: req.body.chitId,
      monthIndex: Number(req.body.monthIndex),
      action: req.body.action,
      chitMemberIds: req.body.chitMemberIds,
      amount: req.body.amount,
      providerMessageId: req.body.providerMessageId,
      metadata: req.body.metadata,
    });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

async function pending(req, res, next) {
  try {
    const memberId = req.query.memberId || req.user.memberId;
    const result = await whatsappPaymentActionService.listPending(
      memberId,
      req.query.chitId,
      Number(req.query.monthIndex)
    );
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

module.exports = { record, pending };
