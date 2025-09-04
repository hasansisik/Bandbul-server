const Blog = require("../models/Blog");
const { StatusCodes } = require("http-status-codes");
const CustomError = require("../errors");

// Get All Blogs (Public - no authentication required)
const getAllBlogs = async (req, res, next) => {
  try {
    const { 
      category, 
      featured, 
      search,
      page = 1,
      limit = 12,
      sort = 'publishedDate'
    } = req.query;

    // Build filter object
    const filter = { status: 'published' };
    
    if (category) filter.category = category;
    if (featured === 'true') filter.featured = true;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { excerpt: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
        { author: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Sort options
    let sortOption = { publishedDate: -1 };
    if (sort === 'title') sortOption = { title: 1 };
    if (sort === 'featured') sortOption = { featured: -1, publishedDate: -1 };
    
    // Get blogs with pagination
    const blogs = await Blog.find(filter)
      .populate('createdBy', 'name surname')
      .select('-content') // Don't send full content in list view
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit));



    // Get total count for pagination
    const total = await Blog.countDocuments(filter);

    // Get blog statistics
    const stats = await Blog.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          published: { $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] } },
          draft: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
          featured: { $sum: { $cond: [{ $eq: ['$featured', true] }, 1, 0] } }
        }
      }
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      blogs,
      stats: stats[0] || {
        total: 0,
        published: 0,
        draft: 0,
        featured: 0
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get Blog by ID (Public - no authentication required)
const getBlogById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const blog = await Blog.findById(id)
      .populate('createdBy', 'name surname');

    if (!blog) {
      throw new CustomError.NotFoundError("Blog yazısı bulunamadı");
    }

    // Only show published blogs to non-admin users
    if (blog.status !== 'published' && (!req.user || req.user.role !== 'admin')) {
      throw new CustomError.NotFoundError("Blog yazısı bulunamadı");
    }

    res.status(StatusCodes.OK).json({
      success: true,
      blog
    });
  } catch (error) {
    next(error);
  }
};

// Get Blog by Slug (Public - no authentication required)
const getBlogBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    
    const blog = await Blog.findOne({ slug })
      .populate('createdBy', 'name surname');

    if (!blog) {
      throw new CustomError.NotFoundError("Blog yazısı bulunamadı");
    }

    // Only show published blogs to non-admin users
    if (blog.status !== 'published' && (!req.user || req.user.role !== 'admin')) {
      throw new CustomError.NotFoundError("Blog yazısı bulunamadı");
    }

    res.status(StatusCodes.OK).json({
      success: true,
      blog
    });
  } catch (error) {
    next(error);
  }
};

// Create Blog (Admin only)
const createBlog = async (req, res, next) => {
  try {
    const {
      title,
      excerpt,
      content,
      author,
      category,
      tags,
      image,
      featured,
      status = 'published'
    } = req.body;

    // Check if blog with same title exists
    const existingBlog = await Blog.findOne({ title });
    if (existingBlog) {
      throw new CustomError.BadRequestError("Bu başlıkta bir blog yazısı zaten mevcut");
    }

    const blog = new Blog({
      title,
      excerpt,
      content,
      author,
      category,
      tags: tags || [],
      image: image || "/blogexample.jpg",
      featured: featured || false,
      status,
      createdBy: req.user.userId
    });

    await blog.save();

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: "Blog yazısı başarıyla oluşturuldu",
      blog
    });
  } catch (error) {
    console.log(error);

    next(error);
  }
};

// Update Blog (Admin only)
const updateBlog = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = Object.keys(req.body);
    const allowedUpdates = [
      "title",
      "excerpt", 
      "content",
      "author",
      "category",
      "tags",
      "image",
      "featured",
      "status",
      "readTime"
    ];

    const isValidOperation = updates.every((update) =>
      allowedUpdates.includes(update)
    );

    if (!isValidOperation) {
      throw new CustomError.BadRequestError("Geçersiz güncelleme alanları");
    }

    const blog = await Blog.findById(id);
    if (!blog) {
      throw new CustomError.NotFoundError("Blog yazısı bulunamadı");
    }

    // Check if new title conflicts with existing blog
    if (req.body.title && req.body.title !== blog.title) {
      const existingBlog = await Blog.findOne({ 
        title: req.body.title,
        _id: { $ne: id }
      });
      if (existingBlog) {
        throw new CustomError.BadRequestError("Bu başlıkta bir blog yazısı zaten mevcut");
      }
    }

    // Update fields
    updates.forEach((update) => {
      blog[update] = req.body[update];
    });

    await blog.save();

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Blog yazısı başarıyla güncellendi",
      blog
    });
  } catch (error) {
    console.log(error);
    next(error);
  }
};

// Delete Blog (Admin only)
const deleteBlog = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const blog = await Blog.findById(id);
    if (!blog) {
      throw new CustomError.NotFoundError("Blog yazısı bulunamadı");
    }

    await Blog.findByIdAndDelete(id);

    res.status(StatusCodes.OK).json({
      success: true,
      message: "Blog yazısı başarıyla silindi"
    });
  } catch (error) {
    next(error);
  }
};

// Get Blog Categories (Public)
const getBlogCategories = async (req, res, next) => {
  try {
    const categories = await Blog.aggregate([
      { $match: { status: 'published' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.status(StatusCodes.OK).json({
      success: true,
      categories: categories.map(cat => ({
        name: cat._id,
        count: cat.count
      }))
    });
  } catch (error) {
    next(error);
  }
};

// Get Recent Blogs (Public)
const getRecentBlogs = async (req, res, next) => {
  try {
    const { limit = 6 } = req.query;
    
    const blogs = await Blog.find({ status: 'published' })
      .populate('createdBy', 'name surname')
      .select('-content')
      .sort({ publishedDate: -1 })
      .limit(parseInt(limit));

    res.status(StatusCodes.OK).json({
      success: true,
      blogs
    });
  } catch (error) {
    next(error);
  }
};

// Search Blogs (Public)
const searchBlogs = async (req, res, next) => {
  try {
    const { q, page = 1, limit = 12 } = req.query;
    
    if (!q) {
      throw new CustomError.BadRequestError("Arama terimi gereklidir");
    }

    const filter = {
      status: 'published',
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { excerpt: { $regex: q, $options: 'i' } },
        { content: { $regex: q, $options: 'i' } },
        { author: { $regex: q, $options: 'i' } },
        { tags: { $in: [new RegExp(q, 'i')] } }
      ]
    };

    const skip = (page - 1) * limit;
    
    const blogs = await Blog.find(filter)
      .populate('createdBy', 'name surname')
      .select('-content')
      .sort({ publishedDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Blog.countDocuments(filter);

    res.status(StatusCodes.OK).json({
      success: true,
      blogs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllBlogs,
  getBlogById,
  getBlogBySlug,
  createBlog,
  updateBlog,
  deleteBlog,
  getBlogCategories,
  getRecentBlogs,
  searchBlogs
};
