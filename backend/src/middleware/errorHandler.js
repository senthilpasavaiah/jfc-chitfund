const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let error = err;

  // Postgres unique violation
  if (err.code === '23505') {
    error = ApiError.conflict('A record with this value already exists');
  } else if (err.code === '23503') {
    error = ApiError.badRequest('Related record does not exist (foreign key violation)');
  } else if (!(err instanceof ApiError)) {
    error = ApiError.internal(
      process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
    );
  }

  if (!error.isOperational || error.statusCode >= 500) {
    logger.error(err.message, { stack: err.stack, path: req.path, method: req.method });
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message,
    details: error.details || undefined,
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}

module.exports = { errorHandler, notFoundHandler };
