const express = require('express');
const {
  getSettings,
  getSettingsAdmin,
  createSettings,
  updateSettings,
  deleteSettings,
  getSettingsStats
} = require('../controllers/settings');
const { isAuthenticated, isAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes (no authentication required)
router.get('/public', getSettings);

// Protected admin routes (authentication and admin role required)
router.get('/', isAuthenticated, isAdmin, getSettingsAdmin);
router.get('/stats', isAuthenticated, isAdmin, getSettingsStats);
router.post('/', isAuthenticated, isAdmin, createSettings);
router.put('/:id', isAuthenticated, isAdmin, updateSettings);
router.delete('/:id', isAuthenticated, isAdmin, deleteSettings);

module.exports = router;
