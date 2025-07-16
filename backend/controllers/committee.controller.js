const Committee = require('../models/committee.model');
const mongoose = require('mongoose');
const { sendNotification } = require('../controllers/minutes.controller');
const { getUserIdsByEmails } = require('./user.controller');

exports.createCommittee = async (req, res) => {
    try {
        const { committeeName, committeePurpose, chairman } = req.body;
        // Only chairman is required
        if (!committeeName || !committeePurpose || !chairman || !chairman.userId) {
            return res.status(400).json({ 
                message: 'Missing required fields',
                required: ['committeeName', 'committeePurpose', 'chairman']
            });
        }
        const committee = new Committee({
            committeeName,
            committeePurpose,
            chairman: {
                userId: chairman.userId,
                name: chairman.name,
                email: chairman.email
            },
            status: 'pending_suggestions'
        });
        await committee.save();
        // Notify chairman
        try {
            const userIds = await getUserIdsByEmails([chairman.email]);
            const message = `You have been made chairman of the committee: ${committee.committeeName}. Please suggest convener and members.`;
            const link = `/committeeDashboard/${committee._id}`;
            await sendNotification(userIds, message, link);
        } catch (notifyErr) {
            console.error('Notification delivery failed:', notifyErr);
        }
        res.status(201).json(committee);
    } catch (error) {
        res.status(400).json({ 
            message: 'Error creating committee',
            error: error.message 
        });
    }
};

// Chairman suggests convener and members
exports.suggestPeople = async (req, res) => {
    try {
        const { id } = req.params;
        const { suggestedConvener, suggestedMembers } = req.body;
        console.log('[suggestPeople] Params:', { id });
        console.log('[suggestPeople] Body:', { suggestedConvener, suggestedMembers });
        if (!suggestedConvener || !suggestedMembers || !Array.isArray(suggestedMembers)) {
            console.error('[suggestPeople] Missing suggestedConvener or suggestedMembers', { suggestedConvener, suggestedMembers });
            return res.status(400).json({ message: 'Suggested convener and members required' });
        }
        const committee = await Committee.findById(id);
        if (!committee) {
            console.error('[suggestPeople] Committee not found for id:', id);
            return res.status(404).json({ message: 'Committee not found' });
        }
        // Only chairman can suggest
        if (!committee.chairman || !committee.chairman.userId) {
            console.error('[suggestPeople] Committee chairman missing or malformed:', committee.chairman);
        }
        if (committee.chairman.userId.toString() !== req.user._id.toString()) {
            console.error('[suggestPeople] User is not chairman:', { chairmanId: committee.chairman.userId, userId: req.user._id });
            return res.status(403).json({ message: 'Only chairman can suggest people' });
        }
        committee.suggestedConvener = suggestedConvener;
        committee.suggestedMembers = suggestedMembers;
        committee.status = 'pending_approval';
        committee.adminComment = undefined; // Clear any previous admin comment
        await committee.save();
        // Notify admin(s)
        try {
            // Find all admins
            const User = require('../models/user.model');
            const admins = await User.find({ status: 'admin' });
            const userIds = admins.map(a => a._id);
            const message = `Chairman of ${committee.committeeName} has suggested convener and members for approval.`;
            const link = `/committeeDashboard/${committee._id}`;
            await sendNotification(userIds, message, link);
        } catch (notifyErr) {
            console.error('Notification to admin failed:', notifyErr);
        }
        res.status(200).json({ message: 'Suggestions sent to admin for approval.' });
    } catch (error) {
        console.error('[suggestPeople] Exception:', error);
        res.status(400).json({ message: error.message });
    }
};

