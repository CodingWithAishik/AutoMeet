const userModel = require('../models/user.model');
const userService = require('../services/user.service');
const { validationResult } = require('express-validator');
const blackListTokenModel = require('../models/blacklistToken.model');

module.exports.registerUser = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { fullname, email, password } = req.body;

        const existingUser = await userModel.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: 'Email already registered' });
        }

        const hashedPassword = await userModel.hashPassword(password);

        const user = await userService.createUser({
            firstname: fullname.firstname,
            lastname: fullname.lastname,
            email,
            password: hashedPassword
        });

        const token = user.generateAuthToken();
        res.status(201).json({ token, user });
    } catch (err) {
        console.error('Register user error:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
};
module.exports.loginUser = async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { email, password } = req.body;
        const user = await userModel.findOne({ email }).select('+password');

        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const token = user.generateAuthToken();
        res.cookie('token', token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production'
        });

        res.status(200).json({ token, user });
    } catch (err) {
        console.error('Login user error:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
};
module.exports.getUserProfile = async (req, res, next) => {
    // Remove status for non-admins
    const user = req.user.toObject ? req.user.toObject() : req.user;
    if (user.status !== 'admin') {
        delete user.status;
    }
    res.status(200).json(user);

}
module.exports.logoutUser = async (req, res, next) => {
    try {
        const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
        res.clearCookie('token');

        if (token) {
            await blackListTokenModel.updateOne(
                { token },
                { token },
                { upsert: true }
            );
        }

        res.status(200).json({ message: 'Logged out' });
    } catch (err) {
        console.error('Logout user error:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
};
module.exports.updateUserRole = async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    try {
        const user = await userModel.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        if (role === 'admin') {
            user.status = 'admin';
        } else {
            user.status = undefined;
        }
        await user.save();

        return res.status(200).json({ 
            message: 'User role updated successfully.',
            user: {
                _id: user._id,
                email: user.email,
                status: user.status,
                fullname: user.fullname
            }
        });
    } catch (err) {
        console.error('Role update error:', err);
        return res.status(500).json({ message: 'Server error.' });
    }
}
module.exports.getAllUsers = async (req, res) => {
    try {
        const users = await userModel.find().select('-password');
        // Remove status for all users except admin
        const usersSanitized = users.map(u => {
            const userObj = u.toObject();
            if (userObj.status !== 'admin') {
                delete userObj.status;
            }
            return userObj;
        });
        return res.status(200).json(usersSanitized);
    } catch (err) {
        console.error('Get users error:', err);
        return res.status(500).json({ message: 'Server error.' });
    }
}
module.exports.getUserNames = async (req, res) => {
    try {
        const users = await userModel.find().select('fullname email status');
        return res.status(200).json(users.map((u) => ({
            _id: u._id,
            fullname: u.fullname,
            email: u.email,
            status: u.status
        })));
    } catch (err) {
        console.error('Get user names error:', err);
        return res.status(500).json({ message: 'Server error.' });
    }

}
module.exports.getUserIdsByEmails = async (emails) => {
    // Accepts array of emails, returns array of user _ids
    if (!Array.isArray(emails) || emails.length === 0) {
        console.warn('getUserIdsByEmails called with empty or invalid emails:', emails);
        return [];
    }
    const users = await userModel.find({ email: { $in: emails } }).select('_id email');
    if (users.length !== emails.length) {
        console.warn('Some emails not found in user collection:', emails, 'Found:', users.map(u => u.email));
    }
    return users.map(u => u._id);
};