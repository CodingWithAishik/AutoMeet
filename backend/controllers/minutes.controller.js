require('../models/user.model'); // Ensure User model is registered before any population
const MinutesOfMeeting = require('../models/MInutesOfMeeting');
const Suggestion = require('../models/suggestion.model');
const Notification = require('../models/notification.model');
const Committee = require('../models/committee.model');
const { getUserIdsByEmails } = require('./user.controller');

const MAX_NOTES_LENGTH = 8000;

function normalizeLine(line) {
    return String(line || '').replace(/\s+/g, ' ').trim();
}

function collectActionItems(lines) {
    const actionPrefixes = [/^todo[:\-]?\s*/i, /^action[:\-]?\s*/i, /^ai[:\-]?\s*/i, /^follow[- ]?up[:\-]?\s*/i];
    return lines
        .filter((line) => actionPrefixes.some((re) => re.test(line)) || /\b(will|must|should|by\s+\d{4}-\d{2}-\d{2})\b/i.test(line))
        .slice(0, 8)
        .map((line, idx) => `${idx + 1}. ${line.replace(/^[-*\d.\s]+/, '')}`);
}

function collectDecisions(lines) {
    return lines
        .filter((line) => /\b(decided|approved|resolved|agreed)\b/i.test(line))
        .slice(0, 6)
        .map((line, idx) => `${idx + 1}. ${line.replace(/^[-*\d.\s]+/, '')}`);
}

function buildDraft({ topic, date, time, rawNotes }) {
    const cleaned = String(rawNotes || '').slice(0, MAX_NOTES_LENGTH);
    const lines = cleaned
        .split(/\r?\n/)
        .map(normalizeLine)
        .filter(Boolean);

    const summaryCandidates = lines.slice(0, 3);
    const decisions = collectDecisions(lines);
    const actionItems = collectActionItems(lines);

    const discussion = lines
        .slice(0, 10)
        .map((line, idx) => `${idx + 1}. ${line.replace(/^[-*\d.\s]+/, '')}`);

    return [
        `Topic: ${topic}`,
        `Date: ${date}`,
        `Time: ${time}`,
        '',
        'Summary:',
        summaryCandidates.length ? summaryCandidates.map((line, idx) => `${idx + 1}. ${line}`).join('\n') : '1. Summary to be added.',
        '',
        'Key Discussions:',
        discussion.length ? discussion.join('\n') : '1. Key discussion points to be added.',
        '',
        'Decisions:',
        decisions.length ? decisions.join('\n') : '1. No explicit decisions captured from notes.',
        '',
        'Action Items:',
        actionItems.length ? actionItems.join('\n') : '1. No explicit action items detected. Add owners and deadlines manually.',
        '',
        'Notes:',
        '- This draft is assistant-generated from your raw notes. Please review before publishing.'
    ].join('\n');
}

