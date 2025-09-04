const express = require('express');
const {
  createNotification,
  getUserNotifications,
  getNotificationById,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotificationStats
} = require('../controllers/notification');
const { isAuthenticated } = require('../middleware/authMiddleware');

const router = express.Router();

// All routes require authentication
router.use(isAuthenticated);

// Get user's notifications
router.get('/', getUserNotifications);

// Get notification statistics
router.get('/stats', getNotificationStats);

// Get single notification by ID
router.get('/:id', getNotificationById);

// Mark notification as read
router.patch('/:id/read', markAsRead);

// Mark all notifications as read
router.patch('/read-all', markAllAsRead);

// Delete notification (soft delete)
router.delete('/:id', deleteNotification);

// Create notification (system only - for internal use)
router.post('/', createNotification);

module.exports = router;
