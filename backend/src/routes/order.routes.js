const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/auth.middleware");

const orderController = require("../controllers/order.controller");

router.use(authMiddleware);

router.post("/", orderController.createOrder);
router.get("/", orderController.getOrders);
router.get("/:id", orderController.getOrder);

module.exports = router;
