const jwt = require('jsonwebtoken');

/**
 * Attach req.user = { id, username, email } if token is valid.
 * Returns 401 otherwise.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header.' });
  }

  const token = authHeader.slice(7);
  try {
    req.user = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Token expired.' : 'Invalid token.';
    return res.status(401).json({ error: message });
  }
}

/**
 * Optional auth — attaches req.user if token present, continues either way.
 * Useful for public rooms that also serve logged-in users differently.
 */
function optionalAuth(req, _res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      req.user = jwt.verify(authHeader.slice(7), process.env.JWT_ACCESS_SECRET);
    }
  } catch (_) { /* no-op */ }
  next();
}

module.exports = { authenticate, optionalAuth };
