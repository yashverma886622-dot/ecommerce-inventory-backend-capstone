# E-Commerce and Inventory Management System (Backend Capstone)

A production-structured Node.js, Express.js, MongoDB, and Mongoose backend implementing **Project 4: E-Commerce and Inventory Management System** for the Backend Development Capstone Project.

---

## Key Features
- **MVC Architecture:** Clean separation of `routes/`, `controllers/`, `models/`, `middleware/`, `events/`, `sockets/`, and `utils/`.
- **Authentication & RBAC:** Password hashing via `bcryptjs`, JWT **Access + Refresh Token** rotation, logout token invalidation, and role-based access control (`customer`, `seller`, `admin`).
- **Atomic Inventory Management:** Uses atomic conditional updates (`$gte` + `$inc`) with automatic rollback to prevent overselling and negative stock under concurrent checkout requests.
- **Simulated Payments & Order Lifecycle:** Server-side price calculations, price snapshots, simulated payment metadata, strict status transition rules (`pending → confirmed → shipped → delivered` / `cancelled`), and automatic stock restoration on cancellation.
- **MongoDB Indexes & Aggregation Pipelines:**
  - Indexes on `User`, `Product` (text search + compound `{ category, price }` + `{ seller, stock }`), and `Order` (`{ customer, createdAt }`, `{ status, createdAt }`, `{ items.seller, createdAt }`).
  - 3 Aggregation Pipelines: Sales Summary, Best-Selling Products, and Inventory Valuation/Low-Stock Summary.
- **EventEmitter + Socket.IO Real-Time Updates:** Decoupled internal events (`order:placed`, `order:statusUpdated`, `order:cancelled`, `inventory:lowStock`) bridged to authenticated Socket.IO rooms.

---

## Folder Structure
```text
ecommerce-inventory-backend-capstone/
├── config/
│   └── db.js                   # MongoDB connection
├── controllers/                # Business logic (MVC Controllers)
│   ├── authController.js
│   ├── cartController.js
│   ├── categoryController.js
│   ├── orderController.js
│   ├── productController.js
│   ├── reportController.js
│   └── userController.js
├── events/
│   └── eventBus.js             # Node.js EventEmitter
├── middleware/
│   ├── authMiddleware.js       # JWT verification + RBAC
│   ├── errorMiddleware.js      # Centralized error & 404 handler
│   ├── loggerMiddleware.js     # Request/response logger
│   └── validateMiddleware.js   # Input & ObjectId validation
├── models/                     # Mongoose schemas & indexes
│   ├── Cart.js
│   ├── Category.js
│   ├── Order.js
│   ├── Product.js
│   └── User.js
├── postman/
│   └── ECommerce_Capstone_API.postman_collection.json
├── routes/                     # REST API route definitions
├── sockets/
│   └── socketHandler.js        # Authenticated Socket.IO server
├── utils/
│   ├── AppError.js
│   └── tokenUtils.js
├── app.js                      # Express app setup
├── server.js                   # HTTP + Socket.IO server entry
├── seed.js                     # Sample data seeder
├── socket-test.html            # Quick browser tester for Socket.IO demo
├── .env.example
├── .gitignore
├── package.json
├── PROJECT_REPORT.md
└── README.md
```

---

## Prerequisites
- Node.js (v18+ recommended)
- MongoDB (Local Community Server or MongoDB Atlas)
- Postman (for API testing)

---

## Setup & Running Instructions

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment variables**
   Copy `.env.example` to `.env` and update `MONGO_URI` and JWT secrets:
   ```bash
   cp .env.example .env
   ```

3. **Seed the database with sample data**
   ```bash
   npm run seed
   ```
   **Seeded Accounts** (Password for all: `Password@123`):
   | Role | Email |
   | :--- | :--- |
   | Admin | `admin@ecommerce.com` |
   | Seller 1 | `seller1@ecommerce.com` |
   | Seller 2 | `seller2@ecommerce.com` |
   | Customer 1 | `customer1@ecommerce.com` |
   | Customer 2 | `customer2@ecommerce.com` |

4. **Start the server**
   ```bash
   npm run dev
   ```
   Verify at `GET http://localhost:5000/api/health`.

