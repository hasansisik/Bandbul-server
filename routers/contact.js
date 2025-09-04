const express = require('express');
const {
  createContact,
  getAllContacts,
  getContactById,
  updateContact,
  deleteContact,
  updateContactStatus,
  getContactStats
} = require('../controllers/contact');
const { isAuthenticated, isAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes (no authentication required)
router.post('/', createContact);

// Protected admin routes (authentication and admin role required)
router.get('/', isAuthenticated, isAdmin, getAllContacts);
router.get('/stats', isAuthenticated, isAdmin, getContactStats);
router.get('/:id', isAuthenticated, isAdmin, getContactById);
router.put('/:id', isAuthenticated, isAdmin, updateContact);
router.delete('/:id', isAuthenticated, isAdmin, deleteContact);
router.patch('/:id/status', isAuthenticated, isAdmin, updateContactStatus);

module.exports = router;
