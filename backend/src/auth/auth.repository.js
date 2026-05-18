const prisma = require('../utils/prisma');

exports.findByEmail = async (email) => {

  return await prisma.user.findUnique({
    where: { email }
  });
};

exports.createUser = async (userData) => {

  return await prisma.user.create({
    data: userData
  });
};