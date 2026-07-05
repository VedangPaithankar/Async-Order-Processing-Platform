const prisma = require("../utils/prisma");
const redisConnection = require("../utils/redis");
const { log } = require("../utils/logger");

const CHECK_TIMEOUT_MS = 2000;

const withTimeout = (promise, label) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} check timed out`)), CHECK_TIMEOUT_MS),
    ),
  ]);

exports.getHealth = async (req, res) => {
  const checks = {};
  let healthy = true;

  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, "database");
    checks.database = "ok";
  } catch (err) {
    healthy = false;
    checks.database = "unhealthy";
    checks.databaseError = err.message;
  }

  try {
    // redisConnection is configured with maxRetriesPerRequest: null (required
    // for BullMQ's blocking commands), which means queued commands never
    // reject on disconnect — they wait indefinitely for reconnection. Without
    // this timeout, ping() would hang the whole request while Redis is down.
    await withTimeout(redisConnection.ping(), "redis");
    checks.redis = "ok";
  } catch (err) {
    healthy = false;
    checks.redis = "unhealthy";
    checks.redisError = err.message;
  }

  if (!healthy) {
    log("ERROR", "Health check failed", checks);
  }

  res.status(healthy ? 200 : 503).json({
    status: healthy ? "ok" : "unhealthy",
    service: "brewflow-api",
    checks,
  });
};
