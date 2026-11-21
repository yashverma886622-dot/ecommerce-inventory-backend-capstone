const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticate, authorizeRoles } = require('../middleware/authMiddleware');

router.use(authenticate, authorizeRoles('seller', 'admin'));

router.get('/sales-summary', reportController.getSalesSummary);
router.get('/best-selling', reportController.getBestSellingProducts);
router.get('/inventory-summary', reportController.getInventorySummary);

module.exports = router;
