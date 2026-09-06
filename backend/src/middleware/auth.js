import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';
import { HttpError } from '../utils/http.js';

export async function authenticate(req, _res, next) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw new HttpError(401, 'Authentication required');
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await query('SELECT id, name, email, avatar_color FROM users WHERE id = $1', [payload.sub]);
    if (!rows[0]) throw new HttpError(401, 'Account no longer exists');
    req.user = rows[0];
    next();
  } catch (error) {
    next(error instanceof HttpError ? error : new HttpError(401, 'Invalid or expired session'));
  }
}

export function signToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}
