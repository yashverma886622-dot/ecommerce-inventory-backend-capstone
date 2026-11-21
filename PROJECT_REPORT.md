# Backend Development Capstone Project Report
## E-Commerce and Inventory Management System

---

## 1. Cover Page and Student Details
- **Project Title:** E-Commerce and Inventory Management System
- **Course / Subject:** Backend Development
- **Technology Stack:** Node.js, Express.js, MongoDB, Mongoose, JWT, bcryptjs, Socket.IO
- **Prepared By:** Yash Verma (Individual Project)
- **Program:** B.Tech Computer Science and Engineering (AI & ML)
- **Institution:** K.R. Mangalam University, Sohna, Gurugram, Haryana
- **Date:** November 2026

---

## 2. Abstract / Executive Summary
This project implements a scalable, secure RESTful backend for an E-Commerce and Inventory Management System. It enables customers to browse products, manage shopping carts, and place orders; allows sellers to manage product listings and inventory; and empowers administrators to oversee categories, users, and platform analytics. Key engineering highlights include strict MVC separation, JWT access/refresh token rotation with Role-Based Access Control (RBAC), atomic stock updates to prevent overselling during concurrent checkouts, MongoDB aggregation pipelines for business intelligence, and real-time order and low-stock notifications powered by Node.js `EventEmitter` and Socket.IO.

---

## 3. Problem Statement
Online retail platforms frequently face data inconsistency issues such as overselling limited-stock items during concurrent purchases, client-side price tampering, weak role isolation between buyers and merchants, and delayed operational visibility into low-stock items or order state transitions. A robust backend architecture is needed to enforce business rules, inventory accuracy, and security strictly on the server side.

---

## 4. Project Objectives
1. Design a structured MongoDB schema using Mongoose references, validation rules, and indexes.
2. Build modular REST APIs following the MVC pattern (`Route → Middleware → Controller → Model → MongoDB → Response`).
3. Implement secure authentication (`bcryptjs`, JWT access and refresh tokens) and RBAC (`customer`, `seller`, `admin`).
4. Prevent negative inventory via atomic MongoDB conditional updates with rollback safety.
5. Generate sales, best-seller, and inventory analytics using MongoDB Aggregation Pipelines.
6. Provide real-time order and low-stock notifications using `EventEmitter` and authenticated Socket.IO connections.

---

## 5. Scope and Limitations
- **In Scope:** User registration/login/refresh/logout, profile management, category CRUD, product catalog with search/filter/sort/pagination, server-calculated shopping cart, atomic order creation, order status state machine, order cancellation with stock restoration, analytics endpoints, and real-time WebSocket alerts.
- **Limitations:** Payment processing is explicitly simulated (`SIMULATED_UPI`, `SIMULATED_CARD`, `SIMULATED_COD`); no real payment gateway or banking credentials are handled. Media uploads (product images) are omitted to focus on core backend architecture.

---

## 6. Functional and Non-Functional Requirements
### Functional Requirements
- **Authentication:** Register, login, refresh token rotation, and logout token invalidation.
- **Catalog Management:** Admin manages categories; sellers manage their own products; public users browse and search products.
- **Cart & Orders:** Customers manage personal carts and place orders; sellers/admins advance order statuses; customers/admins cancel eligible orders.
- **Reports:** Sales summary, top-selling products, and category-wise inventory valuation.
- **Real-Time Alerts:** Instant Socket.IO notifications for new orders, status changes, cancellations, and low stock.

### Non-Functional Requirements
- **Security:** Passwords hashed with bcrypt; secrets isolated in `.env` (excluded via `.gitignore`); RBAC enforced on every protected route and socket handshake.
- **Concurrency Safety:** Atomic stock deduction guarantees stock never drops below zero.
- **Maintainability:** Centralized error handling, request logging, and reusable validation middleware.

---

## 7. System Architecture and Module Description
The application follows a layered MVC architecture:

```text
Client (Thunder Client / Postman / Browser)
   │
   ▼
Express Router (routes/)
   │
   ▼
Middleware Chain (logger → authenticate → authorizeRoles → validate)
   │
   ▼
Controller (controllers/) ──► EventEmitter (events/eventBus.js) ──► Socket.IO (sockets/)
   │
   ▼
Mongoose Model (models/)
   │
   ▼
MongoDB Database
```

---

## 8. Database Design
### Collections & Relationships
1. **Users (`users`):** Stores user credentials (hashed password), role (`customer`, `seller`, `admin`), address, and active refresh tokens.
2. **Categories (`categories`):** Stores unique category names and auto-generated slugs.
3. **Products (`products`):** References `Category` (`category`) and `User` (`seller`). Stores `sku`, `price`, `stock`, and `lowStockThreshold`.
4. **Carts (`carts`):** One-to-one reference with `User` (`customer`), containing embedded `{ product, quantity }` items.
5. **Orders (`orders`):** References `User` (`customer`) and embeds order items with `priceSnapshot`, `nameSnapshot`, `seller`, simulated `payment` object, `status`, and `statusHistory`.

