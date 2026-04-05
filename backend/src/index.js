require('dotenv').config();
const http = require('http');
const app  = require('./app');
const { initSocket }  = require('./socket');
const { connectDB }   = require('./config/db');
const { connectRedis }= require('./config/redis');
const { pullImages }  = require('./services/executor.service');

const PORT = process.env.PORT || 4000;

async function start() {
  await connectDB();
  await connectRedis();

  const server = http.createServer(app);
  initSocket(server);

  server.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
    console.log(`[server] env: ${process.env.NODE_ENV}`);
    // Pull Docker images in background so first execution is fast
    pullImages();
  });
}

start().catch((err) => {
  console.error('[server] fatal startup error:', err);
  process.exit(1);
});