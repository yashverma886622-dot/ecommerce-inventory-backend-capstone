const Category = require('../models/Category');
const Product = require('../models/Product');
const AppError = require('../utils/AppError');

const getAllCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({ isActive: true }).sort({ name: 1 });
    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (err) {
    next(err);
  }
};

const getCategoryById = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return next(new AppError('Category not found.', 404));
    }
    res.status(200).json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
};

const createCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name || name.trim().length < 2) {
      return next(new AppError('Category name must be at least 2 characters.', 400));
    }

    const category = await Category.create({ name, description });
    res.status(201).json({
      success: true,
      message: 'Category created successfully.',
      data: category,
    });
  } catch (err) {
    next(err);
  }
};

const updateCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return next(new AppError('Category not found.', 404));
    }

    if (req.body.name !== undefined) category.name = req.body.name;
    if (req.body.description !== undefined) category.description = req.body.description;
    if (req.body.isActive !== undefined) category.isActive = req.body.isActive;

    await category.save();

    res.status(200).json({
      success: true,
      message: 'Category updated successfully.',
      data: category,
    });
  } catch (err) {
    next(err);
  }
};

const deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return next(new AppError('Category not found.', 404));
    }

    const linkedProducts = await Product.countDocuments({ category: category._id });
    if (linkedProducts > 0) {
      return next(
        new AppError(
          `Cannot delete category while ${linkedProducts} product(s) reference it.`,
          409
        )
      );
    }

    await category.deleteOne();
    res.status(200).json({
      success: true,
      message: 'Category deleted successfully.',
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};
