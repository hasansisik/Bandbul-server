const express = require('express');
const {
  createListing,
  getAllListings,
  getListingById,
  getUserListings,
  updateListing,
  deleteListing,
  updateListingStatus,
  toggleListingStatus,
  approveListing,
  rejectListing,
  getPendingListings
} = require('../controllers/listing');
const { isAuthenticated } = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes (no authentication required)
router.get('/', getAllListings);
router.get('/:id', getListingById);

// Protected routes (authentication required)
router.post('/', isAuthenticated, createListing);
router.get('/user/me', isAuthenticated, getUserListings);
router.put('/:id', isAuthenticated, updateListing);
router.delete('/:id', isAuthenticated, deleteListing);
router.patch('/:id/toggle-status', isAuthenticated, toggleListingStatus);
router.patch('/:id/status', isAuthenticated, updateListingStatus);

// Admin routes
router.get('/admin/pending', isAuthenticated, getPendingListings);
router.patch('/:id/approve', isAuthenticated, approveListing);
router.patch('/:id/reject', isAuthenticated, rejectListing);

module.exports = router;
