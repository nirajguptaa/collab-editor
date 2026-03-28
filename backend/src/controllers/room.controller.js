const { z } = require('zod');
const { nanoid } = require('nanoid');
const { db } = require('../config/db');

const createSchema = z.object({
  name:      z.string().min(1).max(100),
  language:  z.string().default('javascript'),
  is_public: z.boolean().default(false),
});

const updateSchema = z.object({
  name:      z.string().min(1).max(100).optional(),
  language:  z.string().optional(),
  is_public: z.boolean().optional(),
}).strict();

async function list(req, res) {
  const { rows } = await db.query(
    `SELECT r.*, d.revision
     FROM rooms r
     JOIN room_members rm ON rm.room_id = r.id
     LEFT JOIN documents d ON d.room_id = r.id
     WHERE rm.user_id = $1
     ORDER BY r.updated_at DESC`,
    [req.user.id]
  );
  res.json({ rooms: rows });
}

async function create(req, res) {
  const data = createSchema.parse(req.body);
  const slug = nanoid(10);

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const { rows: [room] } = await client.query(
      `INSERT INTO rooms (name, slug, language, owner_id, is_public)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [data.name, slug, data.language, req.user.id, data.is_public]
    );

    // add owner as member
    await client.query(
      `INSERT INTO room_members (room_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [room.id, req.user.id]
    );

    // create empty document
    await client.query(
      `INSERT INTO documents (room_id, content, revision) VALUES ($1, '', 0)`,
      [room.id]
    );

    await client.query('COMMIT');
    res.status(201).json({ room });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getBySlug(req, res) {
  const { rows: [room] } = await db.query(
    `SELECT r.*, d.content, d.revision,
            u.username as owner_username, u.avatar_color as owner_color
     FROM rooms r
     JOIN documents d ON d.room_id = r.id
     JOIN users u ON u.id = r.owner_id
     WHERE r.slug = $1`,
    [req.params.slug]
  );

  if (!room) return res.status(404).json({ error: 'Room not found.' });

  // private room: only members
  if (!room.is_public && req.user) {
    const { rows } = await db.query(
      `SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2`,
      [room.id, req.user.id]
    );
    if (!rows[0]) return res.status(403).json({ error: 'Access denied.' });
  } else if (!room.is_public) {
    return res.status(403).json({ error: 'Access denied.' });
  }

  res.json({ room });
}

async function update(req, res) {
  const data = updateSchema.parse(req.body);

  const { rows: [room] } = await db.query(
    `SELECT * FROM rooms WHERE slug = $1 AND owner_id = $2`,
    [req.params.slug, req.user.id]
  );
  if (!room) return res.status(404).json({ error: 'Room not found or not owner.' });

  const fields = Object.keys(data);
  if (fields.length === 0) return res.json({ room });

  const setClause = fields.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const values    = [...Object.values(data), room.id];

  const { rows: [updated] } = await db.query(
    `UPDATE rooms SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`,
    values
  );
  res.json({ room: updated });
}

async function remove(req, res) {
  const { rowCount } = await db.query(
    `DELETE FROM rooms WHERE slug = $1 AND owner_id = $2`,
    [req.params.slug, req.user.id]
  );
  if (!rowCount) return res.status(404).json({ error: 'Room not found or not owner.' });
  res.json({ message: 'Room deleted.' });
}

async function history(req, res) {
  const { rows: [room] } = await db.query(
    `SELECT id FROM rooms WHERE slug = $1`, [req.params.slug]
  );
  if (!room) return res.status(404).json({ error: 'Room not found.' });

  const limit  = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;

  const { rows } = await db.query(
    `SELECT o.*, u.username, u.avatar_color
     FROM operations o JOIN users u ON u.id = o.user_id
     WHERE o.room_id = $1
     ORDER BY o.revision DESC
     LIMIT $2 OFFSET $3`,
    [room.id, limit, offset]
  );
  res.json({ operations: rows });
}

module.exports = { list, create, getBySlug, update, remove, history };