const createMinutes = async (req, res) => {
    try {
        const { committeeId, topic, date, time, minutesText } = req.body;
        if (!committeeId || !topic || !date || !time || !minutesText) {
            return res.status(400).json({ message: 'All fields are required.' });
        }
        const minutes = new MinutesOfMeeting({
            committeeId,
            topic,
            date,
            time,
            minutesText,
            attendees: [req.user._id],
            createdBy: req.user._id,
            status: 'published'
        });
        await minutes.save();
        // Notify all committee members (except the convener) about the new MoM
        const committee = await Committee.findById(committeeId);
        if (committee) {
            // Exclude the convener (req.user.email) from notification recipients
            const allMemberEmails = [committee.chairman.email, ...committee.members.map(m => m.email)]
                .filter(email => email !== req.user.email);
            const userIds = await getUserIdsByEmails(allMemberEmails);
            const message = `A new MoM has been created for committee: ${committee.committeeName}`;
            // Link to the committee dashboard for this committee
            const link = `/committeeDashboard/${committeeId}`;
            await sendNotification(userIds, message, link);
        }
        res.status(201).json(minutes);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getMinutesByCommittee = async (req, res) => {
    try {
        const { committeeId } = req.params;
        const minutes = await MinutesOfMeeting.find({ committeeId })
            .populate('createdBy', 'fullname')
            .populate('lastEditedBy', 'fullname')
            .sort({ date: -1 });
        res.status(200).json(minutes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const updateMinutes = async (req, res) => {
    try {
        const { id } = req.params;
        const update = {
            ...req.body,
            lastEditedBy: req.user._id,
            lastEditedAt: new Date()
        };
        // Ensure date is a Date object if present
        if (update.date) {
            update.date = new Date(update.date);
        }
        const minutes = await MinutesOfMeeting.findByIdAndUpdate(
            id,
            update,
            { new: true }
        );

        if (!minutes) {
            return res.status(404).json({ message: 'Minutes not found' });
        }

        res.status(200).json(minutes);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const deleteMinutes = async (req, res) => {
    try {
        const minutes = await MinutesOfMeeting.findByIdAndDelete(req.params.id);
        if (!minutes) {
            return res.status(404).json({ message: 'Minutes not found' });
        }
        res.status(200).json({ message: 'Minutes deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const addSuggestion = async (req, res) => {
    try {
        const { meetingId } = req.params;
        const { userId, suggestion } = req.body;
        if (!suggestion || !userId) {
            return res.status(400).json({ message: 'Suggestion and userId are required.' });
        }
        const newSuggestion = new Suggestion({
            meetingId,
            userId,
            suggestion
        });
        await newSuggestion.save();
        // Notify the convener of the committee for this meeting
        const mom = await MinutesOfMeeting.findById(meetingId);
        if (mom) {
            const committee = await Committee.findById(mom.committeeId);
            if (committee) {
                const convenerEmail = committee.convener.email;
                const convenerIdArr = await getUserIdsByEmails([convenerEmail]);
                const message = `A new suggestion was submitted: "${suggestion}"`;
                const link = `/committeeDashboard/${committee._id}`;
                await sendNotification(convenerIdArr, message, link);
            }
        }
        res.status(201).json(newSuggestion);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

const getSuggestionsByMeeting = async (req, res) => {
    try {
        const { meetingId } = req.params;
        const suggestions = await Suggestion.find({ meetingId })
            .populate('userId', 'fullname email')
            .sort({ createdAt: -1 });
        res.status(200).json(suggestions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const deleteSuggestion = async (req, res) => {
    try {
        const suggestion = await Suggestion.findByIdAndDelete(req.params.id);
        if (!suggestion) {
            return res.status(404).json({ message: 'Suggestion not found' });
        }
        res.status(200).json({ message: 'Suggestion deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get all suggestions for all MoMs of a committee, grouped by MoM
const getAllSuggestionsByCommittee = async (req, res) => {
    try {
        const { committeeId } = req.params;
        // Get all MoMs for this committee
        const moms = await MinutesOfMeeting.find({ committeeId });
        const momIds = moms.map(m => m._id);
        // Get all suggestions for these MoMs
        const suggestions = await Suggestion.find({ meetingId: { $in: momIds } })
            .populate('userId', 'fullname email')
            .sort({ createdAt: -1 });
        // Group suggestions by MoM
        const grouped = moms.map(mom => ({
            mom,
            suggestions: suggestions.filter(s => s.meetingId.toString() === mom._id.toString())
        }));
        res.status(200).json(grouped);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Add this function to send notifications to users
async function sendNotification(userIds, message, link = null) {
    if (!Array.isArray(userIds)) userIds = [userIds];
    if (!userIds.length) {
        return;
    }
    const notifications = userIds.map(userId => ({ userId, message, link }));
    await Notification.insertMany(notifications);
}

const generateMinutesDraft = async (req, res) => {
    try {
        const { committeeId, topic, date, time, rawNotes } = req.body;
        if (!committeeId || !topic || !date || !time || !rawNotes) {
            return res.status(400).json({ message: 'committeeId, topic, date, time and rawNotes are required.' });
        }

        if (String(rawNotes).length > MAX_NOTES_LENGTH) {
            return res.status(400).json({ message: `rawNotes must be ${MAX_NOTES_LENGTH} characters or fewer.` });
        }

        const committee = await Committee.findById(committeeId);
        if (!committee) {
            return res.status(404).json({ message: 'Committee not found' });
        }

        const draft = buildDraft({ topic, date, time, rawNotes });
        return res.status(200).json({ draft });
    } catch (error) {
        console.error('generateMinutesDraft error:', error.message);
        return res.status(500).json({ message: 'Failed to generate minutes draft' });
    }
};

module.exports = {
    createMinutes,
    getMinutesByCommittee,
    updateMinutes,
    deleteMinutes,
    addSuggestion,
    getSuggestionsByMeeting,
    deleteSuggestion,
    sendNotification,
    getAllSuggestionsByCommittee,
    generateMinutesDraft
};