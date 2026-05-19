const { Worker } = require("bullmq");

const redisConnection = require("../utils/redis");
const orderRepository = require("../repositories/order.repository");
const { OrderStatus } = require("../models/order.model");
const RetryableError = require("../errors/retryable.error");
const deadLetterQueue = require("../queues/deadLetter.queue");
const { log } = require('../utils/logger');

const orderWorker = new Worker(
  "order-processing",

  async (job) => {
    const { orderId } = job.data;

    log('INFO', 'Processing order',
      {
        orderId,
        jobId: job.id
      }
    );

    const existingOrder = await orderRepository.findById(orderId);

    // idempotency check
    if (existingOrder.status === OrderStatus.SHIPPED) {
      log('INFO', 'Order already processed',
        {
          orderId,
          jobId: job.id
        }
      );

      return;
    }

    await orderRepository.updateStatus(orderId, OrderStatus.PROCESSING);

    // simulate temporary failure
    const shouldFail = Math.random() < 0.5;

    if (shouldFail) {
      console.log(`Temporary failure for order: ${orderId}`);

      throw new RetryableError("Temporary processing failure");
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));

    await orderRepository.updateStatus(orderId, OrderStatus.SHIPPED);

    console.log(`Order shipped: ${orderId}`);
  },

  {
    connection: redisConnection,
    concurrency: 5
  },
);

orderWorker.on(
  "failed",

  async (job, err) => {
    log('ERROR', 'Job failed for order',
      {
        orderId: job.data.orderId,
        jobId: job.id,
        error: err.message
      }
    );

    if (job.attemptsMade === job.opts.attempts) {
      await orderRepository.updateStatus(job.data.orderId, OrderStatus.FAILED);
      await deadLetterQueue.add(
        "failed-order",
        
        {
          orderId: job.data.orderId,
          
          reason: err.message,
          
          failedAt: new Date().toISOString(),
          
          attempts: job.attemptsMade,
        },
      );
      console.log(`Order permanently failed: ${job.data.orderId}`);
      console.log(`Moved job to dead letter queue`);
    }
  },
);

module.exports = orderWorker;
