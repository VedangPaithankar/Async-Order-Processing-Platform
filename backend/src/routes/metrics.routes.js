const router = require('express').Router();

const metricsController= require('../controllers/metrics.controller');

router.get('/', metricsController.getMetrics);

module.exports = router;