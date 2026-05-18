const bcrypt = require("bcrypt");

const jwt = require("jsonwebtoken");

const authRepository = require("./auth.repository");

const ValidationError = require("../errors/validation.error");

const AuthenticationError = require("../errors/authentication.error");

exports.signup = async ({ email, password, name }) => {
  const existingUser = await authRepository.findByEmail(email);

  if (existingUser) {
    throw new ValidationError("User already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await authRepository.createUser({
    email,

    password: hashedPassword,

    name,
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
  };
};

exports.login = async ({ email, password }) => {
  const user = await authRepository.findByEmail(email);

  if (!user) {
    throw new AuthenticationError("Invalid credentials");
  }

  const validPassword = await bcrypt.compare(
    password,

    user.password,
  );

  if (!validPassword) {
    throw new AuthenticationError("Invalid credentials");
  }

  const token = jwt.sign(
    {
      id: user.id,

      email: user.email,

      role: user.role,
    },

    process.env.JWT_SECRET,

    {
      expiresIn: "1d",
    },
  );

  return {
    token,
  };
};