### Indexes Implemented
- `User`: `{ email: 1 }` (unique), `{ role: 1, isActive: 1 }`
- `Product`: `{ name: 'text', description: 'text' }` (text search), `{ category: 1, price: 1 }`, `{ seller: 1, stock: 1 }`
- `Order`: `{ customer: 1, createdAt: -1 }`, `{ status: 1, createdAt: -1 }`, `{ 'items.seller': 1, createdAt: -1 }`

---

## 9. REST API Documentation
Full endpoint documentation (methods, paths, roles, request/response formats) is provided in `README.md`, and executable test cases are bundled in `postman/ECommerce_Capstone_API.postman_collection.json`.

---

## 10. Authentication and Authorization Design
- **Password Hashing:** `bcryptjs` with 10 salt rounds in a Mongoose `pre('save')` hook.
- **JWT Dual-Token Flow:** Short-lived Access Token (`15m`) sent in `Authorization: Bearer <token>`; long-lived Refresh Token (`7d`) stored on the user record and rotated on `/api/auth/refresh`.
- **RBAC:** `authorizeRoles(...roles)` middleware verifies `req.user.role` and returns `403 Forbidden` for unauthorized roles. Resource ownership is additionally checked in controllers (e.g., sellers can only edit their own products; customers can only view/cancel their own orders).

---

## 11. Implementation Details
- **Atomic Stock Deduction:** `Product.findOneAndUpdate({ _id, isActive: true, stock: { $gte: qty } }, { $inc: { stock: -qty } })` ensures race conditions cannot oversell stock. If any item in a multi-item cart fails, all prior deductions are rolled back cleanly. - **Aggregation Pipelines:** Implemented in `controllers/reportController.js` using `$match`, `$unwind`, `$group`, `$facet`, `$lookup`, `$project`, and `$sort`.
- **Decoupled Events:** `events/eventBus.js` emits domain events so controllers remain clean while `sockets/socketHandler.js` listens and pushes targeted Socket.IO messages to `user:<id>` and `role:<role>` rooms.

---

## 12. Testing Strategy and Test Cases
API testing was performed using **Thunder Client (VS Code)** and verified against the Postman collection (`postman/ECommerce_Capstone_API.postman_collection.json`), covering:
- **Positive Cases:** Health check (`200`), Admin & Customer Login (`200`), Product listing with filters & sorting (`200`), Sales Summary Aggregation (`200`), Cart & Order Checkout (`201`), and Order Cancellation with Stock Restoration (`200`).
- **Negative & Security Cases:** Validation failures (`400`), missing/invalid JWT token (`401`), insufficient RBAC role permissions (`403`), non-existent resource ID (`404`), and duplicate SKU/email or insufficient stock (`409`).

---

## 13. Screenshots / Demonstration Evidence

### Figure 1: API Health Check (`GET /api/health` – 200 OK)
![Health Check](./images/Screenshot%202026-11-21%20192052.png)

### Figure 2: Admin Login & JWT Token Generation (`POST /api/auth/login` – 200 OK)
![Admin Login](./images/Screenshot%202026-11-21%20192143.png)

### Figure 3: Sales Summary Aggregation Pipeline (`GET /api/reports/sales-summary` – 200 OK)
![Sales Summary Report](./images/Screenshot%202026-11-21%20192509.png)

### Figure 4: Unauthorized Access Without Token (`401 Unauthorized`)
![Unauthorized Access](./images/Screenshot%202026-11-21%20192552.png)

### Figure 5: Product Catalog with Filtering & Sorting (`GET /api/products` – 200 OK)
![Product Catalog](./images/Screenshot%202026-11-21%20192620.png)

### Figure 6: Customer Login (`POST /api/auth/login` – 200 OK)
![Customer Login](./images/Screenshot%202026-11-21%20192707.png)

### Figure 7: Role-Based Access Control Denied (`GET /api/users` – 403 Forbidden)
![RBAC Denied](./images/Screenshot%202026-11-21%20192946.png)

---

## 14. Conclusion and Future Enhancements
The project successfully demonstrates all four units of the Backend Development syllabus—Node.js fundamentals, Express MVC REST APIs, MongoDB/Mongoose modelling & aggregations, and Security/Real-Time communication. Future enhancements include real payment gateway integration (Razorpay/Stripe webhooks), Redis caching for catalog queries, coupon/discount validation, and automated Jest/Supertest integration tests.

---

## 15. References
1. Node.js Official Documentation — https://nodejs.org/docs
2. Express.js Documentation — https://expressjs.com
3. MongoDB Manual & Aggregation Pipeline Reference — https://www.mongodb.com/docs
4. Mongoose ODM Documentation — https://mongoosejs.com/docs
5. Socket.IO Documentation — https://socket.io/docs/v4