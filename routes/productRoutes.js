const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticate, authorizeRoles } = require('../middleware/authMiddleware');
const {
  validateObjectIdParam,
  validateProduct,
} = require('../middleware/validateMiddleware');

router.get('/', productController.getProducts);
router.get('/:id', validateObjectIdParam('id'), productController.getProductById);

// Seller and Admin product management
router.post(
  '/',
  authenticate,
  authorizeRoles('seller', 'admin'),
  validateProduct(false),
  productController.createProduct
);
router.patch(
  '/:id',
  authenticate,
  authorizeRoles('seller', 'admin'),
  validateObjectIdParam('id'),
  validateProduct(true),
  productController.updateProduct
);
router.delete(
  '/:id',
  authenticate,
  authorizeRoles('seller', 'admin'),
  validateObjectIdParam('id'),
  productController.deleteProduct
);

module.exports = router;
