const { Server } = require('socket.io');
const { verifyAccessToken } = require('../utils/tokenUtils');
const eventBus = require('../events/eventBus');

let ioInstance = null;

/**
 * Initializes Socket.IO with JWT authentication middleware and bridges
 * internal EventEmitter events to real-time Socket.IO room notifications.
 */
const initSocket = (httpServer) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || '*',
      methods: ['GET', 'POST'],
    },
  });

  // Authenticate every Socket.IO connection using JWT
  ioInstance.use((socket, next) => {
    try {
      const authHeader = socket.handshake.headers?.authorization;
      const token =
        socket.handshake.auth?.token ||
        (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);

      if (!token) {
        return next(new Error('Authentication error: JWT token is required'));
      }

      const decoded = verifyAccessToken(token);
      socket.user = {
        id: decoded.id,
        role: decoded.role,
        email: decoded.email,
      };
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  ioInstance.on('connection', (socket) => {
    const { id, role, email } = socket.user;
    console.log(`[SOCKET] Connected: ${email} (${role}) | Socket ID: ${socket.id}`);

    // Join personal room and role room
    socket.join(`user:${id}`);
    socket.join(`role:${role}`);

    socket.emit('connected', {
      message: 'Connected to E-Commerce Real-Time Notification Service',
      userId: id,
      role,
    });

    socket.on('disconnect', (reason) => {
      console.log(`[SOCKET] Disconnected: ${email} | Reason: ${reason}`);
    });
  });

  // Bridge EventEmitter events to Socket.IO rooms
  eventBus.on('order:placed', (payload) => {
    // Notify customer
    ioInstance.to(`user:${payload.customerId}`).emit('order:created', {
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      totalAmount: payload.totalAmount,
      status: payload.status,
      timestamp: new Date().toISOString(),
    });

    // Notify each involved seller
    payload.sellerIds.forEach((sellerId) => {
      ioInstance.to(`user:${sellerId}`).emit('seller:newOrder', {
        orderId: payload.orderId,
        orderNumber: payload.orderNumber,
        totalAmount: payload.totalAmount,
        timestamp: new Date().toISOString(),
      });
    });

    // Notify all admins
    ioInstance.to('role:admin').emit('admin:newOrder', {
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      totalAmount: payload.totalAmount,
      timestamp: new Date().toISOString(),
    });
  });

  eventBus.on('order:statusUpdated', (payload) => {
    ioInstance.to(`user:${payload.customerId}`).emit('order:statusChanged', {
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      previousStatus: payload.previousStatus,
      newStatus: payload.newStatus,
      note: payload.note,
      timestamp: new Date().toISOString(),
    });
  });

  eventBus.on('order:cancelled', (payload) => {
    ioInstance.to(`user:${payload.customerId}`).emit('order:cancelled', {
      orderId: payload.orderId,
      orderNumber: payload.orderNumber,
      timestamp: new Date().toISOString(),
    });

    payload.sellerIds.forEach((sellerId) => {
      ioInstance.to(`user:${sellerId}`).emit('seller:orderCancelled', {
        orderId: payload.orderId,
        orderNumber: payload.orderNumber,
        timestamp: new Date().toISOString(),
      });
    });
  });

  eventBus.on('inventory:lowStock', (payload) => {
    const alertData = {
      productId: payload.productId,
      productName: payload.productName,
      sku: payload.sku,
      remainingStock: payload.remainingStock,
      threshold: payload.threshold,
      timestamp: new Date().toISOString(),
    };

    ioInstance.to(`user:${payload.sellerId}`).emit('inventory:lowStockAlert', alertData);
    ioInstance.to('role:admin').emit('inventory:lowStockAlert', alertData);
  });

  return ioInstance;
};

const getIO = () => ioInstance;

module.exports = { initSocket, getIO };
