const BlogCategory = require("../models/BlogCategory");
const { StatusCodes } = require("http-status-codes");
const CustomError = require("../errors");

// Create new category (admin only)
const createCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      throw new CustomError.BadRequestError("Kategori adı gereklidir");
    }

    // Check if category already exists
    const existingCategory = await BlogCategory.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existingCategory) {
      throw new CustomError.BadRequestError("Bu kategori adı zaten mevcut");
    }

    const category = new BlogCategory({
      name: name.trim(),
      description: description ? description.trim() : undefined
    });

    await category.save();

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Blog kategorisi başarıyla oluşturuldu",
      category
    });
  } catch (error) {
    next(error);
  }
};

// Get all categories (public)
const getAllCategories = async (req, res, next) => {
  try {
    const { active } = req.query;
    
    let filter = {};
    if (active !== undefined) {
      filter.active = active === 'true';
    }

    const categories = await BlogCategory.find(filter)
      .sort({ name: 1 });

    res.status(StatusCodes.OK).json({
      success: true,
      categories
    });
  } catch (error) {
    next(error);
  }
};

// Get single category by ID (public)
const getCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const category = await BlogCategory.findById(id);

    if (!category) {
      throw new CustomError.NotFoundError("Blog kategorisi bulunamadı");
    }

    res.status(StatusCodes.OK).json({
      success: true,
      category
    });
  } catch (error) {
    next(error);
  }
};

// Update category (admin only)
const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, active } = req.body;

    const category = await BlogCategory.findById(id);

    if (!category) {
      throw new CustomError.NotFoundError("Blog kategorisi bulunamadı");
    }

    // If name is being updated, check for duplicates
    if (name && name !== category.name) {
      const existingCategory = await BlogCategory.findOne({ 
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: id }
      });
      
      if (existingCategory) {
        throw new CustomError.BadRequestError("Bu kategori adı zaten mevcut");
      }
      
      category.name = name.trim();
    }

    if (description !== undefined) {
      category.description = description ? description.trim() : undefined;
    }

    if (active !== undefined) {
      category.active = active;
    }

    await category.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Blog kategorisi başarıyla güncellendi",
      category
    });
  } catch (error) {
    next(error);
  }
};

// Delete category (admin only)
const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const category = await BlogCategory.findById(id);

    if (!category) {
      throw new CustomError.NotFoundError("Blog kategorisi bulunamadı");
    }

    // Check if category is being used in any blogs
    const Blog = require("../models/Blog");
    const blogCount = await Blog.countDocuments({ category: category.name });
    
    if (blogCount > 0) {
      throw new CustomError.BadRequestError("Bu kategori kullanılan blog yazılarında bulunduğu için silinemez");
    }

    await BlogCategory.findByIdAndDelete(id);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Blog kategorisi başarıyla silindi"
    });
  } catch (error) {
    next(error);
  }
};

// Toggle category status (admin only)
const toggleCategoryStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    const category = await BlogCategory.findById(id);

    if (!category) {
      throw new CustomError.NotFoundError("Blog kategorisi bulunamadı");
    }

    category.active = !category.active;
    await category.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: `Blog kategorisi ${category.active ? 'aktif' : 'pasif'} olarak güncellendi`,
      category
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus
};
