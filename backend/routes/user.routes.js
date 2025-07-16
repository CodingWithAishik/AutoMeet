const express = require('express');
const router = express.Router();
const { body } = require("express-validator")
const userController = require('../controllers/user.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const User = require('../models/user.model');


router.post('/register', [
    body('email').isEmail().withMessage('Invalid Email'),
    body('fullname.firstname').isLength({ min: 3 }).withMessage('First name must be at least 3 characters long'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
],
    userController.registerUser
)

router.post('/login', [
    body('email').isEmail().withMessage('Invalid Email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long')
],
    userController.loginUser
)

router.get('/profile', authMiddleware.authUser, userController.getUserProfile)

router.get('/logout', authMiddleware.authUser, userController.logoutUser)

router.put('/update-role/:id', authMiddleware.authUser, authMiddleware.isAdmin, [
    body('role').isIn(['member', 'admin', 'chairman', 'convenor']).withMessage('Invalid role')
], userController.updateUserRole);

// Allow both admin and chairman to access all users
router.get('/users', authMiddleware.authUser, (req, res, next) => {
    if (req.user.status === 'admin') return next();
    // Allow chairman to access all users for committee suggestions
    // Check if user is chairman in any committee
    const Committee = require('../models/committee.model');
    Committee.findOne({ 'chairman.userId': req.user._id })
        .then(committee => {
            if (committee) return next();
            return res.status(403).json({ message: 'Access denied' });
        })
        .catch(err => {
            console.error('Error checking chairman role:', err);
            return res.status(500).json({ message: 'Server error' });
        });
}, userController.getAllUsers);

router.get('/username', authMiddleware.authUser, userController.getUserNames);

// Get user by email (for committee add)
router.get('/by-email/:email', async (req, res) => {
    try {
        const email = req.params.email.trim();
        console.log('by-email route received:', email);
        // Use case-insensitive regex for robust search
        const user = await User.findOne({ email: { $regex: `^${email}$`, $options: 'i' } });
        console.log('User found:', user);
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
