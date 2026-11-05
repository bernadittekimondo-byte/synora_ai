const { ZodError } = require('zod');

function errorHandler(err, _req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'Validation failed', details: err.flatten() });
  }
  const status = err.status || 500;
  if (status >= 500) console.error('[api] error', err);
  res.status(status).json({ error: err.message || 'Internal error' });
}

function asyncHandler(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

module.exports = { errorHandler, asyncHandler };