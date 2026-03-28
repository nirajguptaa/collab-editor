const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { db } = require('../config/db');
const { getPublisher, getSubscriber } = require('../config/redis');
const { transformAgainstHistory, applyOp } = require('../services/ot.service');

const roomPresence = new Map();
const channel = (roomId) => `room:${roomId}:ops`;

function socketAuth(socket, next) {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required.'));
  try {
    socket.user = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    next();
  } catch (err) {
    next(new Error('Invalid token.'));
  }
}

function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.use(socketAuth);

  // Redis subscriber — forward messages to local sockets
  // IMPORTANT: skip the socket that originally sent the op (senderSocketId)
  const sub = getSubscriber();
  sub.on('message', (ch, message) => {
    try {
      const { roomId, event, data, senderSocketId } = JSON.parse(message);
      if (senderSocketId) {
        // Send to everyone in the room EXCEPT the original sender
        io.to(roomId).except(senderSocketId).emit(event, data);
      } else {
        io.to(roomId).emit(event, data);
      }
    } catch (e) {
      console.error('[redis] message parse error:', e);
    }
  });

  io.on('connection', (socket) => {
    const { id: userId, username } = socket.user;

    // ── join-room ─────────────────────────────────────────────────────────────
    socket.on('join-room', async ({ roomId }, ack) => {
      try {
        const { rows: [room] } = await db.query(
          `SELECT r.*, d.content, d.revision
           FROM rooms r JOIN documents d ON d.room_id = r.id
           WHERE r.id = $1`,
          [roomId]
        );
        if (!room) return ack?.({ error: 'Room not found.' });

        if (!room.is_public) {
          const { rows } = await db.query(
            `SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2`,
            [roomId, userId]
          );
          if (!rows[0]) return ack?.({ error: 'Access denied.' });
        }

        socket.join(roomId);
        socket.currentRoom = roomId;

        // Subscribe this Redis channel if not already
        sub.subscribe(channel(roomId));

        // Track presence
        if (!roomPresence.has(roomId)) roomPresence.set(roomId, new Map());
        roomPresence.get(roomId).set(userId, {
          userId, username,
          color: '#' + Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0'),
          cursor: null,
        });

        await db.query(
          `INSERT INTO room_activity (room_id, user_id, event) VALUES ($1, $2, 'joined')`,
          [roomId, userId]
        ).catch(() => {});

        // Send current doc to the joining user
        ack?.({ content: room.content, revision: room.revision });

        // Broadcast updated presence to everyone in room
        io.to(roomId).emit('presence', {
          users: [...roomPresence.get(roomId).values()],
        });
      } catch (err) {
        console.error('[socket] join-room error:', err);
        ack?.({ error: 'Server error.' });
      }
    });

    // ── operation ─────────────────────────────────────────────────────────────
    socket.on('operation', async ({ roomId, op }, ack) => {
      try {
        // Get current document state
        const { rows: [doc] } = await db.query(
          `SELECT content, revision FROM documents WHERE room_id = $1`,
          [roomId]
        );
        if (!doc) return ack?.({ error: 'Room not found.' });

        // Get all ops since client's base revision (for OT transform)
        const { rows: pendingOps } = await db.query(
          `SELECT * FROM operations
           WHERE room_id = $1 AND revision > $2
           ORDER BY revision ASC`,
          [roomId, op.revision]
        );

        // Transform incoming op against concurrent ops
        const transformed = transformAgainstHistory(op, pendingOps);
        const newContent  = applyOp(doc.content, transformed);
        const newRevision = doc.revision + 1;

        // Save op to history
        await db.query(
          `INSERT INTO operations
             (room_id, user_id, revision, op_type, position, chars, length)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            roomId, userId, newRevision,
            transformed.type, transformed.position,
            transformed.chars || null,
            transformed.length || null,
          ]
        );

        // Update document snapshot
        await db.query(
          `UPDATE documents
           SET content = $1, revision = $2, snapshot_at = NOW()
           WHERE room_id = $3`,
          [newContent, newRevision, roomId]
        );

        // Acknowledge to the sender immediately with the transformed op
        ack?.({ revision: newRevision, transformedOp: transformed });

        // Broadcast to OTHER clients via Redis pub/sub
        // Pass senderSocketId so the Redis handler can exclude them
        const payload = {
          op: { ...transformed, revision: newRevision },
          userId,
          username,
        };

        getPublisher().publish(channel(roomId), JSON.stringify({
          roomId,
          event: 'remote-operation',
          data: payload,
          senderSocketId: socket.id,  // ← this prevents echo back to sender
        }));

      } catch (err) {
        console.error('[socket] operation error:', err);
        ack?.({ error: 'Failed to apply operation.' });
      }
    });

    // ── cursor-move ───────────────────────────────────────────────────────────
    socket.on('cursor-move', ({ roomId, cursor }) => {
      const presence = roomPresence.get(roomId);
      if (!presence) return;
      const user = presence.get(userId);
      if (user) user.cursor = cursor;
      // Cursor is ephemeral — just broadcast directly, no Redis needed
      socket.to(roomId).emit('cursor-update', { userId, username, cursor });
    });

    // ── language-change ───────────────────────────────────────────────────────
    socket.on('language-change', async ({ roomId, language }) => {
      await db.query(
        `UPDATE rooms SET language = $1 WHERE id = $2`,
        [language, roomId]
      ).catch(() => {});
      // Tell everyone else in the room
      socket.to(roomId).emit('language-changed', { language, changedBy: username });
    });

    // ── disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnecting', async () => {
      for (const roomId of socket.rooms) {
        if (roomId === socket.id) continue;
        const presence = roomPresence.get(roomId);
        if (presence) {
          presence.delete(userId);
          if (presence.size === 0) {
            roomPresence.delete(roomId);
          } else {
            io.to(roomId).emit('presence', {
              users: [...presence.values()],
            });
          }
        }
        await db.query(
          `INSERT INTO room_activity (room_id, user_id, event) VALUES ($1, $2, 'left')`,
          [roomId, userId]
        ).catch(() => {});
      }
    });
  });

  console.log('[socket] Socket.io server initialized');
  return io;
}

module.exports = { initSocket };