const createHttpError = require("http-errors");
const jwt = require("jsonwebtoken");

const isAuthenticated = async function (req, res, next) {
  if (!req.headers["authorization"]) {
    return next(createHttpError.Unauthorized());
  }
  const bearerToken = req.headers["authorization"];
  const token = bearerToken.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, payload) => {
    if (err) {
      return next(createHttpError.Unauthorized());
    }
    req.user = payload;
    next();
  });
};

const isUser = async function (req, res, next) {
  if (!req.user || req.user.role !== "user") {
    return next(createHttpError.Unauthorized());
  }
  next();
};

const isAdmin = async function (req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return next(createHttpError.Unauthorized());
  }
  next();
};

module.exports = {
  isAuthenticated,
  isUser,
  isAdmin
};
