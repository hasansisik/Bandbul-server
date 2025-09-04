const express = require('express');
const {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus
} = require('../controllers/blogCategory');
const { isAuthenticated, isAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes (no authentication required)
router.get('/', getAllCategories);
router.get('/:id', getCategoryById);

// Admin only routes (authentication and admin role required)
router.post('/', isAuthenticated, isAdmin, createCategory);
router.put('/:id', isAuthenticated, isAdmin, updateCategory);
router.delete('/:id', isAuthenticated, isAdmin, deleteCategory);
router.patch('/:id/toggle-status', isAuthenticated, isAdmin, toggleCategoryStatus);

module.exports = router;
