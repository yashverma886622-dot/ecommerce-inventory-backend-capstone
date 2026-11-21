const Order = require('../models/Order');
const Product = require('../models/Product');

/**
 * Aggregation Pipeline 1: GET /api/reports/sales-summary
 * Computes overall revenue, order counts, average order value, and daily breakdown.
 */
const getSalesSummary = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const matchStage = { status: { $ne: 'cancelled' } };

    if (startDate || endDate) {
      matchStage.createdAt = {};
      if (startDate) matchStage.createdAt.$gte = new Date(startDate);
      if (endDate) matchStage.createdAt.$lte = new Date(endDate);
    }

    // If seller, scope report to their items only
    if (req.user.role === 'seller') {
      const sellerPipeline = [
        { $match: matchStage },
        { $unwind: '$items' },
        { $match: { 'items.seller': req.user._id } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            dailyRevenue: { $sum: '$items.subtotal' },
            unitsSold: { $sum: '$items.quantity' },
            orderIds: { $addToSet: '$_id' },
          },
        },
        {
          $project: {
            _id: 0,
            date: '$_id',
            dailyRevenue: { $round: ['$dailyRevenue', 2] },
            unitsSold: 1,
            orderCount: { $size: '$orderIds' },
          },
        },
        { $sort: { date: -1 } },
      ];

      const dailyBreakdown = await Order.aggregate(sellerPipeline);
      const totalRevenue = dailyBreakdown.reduce((sum, d) => sum + d.dailyRevenue, 0);
      const totalUnitsSold = dailyBreakdown.reduce((sum, d) => sum + d.unitsSold, 0);

      return res.status(200).json({
        success: true,
        scope: 'seller',
        data: {
          totalRevenue: Number(totalRevenue.toFixed(2)),
          totalUnitsSold,
          dailyBreakdown,
        },
      });
    }

    // Admin platform-wide summary using $facet
    const [result] = await Order.aggregate([
      { $match: matchStage },
      {
        $facet: {
          overall: [
            {
              $group: {
                _id: null,
                totalRevenue: { $sum: '$totalAmount' },
                totalOrders: { $sum: 1 },
                avgOrderValue: { $avg: '$totalAmount' },
              },
            },
            {
              $project: {
                _id: 0,
                totalRevenue: { $round: ['$totalRevenue', 2] },
                totalOrders: 1,
                avgOrderValue: { $round: ['$avgOrderValue', 2] },
              },
            },
          ],
          statusBreakdown: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 },
                revenue: { $sum: '$totalAmount' },
              },
            },
            {
              $project: {
                _id: 0,
                status: '$_id',
                count: 1,
                revenue: { $round: ['$revenue', 2] },
              },
            },
          ],
          dailySales: [
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                revenue: { $sum: '$totalAmount' },
                orders: { $sum: 1 },
              },
            },
            {
              $project: {
                _id: 0,
                date: '$_id',
                revenue: { $round: ['$revenue', 2] },
                orders: 1,
              },
            },
            { $sort: { date: -1 } },
          ],
        },
      },
    ]);

    res.status(200).json({
      success: true,
      scope: 'admin',
      data: {
        overall: result.overall[0] || { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 },
        statusBreakdown: result.statusBreakdown,
        dailySales: result.dailySales,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Aggregation Pipeline 2: GET /api/reports/best-selling
 * Ranks top-selling products by total units sold and revenue.
 */
const getBestSellingProducts = async (req, res, next) => {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 5));
    const pipeline = [
      { $match: { status: { $ne: 'cancelled' } } },
      { $unwind: '$items' },
    ];

    if (req.user.role === 'seller') {
      pipeline.push({ $match: { 'items.seller': req.user._id } });
    }

    pipeline.push(
      {
        $group: {
          _id: '$items.product',
          productName: { $first: '$items.nameSnapshot' },
          totalUnitsSold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.subtotal' },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { totalUnitsSold: -1, totalRevenue: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: 'products',
          localField: '_id',
          foreignField: '_id',
          as: 'productDetails',
        },
      },
      {
        $project: {
          _id: 0,
          productId: '$_id',
          productName: 1,
          sku: { $arrayElemAt: ['$productDetails.sku', 0] },
          currentStock: { $arrayElemAt: ['$productDetails.stock', 0] },
          totalUnitsSold: 1,
          totalRevenue: { $round: ['$totalRevenue', 2] },
          orderCount: 1,
        },
      }
    );

    const bestSellers = await Order.aggregate(pipeline);

    res.status(200).json({
      success: true,
      count: bestSellers.length,
      data: bestSellers,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Aggregation Pipeline 3: GET /api/reports/inventory-summary
 * Category-wise inventory valuation, stock levels, and low-stock items.
 */
const getInventorySummary = async (req, res, next) => {
  try {
    const matchStage = { isActive: true };
    if (req.user.role === 'seller') {
      matchStage.seller = req.user._id;
    }

    const [summary] = await Product.aggregate([
      { $match: matchStage },
      {
        $facet: {
          byCategory: [
            {
              $group: {
                _id: '$category',
                productCount: { $sum: 1 },
                totalStockUnits: { $sum: '$stock' },
                inventoryValue: { $sum: { $multiply: ['$price', '$stock'] } },
                outOfStockCount: {
                  $sum: { $cond: [{ $eq: ['$stock', 0] }, 1, 0] },
                },
              },
            },
            {
              $lookup: {
                from: 'categories',
                localField: '_id',
                foreignField: '_id',
                as: 'categoryInfo',
              },
            },
            {
              $project: {
                _id: 0,
                categoryId: '$_id',
                categoryName: { $arrayElemAt: ['$categoryInfo.name', 0] },
                productCount: 1,
                totalStockUnits: 1,
                inventoryValue: { $round: ['$inventoryValue', 2] },
                outOfStockCount: 1,
              },
            },
            { $sort: { inventoryValue: -1 } },
          ],
          lowStockItems: [
            { $match: { $expr: { $lte: ['$stock', '$lowStockThreshold'] } } },
            {
              $project: {
                _id: 1,
                name: 1,
                sku: 1,
                stock: 1,
                lowStockThreshold: 1,
                price: 1,
              },
            },
            { $sort: { stock: 1 } },
          ],
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSalesSummary,
  getBestSellingProducts,
  getInventorySummary,
};
