const express = require('express');
const {
  getAllBlogs,
  getBlogById,
  getBlogBySlug,
  createBlog,
  updateBlog,
  deleteBlog,
  getBlogCategories,
  getRecentBlogs,
  searchBlogs
} = require('../controllers/blog');
const { isAuthenticated, isAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes (no authentication required)
router.get('/', getAllBlogs);
router.get('/categories', getBlogCategories);
router.get('/recent', getRecentBlogs);
router.get('/search', searchBlogs);
router.get('/slug/:slug', getBlogBySlug);
router.get('/:id', getBlogById);

// Admin only routes (authentication and admin role required)
router.post('/', isAuthenticated, isAdmin, createBlog);
router.put('/:id', isAuthenticated, isAdmin, updateBlog);
router.delete('/:id', isAuthenticated, isAdmin, deleteBlog);

module.exports = router;
