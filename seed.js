require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const Category = require('./models/Category');
const Product = require('./models/Product');
const Cart = require('./models/Cart');
const Order = require('./models/Order');

const seedDatabase = async () => {
  try {
    await connectDB();

    console.log('Clearing existing collections...');
    await Promise.all([
      User.deleteMany({}),
      Category.deleteMany({}),
      Product.deleteMany({}),
      Cart.deleteMany({}),
      Order.deleteMany({}),
    ]);

    console.log('Creating users (Admin, Sellers, Customers)...');
    const [admin, seller1, seller2, customer1, customer2] = await User.create([
      {
        name: 'System Admin',
        email: 'admin@ecommerce.com',
        password: 'Password@123',
        role: 'admin',
        phone: '9999000001',
      },
      {
        name: 'TechStore Seller',
        email: 'seller1@ecommerce.com',
        password: 'Password@123',
        role: 'seller',
        phone: '9999000002',
      },
      {
        name: 'FashionHub Seller',
        email: 'seller2@ecommerce.com',
        password: 'Password@123',
        role: 'seller',
        phone: '9999000003',
      },
      {
        name: 'Yash Verma',
        email: 'customer1@ecommerce.com',
        password: 'Password@123',
        role: 'customer',
        phone: '9999000004',
        address: {
          street: '12 Sector 14',
          city: 'Gurugram',
          state: 'Haryana',
          postalCode: '122001',
          country: 'India',
        },
      },
      {
        name: 'Ali Hussain',
        email: 'customer2@ecommerce.com',
        password: 'Password@123',
        role: 'customer',
        phone: '9999000005',
      },
    ]);

    console.log('Creating categories...');
    const [electronics, audio, apparel] = await Category.create([
      { name: 'Electronics', description: 'Smartphones, laptops, and accessories' },
      { name: 'Audio', description: 'TWS earbuds, headphones, and speakers' },
      { name: 'Apparel', description: 'T-shirts, hoodies, and everyday wear' },
    ]);

    console.log('Creating products...');
    const products = await Product.create([
      {
        name: 'Pro Wireless TWS Earbuds',
        sku: 'AUD-TWS-001',
        description: 'Compact lightweight TWS earbuds with clear sound and 30-hour battery.',
        price: 2499,
        category: audio._id,
        seller: seller1._id,
        stock: 25,
        lowStockThreshold: 5,
      },
      {
        name: 'Mechanical Gaming Keyboard',
        sku: 'ELC-KEY-002',
        description: 'RGB backlit tactile mechanical keyboard with USB-C detachable cable.',
        price: 3999,
        category: electronics._id,
        seller: seller1._id,
        stock: 6,
        lowStockThreshold: 5,
      },
      {
        name: 'USB-C 65W GaN Fast Charger',
        sku: 'ELC-CHG-003',
        description: 'Compact dual-port GaN charger for laptops and smartphones.',
        price: 1899,
        category: electronics._id,
        seller: seller1._id,
        stock: 3, // Intentionally low stock for inventory summary report
        lowStockThreshold: 5,
      },
      {
        name: 'Classic Black Analog Watch',
        sku: 'APP-WTC-004',
        description: 'Minimalist analog wrist watch with matte black dial and strap.',
        price: 1599,
        category: apparel._id,
        seller: seller2._id,
        stock: 15,
        lowStockThreshold: 4,
      },
      {
        name: 'Oversized Cotton Hoodie',
        sku: 'APP-HDY-005',
        description: 'Heavyweight 320 GSM fleece cotton hoodie in charcoal grey.',
        price: 1299,
        category: apparel._id,
        seller: seller2._id,
        stock: 40,
        lowStockThreshold: 5,
      },
    ]);

    console.log('Creating sample historical orders for analytics...');
    await Order.create([
      {
        orderNumber: 'ORD-SEED-1001',
        customer: customer1._id,
        items: [
          {
            product: products[0]._id,
            seller: seller1._id,
            nameSnapshot: products[0].name,
            priceSnapshot: products[0].price,
            quantity: 2,
            subtotal: products[0].price * 2,
          },
          {
            product: products[3]._id,
            seller: seller2._id,
            nameSnapshot: products[3].name,
            priceSnapshot: products[3].price,
            quantity: 1,
            subtotal: products[3].price,
          },
        ],
        totalAmount: products[0].price * 2 + products[3].price,
        shippingAddress: {
          street: '12 Sector 14',
          city: 'Gurugram',
          state: 'Haryana',
          postalCode: '122001',
          country: 'India',
        },
        payment: {
          method: 'SIMULATED_UPI',
          status: 'SIMULATED_PAID',
          isSimulated: true,
          transactionId: 'SIM-TXN-SEED01',
        },
        status: 'delivered',
        statusHistory: [
          { status: 'pending', updatedBy: customer1._id, note: 'Seed order created' },
          { status: 'delivered', updatedBy: admin._id, note: 'Delivered' },
        ],
      },
      {
        orderNumber: 'ORD-SEED-1002',
        customer: customer2._id,
        items: [
          {
            product: products[1]._id,
            seller: seller1._id,
            nameSnapshot: products[1].name,
            priceSnapshot: products[1].price,
            quantity: 1,
            subtotal: products[1].price,
          },
        ],
        totalAmount: products[1].price,
        shippingAddress: {
          street: '45 Sohna Road',
          city: 'Gurugram',
          state: 'Haryana',
          postalCode: '122103',
          country: 'India',
        },
        payment: {
          method: 'SIMULATED_CARD',
          status: 'SIMULATED_PAID',
          isSimulated: true,
          transactionId: 'SIM-TXN-SEED02',
        },
        status: 'confirmed',
        statusHistory: [
          { status: 'pending', updatedBy: customer2._id, note: 'Seed order created' },
          { status: 'confirmed', updatedBy: seller1._id, note: 'Confirmed by seller' },
        ],
      },
    ]);

    console.log('\nDatabase seeded successfully!');
    console.log('--------------------------------------------------');
    console.log('Sample Credentials (Password for all: Password@123)');
    console.log('  Admin:     admin@ecommerce.com');
    console.log('  Seller 1:  seller1@ecommerce.com');
    console.log('  Seller 2:  seller2@ecommerce.com');
    console.log('  Customer1: customer1@ecommerce.com');
    console.log('  Customer2: customer2@ecommerce.com');
    console.log('--------------------------------------------------');

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  }
};

seedDatabase();
