const authService = require("./auth.service");

exports.signup = async (req, res, next) => {
  try {
    const user = await authService.signup(req.body);

    res
      .status(201)

      .json(user);
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);

    res
      .status(200)

      .json(result);
  } catch (err) {
    next(err);
  }
};
