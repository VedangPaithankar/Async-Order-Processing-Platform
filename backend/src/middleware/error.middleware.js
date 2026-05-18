const { log } = require("../utils/logger");

module.exports = (err, req, res, next) => {
  log(
    "ERROR",

    err.message,

    {
      path: req.path,

      method: req.method,

      errorType: err.name,
    },
  );

  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  if (err.name === "AuthenticationError") {
    return res.status(401).json({
      success: false,
      message: err.message,
    });
  }

  if (err.name === "NotFoundError") {
    return res.status(404).json({
      success: false,
      message: err.message,
    });
  }

  return res.status(500).json({
    success: false,
    message: "Internal Server Error",
  });
};
