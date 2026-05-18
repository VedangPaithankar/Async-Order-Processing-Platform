const prisma = require("../utils/prisma");

exports.create = async (order) => {
  return prisma.order.create({
    data: order,
  });
};

exports.findById = async (id) => {
  return prisma.order.findUnique({
    where: { id },
  });
};

exports.findByUser = async (userId) => {
  return prisma.order.findMany({
    where: { userId },
  });
};

exports.updateStatus = async (id, status) => {
  return prisma.order.update({
    where: { id },

    data: { status },
  });
};

exports.delete = async (id) => {
  return prisma.order.delete({
    where: { id },
  });
};
