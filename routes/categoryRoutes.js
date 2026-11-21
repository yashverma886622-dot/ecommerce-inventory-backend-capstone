const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { authenticate, authorizeRoles } = require('../middleware/authMiddleware');
const { validateObjectIdParam } = require('../middleware/validateMiddleware');

router.get('/', categoryController.getAllCategories);
router.get('/:id', validateObjectIdParam('id'), categoryController.getCategoryById);

// Admin-only category management
router.post('/', authenticate, authorizeRoles('admin'), categoryController.createCategory);
router.patch(
  '/:id',
  authenticate,
  authorizeRoles('admin'),
  validateObjectIdParam('id'),
  categoryController.updateCategory
);
router.delete(
  '/:id',
  authenticate,
  authorizeRoles('admin'),
  validateObjectIdParam('id'),
  categoryController.deleteCategory
);

module.exports = router;
