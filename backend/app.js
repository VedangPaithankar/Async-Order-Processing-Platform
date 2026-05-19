const express = require("express");
const cors = require("cors");

const app = express();
const authRoutes = require("./src/auth/auth.routes");
const orderRoutes = require("./src/routes/order.routes");
const errorMiddleware = require("./src/middleware/error.middleware");
const metricsRoutes = require("./src/routes/metrics.routes");

app.use(
  cors({
    origin: "http://localhost:5173",

    credentials: true,
  }),
);

app.use(express.json());

app.use("/auth", authRoutes);

app.use("/orders", orderRoutes);

app.use('/metrics', metricsRoutes);

app.use(errorMiddleware);

module.exports = app;
