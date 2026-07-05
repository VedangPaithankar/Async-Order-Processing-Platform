const router = require("express").Router();

const menuController = require("../controllers/menu.controller");

router.get("/", menuController.getMenu);

module.exports = router;
