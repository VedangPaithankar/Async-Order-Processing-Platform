const { Queue } = require('bullmq');

const redisConnection = require('../utils/redis');

const deadLetterQueue = new Queue(

  'dead-letter-queue',

  {
    connection: redisConnection
  } 
);

module.exports = deadLetterQueue;