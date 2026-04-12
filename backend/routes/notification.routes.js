const express = require('express');
const router = express.Router();
const Notification = require('../models/notification.model');
const { authUser } = require('../middlewares/auth.middleware');
const mongoose = require('mongoose');
const Committee = require('../models/committee.model');

router.use(authUser);

// Get all notifications for the logged-in user
router.get('/', async (req, res) => {
    try {
        let notifications = await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 });
        // Filter out notifications for deleted committees
        const committeeLinks = notifications
            .map(n => n.link)
            .filter(link => link && link.startsWith('/committeeDashboard/'));
        const committeeIds = committeeLinks
            .map(link => link.split('/committeeDashboard/')[1])
            .filter((id) => mongoose.Types.ObjectId.isValid(id));

        const existingCommittees = await Committee.find({ _id: { $in: committeeIds } }, '_id');
        const existingCommitteeIds = new Set(existingCommittees.map(c => String(c._id)));

        notifications = notifications.filter(n => {
            if (!n.link || !n.link.startsWith('/committeeDashboard/')) return true;
            const id = n.link.split('/committeeDashboard/')[1];
            return existingCommitteeIds.has(String(id));
        });
        res.status(200).json(notifications);
    } catch (error) {
        console.error('Notification fetch error:', error.message);
        res.status(500).json({ message: 'Server error' });
    }
});

// Mark a notification as read
router.put('/:id/read', async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { isRead: true },
            { new: true }
        );
        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }
        res.status(200).json(notification);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
