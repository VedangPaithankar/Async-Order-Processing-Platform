const express = require("express");
const cors = require("cors");

const app = express();
const authRoutes = require("./src/auth/auth.routes");
const orderRoutes = require("./src/routes/order.routes");
const errorMiddleware = require("./src/middleware/error.middleware");
const metricsRoutes = require("./src/routes/metrics.routes");
const menuRoutes = require("./src/routes/menu.routes");
const healthRoutes = require("./src/routes/health.routes");

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },

    credentials: true,
  }),
);

app.use(express.json());

app.use("/health", healthRoutes);

app.use("/auth", authRoutes);

app.use("/menu", menuRoutes);

app.use("/orders", orderRoutes);

app.use('/metrics', metricsRoutes);

app.use(errorMiddleware);

module.exports = app;
