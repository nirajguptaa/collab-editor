const router = require('express').Router({ mergeParams: true });
const rateLimit = require('express-rate-limit');
const { asyncHandler } = require('../middleware/error.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const { getCompletion } = require('../services/ai.service');
const { db } = require('../config/db');

// Stricter rate limit for AI calls (cost control)
const aiLimit = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 20,
  message: { error: 'AI rate limit exceeded. Try again in a minute.' },
});

// POST /api/rooms/:slug/ai/complete
router.post(
  '/complete',
  authenticate,
  aiLimit,
  asyncHandler(async (req, res) => {
    const { prefix, suffix, language } = req.body;

    if (!prefix && !suffix) {
      return res.status(400).json({ error: 'prefix or suffix required.' });
    }

    // Verify user has access to this room
    const { rows: [room] } = await db.query(
      `SELECT r.id FROM rooms r
       JOIN room_members rm ON rm.room_id = r.id
       WHERE r.slug = $1 AND rm.user_id = $2`,
      [req.params.slug, req.user.id]
    );
    if (!room) return res.status(403).json({ error: 'Access denied.' });

    const completion = await getCompletion({ prefix, suffix, language });
    res.json({ completion });
  })
);

module.exports = router;
