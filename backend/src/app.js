const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const morgan  = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes    = require('./routes/auth.routes');
const roomRoutes    = require('./routes/room.routes');
const userRoutes    = require('./routes/user.routes');
const aiRoutes      = require('./routes/ai.routes');
const executeRoutes = require('./routes/execute.routes');
const { errorHandler } = require('./middleware/error.middleware');

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use('/api/auth', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many auth requests, slow down.' },
}));

app.use(express.json({ limit: '2mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use('/api/auth',              authRoutes);
app.use('/api/rooms',             roomRoutes);
app.use('/api/users',             userRoutes);
app.use('/api/rooms/:slug/ai',    aiRoutes);
app.use('/api/rooms/:slug',       executeRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

app.use(errorHandler);

module.exports = app;