---

## API Endpoints Overview

### Authentication (`/api/auth`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| POST | `/api/auth/register` | Public | Register customer or seller |
| POST | `/api/auth/login` | Public | Login and receive access + refresh tokens |
| POST | `/api/auth/refresh` | Public | Rotate refresh token & issue new access token |
| POST | `/api/auth/logout` | Auth | Invalidate refresh token |

### Users (`/api/users`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| GET | `/api/users/me` | Auth | View own profile |
| PATCH | `/api/users/me` | Auth | Update permitted profile fields |
| GET | `/api/users` | Admin | List all users (paginated) |
| PATCH | `/api/users/:id` | Admin | Update user role or active status |

### Categories (`/api/categories`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| GET | `/api/categories` | Public | List all active categories |
| GET | `/api/categories/:id` | Public | Get single category |
| POST | `/api/categories` | Admin | Create category |
| PATCH | `/api/categories/:id` | Admin | Update category |
| DELETE | `/api/categories/:id` | Admin | Delete category (blocked if products exist) |

### Products (`/api/products`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| GET | `/api/products` | Public | Search, filter (`category`, `minPrice`, `maxPrice`, `inStock`), sort, paginate |
| GET | `/api/products/:id` | Public | Get product details |
| POST | `/api/products` | Seller/Admin | Create product |
| PATCH | `/api/products/:id` | Seller (own)/Admin | Update product & stock |
| DELETE | `/api/products/:id` | Seller (own)/Admin | Delete product |

### Cart (`/api/cart`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| GET | `/api/cart` | Customer | View cart with server-calculated totals |
| POST | `/api/cart/items` | Customer | Add item (validates stock) |
| PATCH | `/api/cart/items/:productId` | Customer | Update item quantity |
| DELETE | `/api/cart/items/:productId` | Customer | Remove item |
| DELETE | `/api/cart` | Customer | Clear cart |

### Orders (`/api/orders`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| POST | `/api/orders` | Customer | Place order from cart (atomic stock update) |
| GET | `/api/orders` | Auth | Role-scoped order list |
| GET | `/api/orders/:id` | Auth | Order details (ownership enforced) |
| PATCH | `/api/orders/:id/status` | Seller/Admin | Update order status (`confirmed`, `shipped`, `delivered`, `cancelled`) |
| PATCH | `/api/orders/:id/cancel` | Customer/Admin | Cancel pending/confirmed order & restore stock |

### Reports & Analytics (`/api/reports`)
| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| GET | `/api/reports/sales-summary` | Seller/Admin | Revenue, order counts, daily breakdown |
| GET | `/api/reports/best-selling` | Seller/Admin | Top-selling products by units & revenue |
| GET | `/api/reports/inventory-summary` | Seller/Admin | Category valuation & low-stock items |

---

## Real-Time Socket.IO Events
- **Authentication:** Pass JWT via `io('http://localhost:5000', { auth: { token: '<accessToken>' } })`.
- **Rooms Joined Automatically:** `user:<userId>` and `role:<role>`.
- **Emitted Events:**
  - `order:created` → sent to customer
  - `seller:newOrder` / `admin:newOrder` → sent to involved sellers & admins
  - `order:statusChanged` → sent to customer
  - `order:cancelled` / `seller:orderCancelled` → sent to customer & sellers
  - `inventory:lowStockAlert` → sent to seller & admins when `stock <= lowStockThreshold`
- **Live Demo:** Open `socket-test.html` in a browser, paste a Seller or Customer JWT token, and trigger an order from Postman to watch live events arrive.

---

## API Testing with Postman
1. Import `postman/ECommerce_Capstone_API.postman_collection.json` into Postman.
2. Run **POST Login Customer**, **POST Login Seller**, and **POST Login Admin** (test scripts automatically store tokens in collection variables).
3. Run the remaining requests in order to verify CRUD, atomic stock deduction, RBAC (`403`), unauthenticated access (`401`), validation errors (`400`), and missing resources (`404`).
#   e c o m m e r c e - i n v e n t o r y - b a c k e n d - c a p s t o n e  
 