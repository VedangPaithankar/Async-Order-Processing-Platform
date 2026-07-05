const express = require("express");

const router = express.Router();

const authMiddleware = require("../middleware/auth.middleware");

const orderController = require("../controllers/order.controller");

router.post("/", authMiddleware, orderController.createOrder);
router.get("/", authMiddleware, orderController.getOrders);
router.get("/mine", authMiddleware, orderController.getOrders);
router.patch("/:id/pickup", authMiddleware, orderController.markPickedUp);
router.get("/:id", orderController.getOrder);

module.exports = router;
