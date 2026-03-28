const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { z } = require('zod');
const { db } = require('../config/db');

// ── Schemas ───────────────────────────────────────────────────────────────────
const registerSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
  email:    z.string().email(),
  password: z.string().min(8).max(72),
});

const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const AVATAR_COLORS = ['#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#ec4899'];
const randomColor = () => AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

function signAccess(user) {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  );
}

async function issueRefreshToken(userId) {
  const raw = crypto.randomBytes(40).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, hash, expires]
  );
  return raw; // return raw token to client
}

// ── Handlers ──────────────────────────────────────────────────────────────────
async function register(req, res) {
  const { username, email, password } = registerSchema.parse(req.body);
  const hash = await bcrypt.hash(password, 12);

  const { rows } = await db.query(
    `INSERT INTO users (username, email, password_hash, avatar_color)
     VALUES ($1, $2, $3, $4)
     RETURNING id, username, email, avatar_color, created_at`,
    [username.toLowerCase(), email.toLowerCase(), hash, randomColor()]
  );

  const user = rows[0];
  const accessToken  = signAccess(user);
  const refreshToken = await issueRefreshToken(user.id);

  res.status(201).json({ user, accessToken, refreshToken });
}

async function login(req, res) {
  const { email, password } = loginSchema.parse(req.body);

  const { rows } = await db.query(
    `SELECT * FROM users WHERE email = $1`, [email.toLowerCase()]
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  const accessToken  = signAccess(user);
  const refreshToken = await issueRefreshToken(user.id);
  const { password_hash, ...safeUser } = user;

  res.json({ user: safeUser, accessToken, refreshToken });
}

async function refresh(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required.' });

  const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const { rows } = await db.query(
    `SELECT rt.*, u.id as uid, u.username, u.email
     FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1 AND rt.expires_at > NOW()`,
    [hash]
  );

  if (!rows[0]) return res.status(401).json({ error: 'Invalid or expired refresh token.' });

  const { uid, username, email } = rows[0];
  const accessToken = signAccess({ id: uid, username, email });
  res.json({ accessToken });
}

async function logout(req, res) {
  const { refreshToken } = req.body;
  if (refreshToken) {
    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await db.query(`DELETE FROM refresh_tokens WHERE token_hash = $1`, [hash]);
  }
  res.json({ message: 'Logged out.' });
}

async function me(req, res) {
  const { rows } = await db.query(
    `SELECT id, username, email, avatar_color, created_at FROM users WHERE id = $1`,
    [req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found.' });
  res.json({ user: rows[0] });
}

module.exports = { register, login, refresh, logout, me };
