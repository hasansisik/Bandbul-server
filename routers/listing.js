const express = require('express');
const {
  createListing,
  getAllListings,
  getListingById,
  getUserListings,
  updateListing,
  deleteListing,
  toggleListingStatus
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

module.exports = router;
