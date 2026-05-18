const orderRepository = require("../repositories/order.repository");

const orderQueue = require("../queues/order.queue");

const { OrderStatus } = require("../models/order.model");

const NotFoundError = require("../errors/notFound.error");

const { log } = require("../utils/logger");

exports.createOrder = async ({ userId, amount }) => {
  const order = await orderRepository.create({
    userId,

    amount,

    status: OrderStatus.PLACED,
  });

  await orderQueue.add(
    "process-order",

    {
      orderId: order.id,
    },

    {
      attempts: 3,

      backoff: {
        type: "exponential",

        delay: 2000,
      },
    },
  );

  log(
    "INFO",

    "Order Created",

    {
      orderId: order.id,

      userId,
    },
  );

  return order;
};

exports.getMyOrders = async (userId) => {
  return await orderRepository.findByUser(userId);
};

exports.getOrder = async (id, userId) => {
  const order = await orderRepository.findById(id);

  if (!order || order.userId !== userId) {
    throw new NotFoundError("Order not found");
  }

  return order;
};
