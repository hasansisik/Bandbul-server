const express = require('express');
const {register,login,getMyProfile,getAllUsers,logout,forgotPassword,resetPassword,verifyEmail,againEmail,editProfile,verifyPassword,deleteAccount,deleteUser} = require('../controllers/auth');
const {isAuthenticated, isAdmin} = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register',register);
router.post('/login',login);
router.get("/me", isAuthenticated, getMyProfile);
router.get('/logout',isAuthenticated,logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/verify-email', verifyEmail);
router.post('/again-email', againEmail);
router.post('/edit-profile',isAuthenticated, editProfile);
router.post('/verify-password',isAuthenticated, verifyPassword);
router.delete('/delete-account',isAuthenticated, deleteAccount);

// Admin only routes
router.get('/users', isAuthenticated, isAdmin, getAllUsers);
router.delete('/users/:id', isAuthenticated, isAdmin, deleteUser);

module.exports = router;