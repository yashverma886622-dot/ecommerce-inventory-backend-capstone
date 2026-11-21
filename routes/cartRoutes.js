const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { authenticate, authorizeRoles } = require('../middleware/authMiddleware');
const {
  validateCartItem,
  validateObjectIdParam,
} = require('../middleware/validateMiddleware');

// Cart routes are strictly for authenticated customers
router.use(authenticate, authorizeRoles('customer'));

router.get('/', cartController.getCart);
router.post('/items', validateCartItem, cartController.addToCart);
router.patch('/items/:productId', validateObjectIdParam('productId'), cartController.updateCartItem);
router.delete('/items/:productId', validateObjectIdParam('productId'), cartController.removeCartItem);
router.delete('/', cartController.clearCart);

module.exports = router;
