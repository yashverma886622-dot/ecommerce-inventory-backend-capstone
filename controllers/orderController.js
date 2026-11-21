const crypto = require('crypto');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Product = require('../models/Product');
const AppError = require('../utils/AppError');
const eventBus = require('../events/eventBus');

// Allowed state machine transitions for order status
const ALLOWED_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

/**
 * POST /api/orders
 * Converts customer's cart into an Order using atomic stock deductions
 * so concurrent requests can never push stock below zero.
 */
const createOrder = async (req, res, next) => {
  const deductedItems = []; // Track deductions for rollback if a later item fails

  try {
    const { shippingAddress, paymentMethod = 'SIMULATED_UPI' } = req.body;

    const cart = await Cart.findOne({ customer: req.user._id });
    if (!cart || cart.items.length === 0) {
      return next(new AppError('Your cart is empty. Add items before placing an order.', 400));
    }

    const orderItems = [];
    const lowStockProducts = [];
    let totalAmount = 0;

    // Atomically validate and deduct stock for each item
    for (const cartItem of cart.items) {
      const updatedProduct = await Product.findOneAndUpdate(
        {
          _id: cartItem.product,
          isActive: true,
          stock: { $gte: cartItem.quantity },
        },
        { $inc: { stock: -cartItem.quantity } },
        { new: true }
      );

      if (!updatedProduct) {
        // Rollback previously deducted items in this order
        for (const item of deductedItems) {
          await Product.findByIdAndUpdate(item.productId, {
            $inc: { stock: item.quantity },
          });
        }
        return next(
          new AppError(
            `Order failed: insufficient stock or unavailable product (${cartItem.product}).`,
            409
          )
        );
      }

      deductedItems.push({
        productId: updatedProduct._id,
        quantity: cartItem.quantity,
      });

      const subtotal = Number((updatedProduct.price * cartItem.quantity).toFixed(2));
      totalAmount += subtotal;

      orderItems.push({
        product: updatedProduct._id,
        seller: updatedProduct.seller,
        nameSnapshot: updatedProduct.name,
        priceSnapshot: updatedProduct.price,
        quantity: cartItem.quantity,
        subtotal,
      });

      if (updatedProduct.stock <= updatedProduct.lowStockThreshold) {
        lowStockProducts.push(updatedProduct);
      }
    }

    const orderNumber = `ORD-${Date.now()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const transactionId = `SIM-TXN-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const order = await Order.create({
      orderNumber,
      customer: req.user._id,
      items: orderItems,
      totalAmount: Number(totalAmount.toFixed(2)),
      shippingAddress,
      payment: {
        method: paymentMethod,
        status: paymentMethod === 'SIMULATED_COD' ? 'SIMULATED_PENDING' : 'SIMULATED_PAID',
        isSimulated: true,
        transactionId,
      },
      status: 'pending',
      statusHistory: [
        {
          status: 'pending',
          updatedBy: req.user._id,
          note: 'Order placed with simulated payment.',
        },
      ],
    });

    // Clear customer cart after successful order creation
    cart.items = [];
    await cart.save();

    // Emit decoupled internal events (bridged to Socket.IO & logging)
    const sellerIds = [...new Set(orderItems.map((i) => i.seller.toString()))];
    eventBus.emit('order:placed', {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      customerId: req.user._id.toString(),
      sellerIds,
      totalAmount: order.totalAmount,
      status: order.status,
    });

    for (const prod of lowStockProducts) {
      eventBus.emit('inventory:lowStock', {
        productId: prod._id.toString(),
        productName: prod.name,
        sku: prod.sku,
        sellerId: prod.seller.toString(),
        remainingStock: prod.stock,
        threshold: prod.lowStockThreshold,
      });
    }

    res.status(201).json({
      success: true,
      message: 'Order placed successfully (Payment Simulated).',
      data: order,
    });
  } catch (err) {
    // Safety rollback if Order.create fails unexpectedly
    for (const item of deductedItems) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.quantity },
      });
    }
    next(err);
  }
};

/**
 * GET /api/orders
 * Customer sees own orders; Seller sees orders containing their products; Admin sees all.
 */
