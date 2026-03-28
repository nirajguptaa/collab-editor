const Redis = require('ioredis');

// Two clients: one for pub/sub (can't run other commands), one for everything else
let publisher;
let subscriber;
let client;

async function connectRedis() {
  const opts = { lazyConnect: true, maxRetriesPerRequest: 3 };

  client     = new Redis(process.env.REDIS_URL, opts);
  publisher  = new Redis(process.env.REDIS_URL, opts);
  subscriber = new Redis(process.env.REDIS_URL, opts);

  await Promise.all([client.connect(), publisher.connect(), subscriber.connect()]);
  console.log('[redis] connected (3 clients: general / pub / sub)');
}

module.exports = {
  getClient:     () => client,
  getPublisher:  () => publisher,
  getSubscriber: () => subscriber,
  connectRedis,
};
