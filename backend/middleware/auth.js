const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'changeme-set-JWT_SECRET-in-env';

function verifyToken(token) {
  if (!token) {
    throw new Error('Missing token');
  }
  const payload = jwt.verify(token, JWT_SECRET);
  return { id: payload.sub, email: payload.email };
}

/**
 * Express middleware that validates the JWT Bearer token.
 * Attaches req.user = { id, email } on success.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }

  try {
    req.user = verifyToken(authHeader.slice(7));
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token. Please log in again.' });
  }
}

module.exports = { requireAuth, JWT_SECRET, verifyToken };
