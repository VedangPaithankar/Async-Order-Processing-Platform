const prisma = require("../utils/prisma");

exports.create = async (order) => {
  return prisma.order.create({
    data: order,
    include: {
      items: true,
    },
  });
};

exports.findById = async (id) => {
  return prisma.order.findUnique({
    where: { id },
    include: {
      items: true,
    },
  });
};

exports.findByUser = async (userId) => {
  return prisma.order.findMany({
    where: { userId },
    include: {
      items: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

exports.findRecent = async () => {
  return prisma.order.findMany({
    include: {
      items: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
  });
};

exports.updateStatus = async (id, status) => {
  return prisma.order.update({
    where: { id },

    data: { status },

    include: {
      items: true,
    },
  });
};

exports.delete = async (id) => {
  return prisma.order.delete({
    where: { id },
  });
};
