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
    `SELECT u.id, u.email, u.phone, u.role, u.is_active, m.id AS member_id, m.name AS member_name
     FROM users u
     LEFT JOIN members m ON m.user_id = u.id
     WHERE u.id = $1`,
    [payload.sub]
  );
  const user = rows[0];
  if (!user || !user.is_active) {
    throw ApiError.unauthorized('User account is inactive or no longer exists');
  }

  // Display name: "Admin" for admins (matches the prototype's fixed admin
  // label), otherwise the linked member's real name.
  const displayName = user.role === 'ADMIN' ? 'Admin' : user.member_name || user.phone;

  req.user = {
    id: user.id,
    email: user.email,
    phone: user.phone,
    role: user.role,
    memberId: user.member_id,
    name: displayName,
  };
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
