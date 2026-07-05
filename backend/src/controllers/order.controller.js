const orderService = require("../services/order.service");

exports.createOrder = async (req, res, next) => {
  try {
    const order = await orderService.createOrder({
      userId: req.user?.id,
      customerName: req.body.customerName,
      customerEmail: req.body.customerEmail,
      customerPhone: req.body.customerPhone,
      fulfillment: req.body.fulfillment,
      paymentMethod: req.body.paymentMethod,
      tip: req.body.tip,
      notes: req.body.notes,
      items: req.body.items,
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
    const orders = req.user
      ? await orderService.getMyOrders(req.user.id)
      : await orderService.getRecentOrders();

    res.json(orders);
  } catch (err) {
    next(err);
  }
};

exports.getOrder = async (req, res, next) => {
  try {
    const order = req.user
      ? await orderService.getOrder(req.params.id, req.user.id)
      : await orderService.getPublicOrder(req.params.id);

    res.json(order);
  } catch (err) {
    next(err);
  }
};

exports.markPickedUp = async (req, res, next) => {
  try {
    const order = await orderService.markPickedUp(
      req.params.id,
      req.user.id,
    );

    res.json(order);
  } catch (err) {
    next(err);
  }
};
