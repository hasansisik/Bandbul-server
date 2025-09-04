const express = require('express');
const {
  getConversations,
  getMessages,
  sendMessage,
  startConversation,
  markAsRead,
  getUnreadCount,
  cleanupDuplicateConversations
} = require('../controllers/message');
const { isAuthenticated } = require('../middleware/authMiddleware');

const router = express.Router();

// All routes require authentication
router.use(isAuthenticated);

// Get all conversations for the authenticated user
router.get('/conversations', getConversations);

// Get messages for a specific conversation
router.get('/conversations/:conversationId/messages', getMessages);

// Send a message
router.post('/send', sendMessage);

// Start a new conversation
router.post('/conversations/start', startConversation);

// Mark messages as read
router.patch('/conversations/:conversationId/read', markAsRead);

// Get unread message count
router.get('/unread-count', getUnreadCount);

// Cleanup duplicate conversations (admin/development)
router.post('/cleanup-duplicates', cleanupDuplicateConversations);

module.exports = router;
