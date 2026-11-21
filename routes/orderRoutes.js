const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticate, authorizeRoles } = require('../middleware/authMiddleware');
const {
  validateOrderCreate,
  validateObjectIdParam,
} = require('../middleware/validateMiddleware');

router.use(authenticate);

router.post('/', authorizeRoles('customer'), validateOrderCreate, orderController.createOrder);
router.get('/', orderController.getOrders);
router.get('/:id', validateObjectIdParam('id'), orderController.getOrderById);
router.patch(
  '/:id/status',
  authorizeRoles('seller', 'admin'),
  validateObjectIdParam('id'),
  orderController.updateOrderStatus
);
router.patch(
  '/:id/cancel',
  authorizeRoles('customer', 'admin'),
  validateObjectIdParam('id'),
  orderController.cancelOrder
);

module.exports = router;
