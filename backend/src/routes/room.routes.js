const router = require('express').Router();
const { asyncHandler } = require('../middleware/error.middleware');
const { authenticate, optionalAuth } = require('../middleware/auth.middleware');
const roomController = require('../controllers/room.controller');

// GET  /api/rooms            — list user's rooms
router.get('/', authenticate, asyncHandler(roomController.list));

// POST /api/rooms            — create room
router.post('/', authenticate, asyncHandler(roomController.create));

// GET  /api/rooms/:slug      — get room by slug (public rooms allow optional auth)
router.get('/:slug', optionalAuth, asyncHandler(roomController.getBySlug));

// PATCH /api/rooms/:slug     — update room settings (owner only)
router.patch('/:slug', authenticate, asyncHandler(roomController.update));

// DELETE /api/rooms/:slug    — delete room (owner only)
router.delete('/:slug', authenticate, asyncHandler(roomController.remove));

// GET  /api/rooms/:slug/history — operation history for a room
router.get('/:slug/history', authenticate, asyncHandler(roomController.history));

module.exports = router;
