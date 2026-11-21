const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, authorizeRoles } = require('../middleware/authMiddleware');
const { validateObjectIdParam } = require('../middleware/validateMiddleware');

router.get('/me', authenticate, userController.getMyProfile);
router.patch('/me', authenticate, userController.updateMyProfile);

// Admin-only user management
router.get('/', authenticate, authorizeRoles('admin'), userController.getAllUsers);
router.patch(
  '/:id',
  authenticate,
  authorizeRoles('admin'),
  validateObjectIdParam('id'),
  userController.updateUserByAdmin
);

module.exports = router;
