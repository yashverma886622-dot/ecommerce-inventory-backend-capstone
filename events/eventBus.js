const EventEmitter = require('events');

/**
 * Application-wide EventEmitter used to decouple core business logic
 * (order placement, status updates, cancellations, stock drops)
 * from side effects like audit logging and Socket.IO notifications.
 */
class AppEventBus extends EventEmitter {}

const eventBus = new AppEventBus();

// Register internal logging listeners
eventBus.on('order:placed', (payload) => {
  console.log(
    `[EVENT order:placed] Order ${payload.orderNumber} placed by customer ${payload.customerId} | Total: INR ${payload.totalAmount}`
  );
});

eventBus.on('order:statusUpdated', (payload) => {
  console.log(
    `[EVENT order:statusUpdated] Order ${payload.orderNumber} changed from ${payload.previousStatus} -> ${payload.newStatus}`
  );
});

eventBus.on('order:cancelled', (payload) => {
  console.log(
    `[EVENT order:cancelled] Order ${payload.orderNumber} cancelled by ${payload.cancelledBy} | Stock restored`
  );
});

eventBus.on('inventory:lowStock', (payload) => {
  console.warn(
    `[EVENT inventory:lowStock] Product "${payload.productName}" (SKU: ${payload.sku}) is low on stock: ${payload.remainingStock} left (Threshold: ${payload.threshold})`
  );
});

module.exports = eventBus;
