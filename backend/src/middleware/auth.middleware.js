const jwt = require("jsonwebtoken");

const AuthenticationError = require("../errors/authentication.error");

module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new AuthenticationError("Missing token");
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,

      process.env.JWT_SECRET,
    );

    req.user = decoded;

    next();
  } catch (err) {
    next(new AuthenticationError("Invalid token"));
  }
};
