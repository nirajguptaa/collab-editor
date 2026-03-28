const router = require('express').Router();
const { asyncHandler } = require('../middleware/error.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const userController = require('../controllers/user.controller');

// GET  /api/users/:id    — public profile
router.get('/:id', asyncHandler(userController.getById));

// PATCH /api/users/me   — update own profile
router.patch('/me', authenticate, asyncHandler(userController.updateMe));

module.exports = router;
