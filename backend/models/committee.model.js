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
    committeeName: { type: String, required: true },
    committeePurpose: { type: String, required: true },
    chairman: { 
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: true },
        name: { type: String, required: true },
        email: { type: String, required: true }
    },
    // Only set after admin approval
    convener: {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
        name: { type: String },
        email: { type: String }
    },
    // Only set after admin approval
    members: [memberSchema],
    // Chairman's suggestions (pending approval)
    suggestedConvener: {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
        name: { type: String },
        email: { type: String }
    },
    suggestedMembers: [memberSchema],
    // Status: pending_suggestions, pending_approval, formed, rejected
    status: { type: String, enum: ['pending_suggestions', 'pending_approval', 'formed', 'rejected'], default: 'pending_suggestions' },
    // Admin's comment if rejected
    adminComment: { type: String },
    pastMeetings: [pastMeetingSchema], // Optional array of past meetings
    upcomingMeetings: [upcomingMeetingSchema] // Optional array of upcoming meetings
});

// Create and export the Committee model
module.exports = mongoose.model('Committee', committeeSchema);