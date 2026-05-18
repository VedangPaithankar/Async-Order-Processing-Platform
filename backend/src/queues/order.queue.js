const { Queue } = require('bullmq');
const redisConnection = require('../utils/redis');

const orderQueue = new Queue('order-processing', {
  connection: redisConnection
});

module.exports = orderQueue;