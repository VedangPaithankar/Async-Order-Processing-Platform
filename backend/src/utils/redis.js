const IORedis = require("ioredis");

const redisConnection = process.env.REDIS_URL
  ? new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
    })
  : new IORedis({
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,

      maxRetriesPerRequest: null,
    });

module.exports = redisConnection;
