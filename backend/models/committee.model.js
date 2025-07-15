const mongoose = require('mongoose');

// Define the schema for members
const memberSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    role: { type: String, enum: ['member', 'convener', 'chairman'], required: true }
});

// Define the schema for past meetings
const pastMeetingSchema = new mongoose.Schema({
    minutes: { type: String },
    summary: { type: String },
    date: { type: Date }, // Date of the meeting
    time: { type: String } // Time of the meeting
});

// Define the schema for upcoming meetings
const upcomingMeetingSchema = new mongoose.Schema({
    date: { type: Date }, // Date of the meeting
    time: { type: String } // Time of the meeting
});

// Define the main committee schema
const committeeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    chairman: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    convener: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    suggestedConvener: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    suggestedMembers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    approvalStatus: {
        type: String,
        enum: ['pending_chairman_suggestion', 'pending_admin_approval', 'approved', 'rejected_by_admin'],
        default: 'pending_chairman_suggestion'
    },
    rejectionComment: {
        type: String
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, { timestamps: true });

// Create and export the Committee model
module.exports = mongoose.model('Committee', committeeSchema);