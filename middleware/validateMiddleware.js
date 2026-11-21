const mongoose = require('mongoose');
const AppError = require('../utils/AppError');

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const validateObjectIdParam = (paramName = 'id') => (req, res, next) => {
  const value = req.params[paramName];
  if (!isValidObjectId(value)) {
    return next(new AppError(`Invalid MongoDB ObjectId for parameter '${paramName}'.`, 400));
  }
  next();
};

const validateRegister = (req, res, next) => {
  const { name, email, password, role } = req.body;
  const errors = [];

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    errors.push('Name is required and must be at least 2 characters.');
  }
  if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
    errors.push('A valid email address is required.');
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    errors.push('Password is required and must be at least 6 characters.');
  }
  if (role && !['customer', 'seller'].includes(role)) {
    errors.push("Public registration only allows 'customer' or 'seller' roles.");
  }

  if (errors.length > 0) {
    return next(new AppError('Validation failed', 400, errors));
  }
  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    errors.push('A valid email is required.');
  }
  if (!password) {
    errors.push('Password is required.');
  }

  if (errors.length > 0) {
    return next(new AppError('Validation failed', 400, errors));
  }
  next();
};

const validateProduct = (isUpdate = false) => (req, res, next) => {
  const { name, sku, description, price, category, stock, lowStockThreshold } = req.body;
  const errors = [];

  if (!isUpdate || name !== undefined) {
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      errors.push('Product name must be at least 2 characters.');
    }
  }
  if (!isUpdate || sku !== undefined) {
    if (!sku || typeof sku !== 'string' || sku.trim().length < 2) {
      errors.push('Product SKU is required.');
    }
  }
  if (!isUpdate || description !== undefined) {
    if (!description || typeof description !== 'string' || description.trim().length < 5) {
      errors.push('Product description must be at least 5 characters.');
    }
  }
  if (!isUpdate || price !== undefined) {
    if (typeof price !== 'number' || Number.isNaN(price) || price < 0) {
      errors.push('Price must be a non-negative number.');
    }
  }
  if (!isUpdate || category !== undefined) {
    if (!category || !isValidObjectId(category)) {
      errors.push('A valid category ObjectId is required.');
    }
  }
  if (!isUpdate || stock !== undefined) {
    if (typeof stock !== 'number' || !Number.isInteger(stock) || stock < 0) {
      errors.push('Stock must be a non-negative integer.');
    }
  }
  if (lowStockThreshold !== undefined) {
    if (typeof lowStockThreshold !== 'number' || !Number.isInteger(lowStockThreshold) || lowStockThreshold < 0) {
      errors.push('lowStockThreshold must be a non-negative integer.');
    }
  }

  if (errors.length > 0) {
    return next(new AppError('Product validation failed', 400, errors));
  }
  next();
};

const validateCartItem = (req, res, next) => {
  const { productId, quantity } = req.body;
  const errors = [];

  if (!productId || !isValidObjectId(productId)) {
    errors.push('A valid productId is required.');
  }
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) {
    errors.push('Quantity must be a positive integer (>= 1).');
  }

  if (errors.length > 0) {
    return next(new AppError('Cart validation failed', 400, errors));
  }
  next();
};

const validateOrderCreate = (req, res, next) => {
  const { shippingAddress, paymentMethod } = req.body;
  const errors = [];

  if (!shippingAddress || typeof shippingAddress !== 'object') {
    errors.push('shippingAddress object is required.');
  } else {
    if (!shippingAddress.street) errors.push('shippingAddress.street is required.');
    if (!shippingAddress.city) errors.push('shippingAddress.city is required.');
    if (!shippingAddress.state) errors.push('shippingAddress.state is required.');
    if (!shippingAddress.postalCode) errors.push('shippingAddress.postalCode is required.');
  }

  if (
    paymentMethod &&
    !['SIMULATED_CARD', 'SIMULATED_UPI', 'SIMULATED_COD'].includes(paymentMethod)
  ) {
    errors.push('paymentMethod must be SIMULATED_CARD, SIMULATED_UPI, or SIMULATED_COD.');
  }

  if (errors.length > 0) {
    return next(new AppError('Order validation failed', 400, errors));
  }
  next();
};

module.exports = {
  validateObjectIdParam,
  validateRegister,
  validateLogin,
  validateProduct,
  validateCartItem,
  validateOrderCreate,
};
