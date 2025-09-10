const express = require('express');
const {
  createInstrument,
  getAllInstruments,
  getInstrumentById,
  updateInstrument,
  deleteInstrument,
  toggleInstrumentStatus
} = require('../controllers/instrument');
const { isAuthenticated } = require('../middleware/authMiddleware');

const router = express.Router();

// Public routes (no authentication required)
router.get('/', getAllInstruments);
router.get('/:id', getInstrumentById);

// Protected routes (authentication required - admin only)
router.post('/', isAuthenticated, createInstrument);
router.put('/:id', isAuthenticated, updateInstrument);
router.delete('/:id', isAuthenticated, deleteInstrument);
router.patch('/:id/toggle-status', isAuthenticated, toggleInstrumentStatus);

module.exports = router;
