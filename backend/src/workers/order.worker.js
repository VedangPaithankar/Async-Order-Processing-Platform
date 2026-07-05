const { Worker } = require("bullmq");

const redisConnection = require("../utils/redis");
const orderRepository = require("../repositories/order.repository");
const { OrderStatus } = require("../models/order.model");
const RetryableError = require("../errors/retryable.error");
const deadLetterQueue = require("../queues/deadLetter.queue");
const { log } = require('../utils/logger');

const STATUS_STEP_DELAY_MS = 20000;

const orderWorker = new Worker(
  "order-processing",

  async (job) => {
    const { orderId } = job.data;

    log('INFO', 'Preparing cafe order',
      {
        orderId,
        jobId: job.id
      }
    );

    const existingOrder = await orderRepository.findById(orderId);

    // idempotency check
    if (!existingOrder) {
      log('ERROR', 'Order missing for queue job', {
        orderId,
        jobId: job.id
      });

      return;
    }

    if (
      existingOrder.status === OrderStatus.READY ||
      existingOrder.status === OrderStatus.COMPLETED
    ) {
      log('INFO', 'Cafe order already prepared',
        {
          orderId,
          jobId: job.id
        }
      );

      return;
    }

    await orderRepository.updateStatus(orderId, OrderStatus.QUEUED);
    await new Promise((resolve) => setTimeout(resolve, STATUS_STEP_DELAY_MS));
    await orderRepository.updateStatus(orderId, OrderStatus.PREPARING);

    // Keep failure simulation opt-in so the prototype behaves like a product by default.
    const shouldFail =
      process.env.SIMULATE_ORDER_FAILURES === "true" && Math.random() < 0.35;

    if (shouldFail) {
      log('ERROR', 'Temporary cafe prep failure', {
        orderId,
        jobId: job.id
      });

      throw new RetryableError("Temporary processing failure");
    }

    await new Promise((resolve) => setTimeout(resolve, STATUS_STEP_DELAY_MS));

    await orderRepository.updateStatus(orderId, OrderStatus.READY);

    log('INFO', 'Cafe order ready', {
      orderId,
      jobId: job.id
    });
  },

  {
    connection: redisConnection,
    concurrency: 5
  },
);

orderWorker.on(
  "failed",

  async (job, err) => {
    log('ERROR', 'Cafe order job failed',
      {
        orderId: job.data.orderId,
        jobId: job.id,
        error: err.message
      }
    );

    if (job.attemptsMade === job.opts.attempts) {
      await orderRepository.updateStatus(job.data.orderId, OrderStatus.FAILED);
      await deadLetterQueue.add(
        "failed-cafe-order",
        
        {
          orderId: job.data.orderId,
          
          reason: err.message,
          
          failedAt: new Date().toISOString(),
          
          attempts: job.attemptsMade,
        },
      );
      log('ERROR', 'Cafe order moved to dead letter queue', {
        orderId: job.data.orderId,
        jobId: job.id
      });
    }
  },
);

module.exports = orderWorker;
