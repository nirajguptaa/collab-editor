const { z } = require('zod');
const { db } = require('../config/db');

const updateSchema = z.object({
  username:     z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/).optional(),
  avatar_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
}).strict();

async function getById(req, res) {
  const { rows: [user] } = await db.query(
    `SELECT id, username, avatar_color, created_at FROM users WHERE id = $1`,
    [req.params.id]
  );
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json({ user });
}

async function updateMe(req, res) {
  const data = updateSchema.parse(req.body);
  const fields = Object.keys(data);
  if (fields.length === 0) return res.status(400).json({ error: 'Nothing to update.' });

  const setClause = fields.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const values    = [...Object.values(data), req.user.id];

  const { rows: [user] } = await db.query(
    `UPDATE users SET ${setClause} WHERE id = $${fields.length + 1}
     RETURNING id, username, email, avatar_color, created_at`,
    values
  );
  res.json({ user });
}

module.exports = { getById, updateMe };