// Admin approves or rejects suggestions
exports.approveSuggestions = async (req, res) => {
    try {
        const { id } = req.params;
        const { approve, comment } = req.body;
        const committee = await Committee.findById(id);
        if (!committee) return res.status(404).json({ message: 'Committee not found' });
        // Only admin can approve
        const User = require('../models/user.model');
        const admin = await User.findById(req.user._id);
        if (!admin || admin.status !== 'admin') {
            return res.status(403).json({ message: 'Only admin can approve/reject' });
        }
        if (approve) {
            // Move suggestions to actual convener/members
            committee.convener = committee.suggestedConvener;
            committee.members = committee.suggestedMembers;
            committee.suggestedConvener = undefined;
            committee.suggestedMembers = [];
            committee.status = 'formed';
            committee.adminComment = undefined;
            await committee.save();
            
            // Notify chairman
            try {
                const userIds = [committee.chairman.userId];
                const message = `Your suggested convener and members for ${committee.committeeName} have been approved. Committee is now fully formed.`;
                const link = `/committeeDashboard/${committee._id}`;
                await sendNotification(userIds, message, link);
            } catch (notifyErr) {
                console.error('Notification to chairman failed:', notifyErr);
            }
            
            // Notify convener
            try {
                if (committee.convener && committee.convener.userId) {
                    const userIds = [committee.convener.userId];
                    const message = `You have been assigned as convener of the committee: ${committee.committeeName}.`;
                    const link = `/committeeDashboard/${committee._id}`;
                    await sendNotification(userIds, message, link);
                }
            } catch (notifyErr) {
                console.error('Notification to convener failed:', notifyErr);
            }
            
            // Notify members
            try {
                if (committee.members && committee.members.length > 0) {
                    const memberUserIds = committee.members.map(m => m.userId).filter(id => id);
                    if (memberUserIds.length > 0) {
                        const message = `You have been assigned as a member of the committee: ${committee.committeeName}.`;
                        const link = `/committeeDashboard/${committee._id}`;
                        await sendNotification(memberUserIds, message, link);
                    }
                }
            } catch (notifyErr) {
                console.error('Notification to members failed:', notifyErr);
            }
            
            res.status(200).json({ message: 'Committee fully formed.' });
        } else {
            // Rejected, send comment to chairman
            committee.status = 'pending_suggestions'; // Allow chairman to resubmit
            committee.adminComment = comment || 'Not approved';
            // Keep the suggestions for chairman to modify
            await committee.save();
            try {
                const userIds = [committee.chairman.userId];
                const message = `Your suggested convener and members for ${committee.committeeName} were not approved. Please check the committee dashboard for details.`;
                const link = `/committeeDashboard/${committee._id}`;
                await sendNotification(userIds, message, link);
            } catch (notifyErr) {
                console.error('Notification to chairman failed:', notifyErr);
            }
            res.status(200).json({ message: 'Suggestions rejected and comment sent to chairman.' });
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
exports.getCommittees = async (req, res) => {
    try {
        const committees = await Committee.find();
        res.status(200).json(committees);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getCommitteeById = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ 
                message: 'Invalid committee ID format',
                receivedId: id 
            });
        }

        const committee = await Committee.findById(id);
        
        if (!committee) {
            return res.status(404).json({ 
                message: 'Committee not found',
                receivedId: id 
            });
        }
        
        res.status(200).json(committee);
    } catch (error) {
        console.error('Committee fetch error:', error);
        res.status(500).json({ 
            message: 'Server error while fetching committee',
            error: error.message 
        });
    }
};

exports.updateCommittee = async (req, res) => {
    try {
        const committee = await Committee.findByIdAndUpdate(
            req.params.id, 
            req.body,
            { new: true }
        );
        if (!committee) {
            return res.status(404).json({ message: 'Committee not found' });
        }
        res.status(200).json(committee);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteCommittee = async (req, res) => {
    try {
        const committee = await Committee.findByIdAndDelete(req.params.id);
        if (!committee) {
            return res.status(404).json({ message: 'Committee not found' });
        }
        res.status(200).json({ message: 'Committee deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get all users in a committee (including chairman and convener)
exports.getCommitteeUsers = async (req, res) => {
    try {
        const { id } = req.params;
        const committee = await Committee.findById(id);
        if (!committee) return res.status(404).json({ message: 'Committee not found' });
        // Compose all users: chairman, convener, and members
        const users = [
            { name: committee.chairman.name, email: committee.chairman.email, role: 'chairman', _id: 'chairman' },
            { name: committee.convener.name, email: committee.convener.email, role: 'convener', _id: 'convener' },
            ...committee.members.map(m => ({ ...m.toObject(), role: m.role || 'member' }))
        ];
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Add a user to a committee
exports.addUserToCommittee = async (req, res) => {
    try {
        const { id } = req.params;
        const { userId, email, name, role } = req.body;
        if (!userId || !email || !name || !role) return res.status(400).json({ message: 'Missing fields (userId, email, name, role required)' });
        const committee = await Committee.findById(id);
        if (!committee) return res.status(404).json({ message: 'Committee not found' });
        // Prevent duplicate
        if (committee.members.some(m => m.email === email)) {
            return res.status(400).json({ message: 'User already in committee' });
        }
        const newMember = { userId, name, email, role };
        committee.members.push(newMember);
        await committee.save();
        res.status(201).json(newMember);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Remove a user from a committee
exports.removeUserFromCommittee = async (req, res) => {
    try {
        const { id, userId } = req.params;
        const committee = await Committee.findById(id);
        if (!committee) return res.status(404).json({ message: 'Committee not found' });
        if (userId === 'chairman') {
            committee.chairman = { name: 'Removed', email: 'Removed' };
            await committee.save();
            return res.json({ message: 'Chairman removed from committee' });
        }
        if (userId === 'convener') {
            committee.convener = { name: 'Removed', email: 'Removed' };
            await committee.save();
            return res.json({ message: 'Convener removed from committee' });
        }
        const before = committee.members.length;
        committee.members = committee.members.filter(m => m._id.toString() !== userId);
        if (committee.members.length === before) {
            return res.status(404).json({ message: 'User not found in committee' });
        }
        await committee.save();
        res.json({ message: 'User removed from committee' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// Get all committees for a user (by userId)
exports.getCommitteesForUser = async (req, res) => {
    try {
        const { userId } = req.query;
        console.log('getCommitteesForUser: received userId:', userId, 'type:', typeof userId);
        if (!userId) return res.status(400).json({ message: 'userId is required' });
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'userId is not a valid ObjectId', received: userId });
        }
        const objectId = new mongoose.Types.ObjectId(userId); // FIXED: use 'new' keyword
        console.log('Querying committees for userId:', objectId);
        const committees = await Committee.find({
            $or: [
                { 'chairman.userId': objectId },
                { 'convener.userId': objectId },
                { 'members.userId': objectId }
            ]
        });
        res.status(200).json(committees);
    } catch (error) {
        console.error('Error in getCommitteesForUser:', error.stack || error);
        res.status(500).json({ message: error.message, stack: error.stack });
    }
};