const getOrders = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const filter = {};

    if (req.user.role === 'customer') {
      filter.customer = req.user._id;
    } else if (req.user.role === 'seller') {
      filter['items.seller'] = req.user._id;
    }
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('customer', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Order.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
      data: orders,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/orders/:id
 * Enforces ownership/role checks so customers cannot view other customers' orders.
 */
const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customer', 'name email')
      .populate('items.product', 'name sku');

    if (!order) {
      return next(new AppError('Order not found.', 404));
    }

    const isCustomerOwner = order.customer._id.toString() === req.user._id.toString();
    const isInvolvedSeller = order.items.some(
      (i) => i.seller.toString() === req.user._id.toString()
    );

    if (req.user.role === 'customer' && !isCustomerOwner) {
      return next(new AppError('You are not authorized to view this order.', 403));
    }
    if (req.user.role === 'seller' && !isInvolvedSeller) {
      return next(new AppError('You are not authorized to view this order.', 403));
    }

    res.status(200).json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/orders/:id/status
 * Seller (for their orders) or Admin updates order status following business rules.
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const { status: newStatus, note = '' } = req.body;
    if (!newStatus) {
      return next(new AppError('New status is required.', 400));
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return next(new AppError('Order not found.', 404));
    }

    if (req.user.role === 'seller') {
      const isInvolvedSeller = order.items.some(
        (i) => i.seller.toString() === req.user._id.toString()
      );
      if (!isInvolvedSeller) {
        return next(new AppError('You are not authorized to update this order.', 403));
      }
    }

    const allowedNext = ALLOWED_TRANSITIONS[order.status] || [];
    if (!allowedNext.includes(newStatus)) {
      return next(
        new AppError(
          `Invalid status transition from '${order.status}' to '${newStatus}'. Allowed: [${allowedNext.join(', ')}]`,
          400
        )
      );
    }

    const previousStatus = order.status;
    order.status = newStatus;
    order.statusHistory.push({
      status: newStatus,
      updatedBy: req.user._id,
      note,
    });

    // If cancelled via status update, restore stock atomically
    if (newStatus === 'cancelled') {
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.product, {
          $inc: { stock: item.quantity },
        });
      }
      if (order.payment.status === 'SIMULATED_PAID') {
        order.payment.status = 'SIMULATED_REFUNDED';
      }
    }

    await order.save();

    eventBus.emit('order:statusUpdated', {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      customerId: order.customer.toString(),
      previousStatus,
      newStatus,
      note,
    });

    res.status(200).json({
      success: true,
      message: `Order status updated to '${newStatus}'.`,
      data: order,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/orders/:id/cancel
 * Customer (for own pending/confirmed orders) or Admin can cancel an order and restore stock.
 */
const cancelOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return next(new AppError('Order not found.', 404));
    }

    if (
      req.user.role === 'customer' &&
      order.customer.toString() !== req.user._id.toString()
    ) {
      return next(new AppError('You can only cancel your own orders.', 403));
    }

    if (!['pending', 'confirmed'].includes(order.status)) {
      return next(
        new AppError(
          `Cannot cancel order in '${order.status}' state. Only 'pending' or 'confirmed' orders can be cancelled.`,
          400
        )
      );
    }

    // Atomically restore stock for every item
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity },
      });
    }

    order.status = 'cancelled';
    if (order.payment.status === 'SIMULATED_PAID') {
      order.payment.status = 'SIMULATED_REFUNDED';
    }
    order.statusHistory.push({
      status: 'cancelled',
      updatedBy: req.user._id,
      note: req.body.reason || 'Cancelled by user.',
    });

    await order.save();

    const sellerIds = [...new Set(order.items.map((i) => i.seller.toString()))];
    eventBus.emit('order:cancelled', {
      orderId: order._id.toString(),
      orderNumber: order.orderNumber,
      customerId: order.customer.toString(),
      sellerIds,
      cancelledBy: req.user.email,
    });

    res.status(200).json({
      success: true,
      message: 'Order cancelled and inventory restored.',
      data: order,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
};
