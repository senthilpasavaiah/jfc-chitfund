const { verifyAccessToken } = require('../utils/jwt');
const ApiError = require('../utils/ApiError');
const { query } = require('../config/db');

/** Verifies the Bearer access token and attaches req.user. */
async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw ApiError.unauthorized('Missing or malformed Authorization header');
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (err) {
    throw ApiError.unauthorized('Invalid or expired access token');
  }

  const { rows } = await query(
    'SELECT id, email, phone, role, is_active FROM users WHERE id = $1',
    [payload.sub]
  );
  const user = rows[0];
  if (!user || !user.is_active) {
    throw ApiError.unauthorized('User account is inactive or no longer exists');
  }

  req.user = { id: user.id, email: user.email, phone: user.phone, role: user.role };
  next();
}

/** Restricts a route to one or more roles. Use after `authenticate`. */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) throw ApiError.unauthorized();
    if (!allowedRoles.includes(req.user.role)) {
      throw ApiError.forbidden(`Requires one of roles: ${allowedRoles.join(', ')}`);
    }
    next();
  };
}

module.exports = { authenticate, authorize };
