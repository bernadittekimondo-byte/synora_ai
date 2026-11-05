const { verifyToken } = require('@saas/security');
const { hasRole } = require('@saas/shared');

function requireAuth(req, res, next) {
  try {
    const token =
      (req.cookies && req.cookies.token) ||
      (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
        ? req.headers.authorization.slice(7) : null);
    if (!token) return res.status(401).json({ error: 'Unauthenticated' });
    const payload = verifyToken(token);
    req.auth = { userId: payload.sub, organizationId: payload.org, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.auth) return res.status(401).json({ error: 'Unauthenticated' });
    if (!hasRole(req.auth.role, role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

module.exports = { requireAuth, requireRole };