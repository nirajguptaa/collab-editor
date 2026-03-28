require('dotenv').config();
const http = require('http');
const app = require('./app');
const { initSocket } = require('./socket');
const { connectDB } = require('./config/db');
const { connectRedis } = require('./config/redis');

const PORT = process.env.PORT || 4000;

async function start() {
  await connectDB();
  await connectRedis();

  const server = http.createServer(app);
  initSocket(server);

  server.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
    console.log(`[server] env: ${process.env.NODE_ENV}`);
  });
}

start().catch((err) => {
  console.error('[server] fatal startup error:', err);
  process.exit(1);
});
