const orderRepository = require("../repositories/order.repository");

const orderQueue = require("../queues/order.queue");

const {
  OrderStatus,
  FulfillmentType,
  PaymentMethod,
} = require("../models/order.model");

const NotFoundError = require("../errors/notFound.error");
const ValidationError = require("../errors/validation.error");

const { log } = require("../utils/logger");
const {
  getMenuItemById,
  modifierOptions,
} = require("../data/menu.data");

const GST_RATE = 0.05;
const DELIVERY_FEE = 40;
const DEFAULT_MODIFIERS = {
  size: "12oz",
  milk: "regular",
  espresso: "standard",
  sweetener: "white-sugar",
  addons: [],
};

const getOption = (group, id) => {
  const option = modifierOptions[group].find((item) => item.id === id);

  if (!option) {
    throw new ValidationError(`Invalid ${group} option`);
  }

  return option;
};

const normalizeQuantity = (quantity) => {
  const normalized = Number(quantity);

  if (!Number.isInteger(normalized) || normalized < 1 || normalized > 10) {
    throw new ValidationError("Quantity must be between 1 and 10");
  }

  return normalized;
};

const buildModifiers = (menuItem, modifiers = {}) => {
  if (!menuItem.customizable) {
    return {
      selected: {},
      price: 0,
    };
  }

  const selectedIds = {
    ...DEFAULT_MODIFIERS,
    ...modifiers,
    addons: Array.isArray(modifiers.addons) ? modifiers.addons : [],
  };

  const selected = {
    size: getOption("size", selectedIds.size),
    milk: getOption("milk", selectedIds.milk),
    espresso: getOption("espresso", selectedIds.espresso),
    sweetener: getOption("sweetener", selectedIds.sweetener),
    addons: selectedIds.addons.map((addonId) => getOption("addons", addonId)),
  };

  const price =
    selected.size.price +
    selected.milk.price +
    selected.espresso.price +
    selected.sweetener.price +
    selected.addons.reduce((sum, addon) => sum + addon.price, 0);

  return {
    selected,
    price,
  };
};

const buildOrderItems = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ValidationError("Cart must contain at least one item");
  }

  return items.map((cartItem) => {
    const menuItem = getMenuItemById(cartItem.menuItemId);

    if (!menuItem) {
      throw new ValidationError("Invalid menu item");
    }

    const quantity = normalizeQuantity(cartItem.quantity);
    const modifiers = buildModifiers(menuItem, cartItem.modifiers);
    const unitPrice = menuItem.price + modifiers.price;
    const lineTotal = unitPrice * quantity;

    return {
      menuItemId: menuItem.id,
      name: menuItem.name,
      quantity,
      unitPrice,
      modifiers: modifiers.selected,
      lineTotal,
    };
  });
};

const validateContact = ({ customerName, customerPhone, customerEmail }) => {
  if (!customerName || customerName.trim().length < 2) {
    throw new ValidationError("Customer name is required");
  }

  if (!customerPhone || !/^[0-9]{10}$/.test(customerPhone.trim())) {
    throw new ValidationError("A valid 10 digit phone number is required");
  }

  if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    throw new ValidationError("A valid email is required");
  }
};

const normalizeEnum = (value, allowedValues, fallback) => {
  if (!value) {
    return fallback;
  }

  if (!allowedValues.includes(value)) {
    throw new ValidationError("Invalid checkout option");
  }

  return value;
};

exports.createOrder = async ({
  userId,
  customerName,
  customerEmail,
  customerPhone,
  fulfillment,
  paymentMethod,
  tip,
  notes,
  items,
}) => {
  if (!userId) {
    throw new ValidationError("Please login before placing an order");
  }

  validateContact({ customerName, customerPhone, customerEmail });

  const orderItems = buildOrderItems(items);
  const normalizedFulfillment = normalizeEnum(
    fulfillment,
    Object.values(FulfillmentType),
    FulfillmentType.PICKUP,
  );
  const normalizedPaymentMethod = normalizeEnum(
    paymentMethod,
    Object.values(PaymentMethod),
    PaymentMethod.UPI_GPAY,
  );
  const normalizedTip = Math.max(0, Math.round(Number(tip) || 0));
  const subtotal = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const gst = Math.round(subtotal * GST_RATE);
  const deliveryFee =
    normalizedFulfillment === FulfillmentType.DELIVERY ? DELIVERY_FEE : 0;
  const total = subtotal + gst + normalizedTip + deliveryFee;

  const order = await orderRepository.create({
    userId: userId || null,
    customerName: customerName.trim(),
    customerEmail: customerEmail ? customerEmail.trim() : null,
    customerPhone: customerPhone.trim(),
    fulfillment: normalizedFulfillment,
    paymentMethod: normalizedPaymentMethod,
    status: OrderStatus.RECEIVED,
    subtotal,
    gst,
    tip: normalizedTip,
    deliveryFee,
    total,
    notes: notes ? notes.trim() : null,
    etaMinutes: normalizedFulfillment === FulfillmentType.DELIVERY ? 30 : 18,
    items: {
      create: orderItems,
    },
  });

  await orderQueue.add(
    "prepare-cafe-order",

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

  log("INFO", "Cafe order received", {
    orderId: order.id,
    itemCount: orderItems.length,
    total,
    fulfillment: normalizedFulfillment,
  });

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

exports.getPublicOrder = async (id) => {
  const order = await orderRepository.findById(id);

  if (!order) {
    throw new NotFoundError("Order not found");
  }

  return order;
};

exports.getRecentOrders = async () => {
  return orderRepository.findRecent();
};

exports.markPickedUp = async (id, userId) => {
  const order = await orderRepository.findById(id);

  if (!order || order.userId !== userId) {
    throw new NotFoundError("Order not found");
  }

  if (order.status !== OrderStatus.READY) {
    throw new ValidationError("Order can be picked up only when it is ready");
  }

  const updatedOrder = await orderRepository.updateStatus(
    id,
    OrderStatus.COMPLETED,
  );

  log("INFO", "Cafe order picked up", {
    orderId: id,
    userId,
  });

  return updatedOrder;
};
