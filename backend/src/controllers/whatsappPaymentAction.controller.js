const whatsappPaymentActionService = require('../services/whatsappPaymentAction.service');

async function record(req, res, next) {
  try {
    const requestedMemberId = req.body.memberId;
    const canActForAnotherMember = req.user.role === 'ADMIN' || req.user.role === 'MANAGER';
    if (requestedMemberId && requestedMemberId !== req.user.memberId && !canActForAnotherMember) {
      return res.status(403).json({ success: false, message: 'You can only submit WhatsApp payment actions for your own account.' });
    }
    const memberId = requestedMemberId || req.user.memberId;
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
    const requestedMemberId = req.query.memberId;
    const canViewAnotherMember = req.user.role === 'ADMIN' || req.user.role === 'MANAGER';
    if (requestedMemberId && requestedMemberId !== req.user.memberId && !canViewAnotherMember) {
      return res.status(403).json({ success: false, message: 'You can only view your own pending WhatsApp payments.' });
    }
    const memberId = requestedMemberId || req.user.memberId;
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
