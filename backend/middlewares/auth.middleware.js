const userModel = require('../models/user.model');
const jwt = require('jsonwebtoken');
const blackListTokenModel = require('../models/blacklistToken.model');

module.exports.authUser = async (req, res, next) => {
    try {
        const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ message: 'No auth token provided' });
        }

        const isBlacklisted = await blackListTokenModel.findOne({ token });
        if (isBlacklisted) {
            return res.status(401).json({ message: 'Invalid token' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await userModel.findById(decoded._id).select('+status');

        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        req.user = user;
        next();
    } catch (err) {
        console.error('Auth error:', err.message);
        return res.status(401).json({ message: 'Invalid token' });
    }
};

module.exports.isAdmin = async (req, res, next) => {
    try {
        if (!req.user || !req.user.status) {
            return res.status(403).json({ message: 'Access denied' });
        }

        if (req.user.status !== 'admin') {
            return res.status(403).json({ message: 'Admin rights required' });
        }

        next();
    } catch (error) {
        console.error('Admin authorization error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};