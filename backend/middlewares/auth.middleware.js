const userModel = require('../models/user.model');
const jwt = require('jsonwebtoken');

module.exports.authUser = async (req, res, next) => {
    try {
        const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ message: 'No auth token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await userModel.findById(decoded._id).select('+status');

        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        req.user = {
            id: user._id,
            status: user.status,
            email: user.email
        };
        next();
    } catch (err) {
        console.error('Auth error:', err);
        return res.status(401).json({ message: 'Invalid token' });
    }
};

module.exports.isAdmin = async (req, res, next) => {
    if (req.user && req.user.status === 'admin') {
        next();
    } else {
        res.status(403).json({ message: 'Admin access required.' });
    }
};