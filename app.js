const express = require('express');
const cors = require('cors');
const requestLogger = require('./middleware/loggerMiddleware');
const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');
const apiRoutes = require('./routes');

const app = express();

// Core middleware
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Mount versioned API routes
app.use('/api', apiRoutes);

// 404 & Centralized Error Handling Middleware
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
