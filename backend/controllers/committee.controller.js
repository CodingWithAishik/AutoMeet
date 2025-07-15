const Committee = require('../models/committee.model');
const User = require('../models/user.model');
const Notification = require('../models/notification.model');

// Admin creates a committee with only a chairman
exports.createCommittee = async (req, res) => {
    try {
        const { name, chairmanId } = req.body;
        const adminId = req.user.id;

        if (!name || !chairmanId) {
            return res.status(400).json({ message: 'Committee name and chairman are required.' });
        }

        const committee = new Committee({
            name,
            chairman: chairmanId,
            createdBy: adminId,
            approvalStatus: 'pending_chairman_suggestion'
        });

        await committee.save();

        // Notify the chairman
        const notification = new Notification({
            user: chairmanId,
            message: `You have been appointed as Chairman for the committee: ${name}. Please suggest a convener and members.`,
            link: `/committee/${committee._id}`
        });
        await notification.save();

        res.status(201).json(committee);
    } catch (error) {
        res.status(500).json({ message: 'Error creating committee', error: error.message });
    }
};

// Chairman suggests convener and members
exports.suggestCommitteeMembers = async (req, res) => {
    try {
        const { committeeId } = req.params;
        const { suggestedConvener, suggestedMembers } = req.body;
        const chairmanId = req.user.id;

        const committee = await Committee.findById(committeeId);

        if (!committee) {
            return res.status(404).json({ message: 'Committee not found' });
        }

        if (committee.chairman.toString() !== chairmanId) {
            return res.status(403).json({ message: 'Only the chairman can suggest members.' });
        }

        committee.suggestedConvener = suggestedConvener;
        committee.suggestedMembers = suggestedMembers;
        committee.approvalStatus = 'pending_admin_approval';
        committee.rejectionComment = undefined;

        await committee.save();

        // Notify the admin
        const adminId = committee.createdBy;
        const notification = new Notification({
            user: adminId,
            message: `The chairman of committee "${committee.name}" has suggested members for approval.`,
            link: `/committee/${committee._id}`
        });
        await notification.save();

        res.status(200).json(committee);
    } catch (error) {
        res.status(500).json({ message: 'Error suggesting members', error: error.message });
    }
};

// Admin approves suggested members
exports.approveCommitteeMembers = async (req, res) => {
    try {
        const { committeeId } = req.params;
        const adminId = req.user.id;

        const committee = await Committee.findById(committeeId);

        if (!committee) {
            return res.status(404).json({ message: 'Committee not found' });
        }

        if (committee.createdBy.toString() !== adminId) {
            return res.status(403).json({ message: 'Only the creating admin can approve members.' });
        }

        committee.convener = committee.suggestedConvener;
        committee.members = committee.suggestedMembers;
        committee.approvalStatus = 'approved';
        committee.suggestedConvener = undefined;
        committee.suggestedMembers = [];

        await committee.save();

        // Notify the chairman
        const notification = new Notification({
            user: committee.chairman,
            message: `The members you suggested for committee "${committee.name}" have been approved.`,
            link: `/committee/${committee._id}`
        });
        await notification.save();

        res.status(200).json(committee);
    } catch (error) {
        res.status(500).json({ message: 'Error approving members', error: error.message });
    }
};

// Admin rejects suggested members
exports.rejectCommitteeMembers = async (req, res) => {
    try {
        const { committeeId } = req.params;
        const { rejectionComment } = req.body;
        const adminId = req.user.id;

        const committee = await Committee.findById(committeeId);

        if (!committee) {
            return res.status(404).json({ message: 'Committee not found' });
        }

        if (committee.createdBy.toString() !== adminId) {
            return res.status(403).json({ message: 'Only the creating admin can reject members.' });
        }

        committee.approvalStatus = 'rejected_by_admin';
        committee.rejectionComment = rejectionComment;
        committee.suggestedConvener = undefined;
        committee.suggestedMembers = [];

        await committee.save();

        // Notify the chairman
        const notification = new Notification({
            user: committee.chairman,
            message: `The members you suggested for committee "${committee.name}" were not approved. Reason: ${rejectionComment}`,
            link: `/committee/${committee._id}`
        });
        await notification.save();

        res.status(200).json(committee);
    } catch (error) {
        res.status(500).json({ message: 'Error rejecting members', error: error.message });
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