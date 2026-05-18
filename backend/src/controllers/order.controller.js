const orderService = require("../services/order.service");

exports.createOrder = async (req, res, next) => {
  try {
    const order = await orderService.createOrder({
      userId: req.user.id,

      amount: req.body.amount,
    });

    res
      .status(201)

      .json(order);
  } catch (err) {
    next(err);
  }
};

exports.getOrders = async (req, res, next) => {
  try {
    const orders = await orderService.getMyOrders(req.user.id);

    res.json(orders);
  } catch (err) {
    next(err);
  }
};

exports.getOrder = async (req, res, next) => {
  try {
    const order = await orderService.getOrder(
      req.params.id,

      req.user.id,
    );

    res.json(order);
  } catch (err) {
    next(err);
  }
};
