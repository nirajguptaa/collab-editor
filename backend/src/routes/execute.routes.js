const router  = require('express').Router({ mergeParams: true });
const rateLimit = require('express-rate-limit');
const { asyncHandler } = require('../middleware/error.middleware');
const { authenticate }  = require('../middleware/auth.middleware');
const { executeCode }   = require('../services/executor.service');
const { db }            = require('../config/db');
const { getPublisher }  = require('../config/redis');

// Max 10 executions per user per minute (CPU protection)
const execLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many executions. Wait a minute and try again.' },
});

const SUPPORTED = ['cpp', 'python', 'javascript'];

// POST /api/rooms/:slug/execute
router.post(
  '/execute',
  authenticate,
  execLimit,
  asyncHandler(async (req, res) => {
    const { code, language, stdin = '' } = req.body;

    if (!code || !code.trim()) {
      return res.status(400).json({ error: 'No code provided.' });
    }

    const lang = language?.toLowerCase();
    if (!SUPPORTED.includes(lang)) {
      return res.status(400).json({
        error: `Unsupported language. Supported: ${SUPPORTED.join(', ')}`,
      });
    }

    // Verify the user has access to this room
    const { rows: [room] } = await db.query(
      `SELECT r.id FROM rooms r
       JOIN room_members rm ON rm.room_id = r.id
       WHERE r.slug = $1 AND rm.user_id = $2`,
      [req.params.slug, req.user.id]
    );
    if (!room) return res.status(403).json({ error: 'Access denied.' });

    console.log(`[executor] running ${lang} for room ${req.params.slug}`);

    // Execute (this takes a few seconds)
    const result = await executeCode(code, lang, stdin);

    // Broadcast result to ALL users in the room via Redis pub/sub
    // so everyone sees the output simultaneously
    getPublisher().publish(`room:${room.id}:ops`, JSON.stringify({
      roomId: room.id,
      event:  'execution-result',
      data: {
        ...result,
        language: lang,
        ranBy: req.user.username,
        ranAt: new Date().toISOString(),
      },
    }));

    res.json(result);
  })
);

module.exports = router;