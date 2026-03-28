const router = require('express').Router();
const { asyncHandler } = require('../middleware/error.middleware');
const { authenticate } = require('../middleware/auth.middleware');
const authController = require('../controllers/auth.controller');

// POST /api/auth/register
router.post('/register', asyncHandler(authController.register));

// POST /api/auth/login
router.post('/login', asyncHandler(authController.login));

// POST /api/auth/refresh
router.post('/refresh', asyncHandler(authController.refresh));

// POST /api/auth/logout  (protected)
router.post('/logout', authenticate, asyncHandler(authController.logout));

// GET  /api/auth/me      (protected)
router.get('/me', authenticate, asyncHandler(authController.me));

module.exports = router;
