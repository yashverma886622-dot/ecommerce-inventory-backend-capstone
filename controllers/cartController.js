const Cart = require('../models/Cart');
const Product = require('../models/Product');
const AppError = require('../utils/AppError');

/**
 * Helper: formats cart with server-computed line totals and grand total.
 */
const buildCartResponse = async (customerId) => {
  let cart = await Cart.findOne({ customer: customerId }).populate({
    path: 'items.product',
    select: 'name sku price stock isActive seller',
  });

  if (!cart) {
    cart = await Cart.create({ customer: customerId, items: [] });
  }

  let totalAmount = 0;
  const formattedItems = [];

  for (const item of cart.items) {
    if (!item.product) continue;
    const lineTotal = Number((item.product.price * item.quantity).toFixed(2));
    totalAmount += lineTotal;
    formattedItems.push({
      productId: item.product._id,
      name: item.product.name,
      sku: item.product.sku,
      unitPrice: item.product.price,
      availableStock: item.product.stock,
      quantity: item.quantity,
      lineTotal,
    });
  }

  return {
    cartId: cart._id,
    items: formattedItems,
    itemCount: formattedItems.reduce((acc, i) => acc + i.quantity, 0),
    totalAmount: Number(totalAmount.toFixed(2)),
  };
};

const getCart = async (req, res, next) => {
  try {
    const data = await buildCartResponse(req.user._id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

const addToCart = async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;

    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return next(new AppError('Product not found or inactive.', 404));
    }

    let cart = await Cart.findOne({ customer: req.user._id });
    if (!cart) {
      cart = new Cart({ customer: req.user._id, items: [] });
    }

    const existingItem = cart.items.find(
      (item) => item.product.toString() === productId
    );
    const desiredQty = existingItem ? existingItem.quantity + quantity : quantity;

    if (desiredQty > product.stock) {
      return next(
        new AppError(
          `Insufficient stock for '${product.name}'. Available: ${product.stock}, Requested: ${desiredQty}.`,
          400
        )
      );
    }

    if (existingItem) {
      existingItem.quantity = desiredQty;
    } else {
      cart.items.push({ product: productId, quantity });
    }

    await cart.save();
    const data = await buildCartResponse(req.user._id);

    res.status(200).json({
      success: true,
      message: 'Item added to cart.',
      data,
    });
  } catch (err) {
    next(err);
  }
};

const updateCartItem = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { quantity } = req.body;

    if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) {
      return next(new AppError('Quantity must be a positive integer (>= 1).', 400));
    }

    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return next(new AppError('Product not found or inactive.', 404));
    }

    if (quantity > product.stock) {
      return next(
        new AppError(
          `Insufficient stock for '${product.name}'. Available: ${product.stock}.`,
          400
        )
      );
    }

    const cart = await Cart.findOne({ customer: req.user._id });
    if (!cart) {
      return next(new AppError('Cart not found.', 404));
    }

    const item = cart.items.find((i) => i.product.toString() === productId);
    if (!item) {
      return next(new AppError('Product is not in your cart.', 404));
    }

    item.quantity = quantity;
    await cart.save();

    const data = await buildCartResponse(req.user._id);
    res.status(200).json({
      success: true,
      message: 'Cart item updated.',
      data,
    });
  } catch (err) {
    next(err);
  }
};

const removeCartItem = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const cart = await Cart.findOne({ customer: req.user._id });
    if (!cart) {
      return next(new AppError('Cart not found.', 404));
    }

    const originalLen = cart.items.length;
    cart.items = cart.items.filter((i) => i.product.toString() !== productId);

    if (cart.items.length === originalLen) {
      return next(new AppError('Product is not in your cart.', 404));
    }

    await cart.save();
    const data = await buildCartResponse(req.user._id);

    res.status(200).json({
      success: true,
      message: 'Item removed from cart.',
      data,
    });
  } catch (err) {
    next(err);
  }
};

const clearCart = async (req, res, next) => {
  try {
    await Cart.findOneAndUpdate(
      { customer: req.user._id },
      { $set: { items: [] } },
      { upsert: true }
    );
    res.status(200).json({
      success: true,
      message: 'Cart cleared.',
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
};
