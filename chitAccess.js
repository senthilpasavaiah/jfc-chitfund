const ApiError = require('../utils/ApiError');
const chitService = require('../services/chit.service');

/**
 * Guards chit-detail routes (GET .../:id, .../months/:monthIndex,
 * .../ledger, .../payment-proof, etc.) so that only Admins, Managers, and
 * members who are an active participant in THIS SPECIFIC chit can read its
 * internal details (slots, drawer, months, payments, ledger).
 *
 * Must run after `authenticate` (needs req.user) and after the `:id` param
 * has been validated as a UUID.
 */
async function requireChitAccess(req, res, next) {
  const { role, memberId } = req.user;
  if (role === 'ADMIN' || role === 'MANAGER') return next();

  const hasAccess = await chitService.isChitParticipant(req.params.id, memberId);
  if (!hasAccess) {
    throw ApiError.forbidden('You do not have access to this chit.');
  }
  next();
}

module.exports = { requireChitAccess };
