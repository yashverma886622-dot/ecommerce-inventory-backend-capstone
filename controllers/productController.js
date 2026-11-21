const Product = require('../models/Product');
const Category = require('../models/Category');
const AppError = require('../utils/AppError');
const eventBus = require('../events/eventBus');

/**
 * GET /api/products
 * Supports search, category filter, price range, inStock, sorting and pagination.
 */
const getProducts = async (req, res, next) => {
  try {
    const {
      search,
      category,
      seller,
      minPrice,
      maxPrice,
      inStock,
      sort = '-createdAt',
      page = 1,
      limit = 10,
    } = req.query;

    const filter = { isActive: true };

    if (search) {
      filter.$text = { $search: search };
    }
    if (category) {
      filter.category = category;
    }
    if (seller) {
      filter.seller = seller;
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) filter.price.$gte = Number(minPrice);
      if (maxPrice !== undefined) filter.price.$lte = Number(maxPrice);
    }
    if (inStock === 'true') {
      filter.stock = { $gt: 0 };
    }

    const allowedSorts = ['price', '-price', 'createdAt', '-createdAt', 'name', '-name', 'stock', '-stock'];
    const sortBy = allowedSorts.includes(sort) ? sort : '-createdAt';

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(50, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('category', 'name slug')
        .populate('seller', 'name email')
        .sort(sortBy)
        .skip(skip)
        .limit(limitNum),
      Product.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
      data: products,
    });
  } catch (err) {
    next(err);
  }
};

const getProductById = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category', 'name slug')
      .populate('seller', 'name email');

    if (!product) {
      return next(new AppError('Product not found.', 404));
    }

    res.status(200).json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
};

const createProduct = async (req, res, next) => {
  try {
    const { name, sku, description, price, category, stock, lowStockThreshold } = req.body;

    const categoryDoc = await Category.findById(category);
    if (!categoryDoc) {
      return next(new AppError('Referenced category does not exist.', 404));
    }

    const product = await Product.create({
      name,
      sku,
      description,
      price,
      category,
      seller: req.user._id,
      stock,
      lowStockThreshold,
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully.',
      data: product,
    });
  } catch (err) {
    next(err);
  }
};

const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return next(new AppError('Product not found.', 404));
    }

    // Sellers can only modify their own products; admins can modify any product
    if (req.user.role === 'seller' && product.seller.toString() !== req.user._id.toString()) {
      return next(new AppError('You are not authorized to modify another seller’s product.', 403));
    }

    if (req.body.category) {
      const categoryExists = await Category.findById(req.body.category);
      if (!categoryExists) {
        return next(new AppError('Referenced category does not exist.', 404));
      }
    }

    const allowedFields = [
      'name',
      'sku',
      'description',
      'price',
      'category',
      'stock',
      'lowStockThreshold',
      'isActive',
    ];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        product[field] = req.body[field];
      }
    });

    await product.save();

    if (product.stock <= product.lowStockThreshold) {
      eventBus.emit('inventory:lowStock', {
        productId: product._id.toString(),
        productName: product.name,
        sku: product.sku,
        sellerId: product.seller.toString(),
        remainingStock: product.stock,
        threshold: product.lowStockThreshold,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product updated successfully.',
      data: product,
    });
  } catch (err) {
    next(err);
  }
};

const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return next(new AppError('Product not found.', 404));
    }

    if (req.user.role === 'seller' && product.seller.toString() !== req.user._id.toString()) {
      return next(new AppError('You are not authorized to delete another seller’s product.', 403));
    }

    await product.deleteOne();
    res.status(200).json({
      success: true,
      message: 'Product deleted successfully.',
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
};
