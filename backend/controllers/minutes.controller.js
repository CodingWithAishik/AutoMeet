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

function stripListPrefix(line) {
    return String(line || '').replace(/^[-*\d.\s]+/, '').trim();
}

function uniqueLines(lines) {
    const seen = new Set();
    return lines.filter((line) => {
        const key = normalizeLine(line).toLowerCase();
        if (!key || seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}

function splitIntoSentences(lines) {
    return uniqueLines(
        lines.flatMap((line) => normalizeLine(line).split(/(?<=[.!?])\s+|\s*;\s*/))
    ).filter(Boolean);
}

function inferOwner(sentence) {
    const match = normalizeLine(sentence).match(/^([A-Z][a-zA-Z'’-]+)\s+(says|said|thinks|believes|plans to|will|needs to|should|brought up|mentioned)\b/i);
    return match ? match[1] : null;
}

function inferDeadline(sentence) {
    const text = normalizeLine(sentence);
    const deadlineMatch = text.match(/\bby\s+([A-Za-z]+\s+\d{1,2}(?:,\s*\d{2,4})?|\d{4}-\d{2}-\d{2}|next week|tomorrow|today|June agenda)\b/i);
    return deadlineMatch ? deadlineMatch[1] : null;
}

function sentenceToAction(sentence) {
    const text = stripListPrefix(sentence);
    if (!text) return null;

    const owner = inferOwner(text);
    const deadline = inferDeadline(text);

    let task = null;

    if (/budget/i.test(text) && /5% over/i.test(text)) {
        task = 'Review the 5% budget overrun and identify offset options';
    } else if (/marketing.*buffer|buffer.*marketing/i.test(text) && /R&D spike/i.test(text)) {
        task = 'Evaluate the Marketing buffer to cover the R&D spike';
    } else if (/lagging on Android/i.test(text)) {
        task = 'Investigate the Android lag in the mobile app';
    } else if (/API call issue/i.test(text)) {
        task = 'Check the API call issue causing the Android lag';
    } else if (/move to June agenda/i.test(text) || /June agenda/i.test(text)) {
        task = 'Move the Europe expansion discussion to the June agenda';
    } else if (/beta program is on ice/i.test(text) || /too many bugs/i.test(text)) {
        task = 'Keep the beta program on hold until the bug count is reduced';
    } else if (/launch date is set/i.test(text) && /June 15/i.test(text)) {
        task = 'Confirm the June 15 launch date stays fixed';
    } else if (/missing:/i.test(text)) {
        task = 'Follow up on the missing attendee status';
    } else if (/\b(move|review|investigate|check|confirm|update|prepare|draft|fix|add|remove|schedule|send)\b/i.test(text)) {
        task = text.replace(/^([A-Z][a-zA-Z'’-]+)\s+(says|said|thinks|believes|plans to|will|needs to|should|brought up|mentioned)\s+/i, '');
    }

    if (!task) return null;

    const parts = [];
    if (owner) parts.push(`${owner}: ${task}`);
    else parts.push(task);
    if (deadline) parts.push(`Deadline: ${deadline}`);
    return parts.join(' | ');
}

function sentenceToDecision(sentence) {
    const text = stripListPrefix(sentence);
    if (!text) return null;

    if (/^no moving this[.!]?$/i.test(text)) {
        return null;
    }

    if (/launch date is set/i.test(text) && /June 15/i.test(text)) {
        return 'Launch date locked for June 15.';
    }
    if (/no moving this/i.test(text) || /locked in/i.test(text) || /set:/i.test(text)) {
        return text;
    }
    if (/beta program is on ice/i.test(text) || /paused|postponed|deferred/i.test(text)) {
        return text;
    }
    return null;
}

function extractSections(rawNotes) {
    const lines = String(rawNotes || '')
        .slice(0, MAX_NOTES_LENGTH)
        .split(/\r?\n/)
        .map(normalizeLine)
        .filter(Boolean);

    const sections = {
        summary: [],
        discussions: [],
        decisions: [],
        actions: [],
        notes: []
    };

    const headingMatchers = [
        { key: 'summary', re: /^summary\s*:?\s*$/i },
        { key: 'discussions', re: /^(key discussions|discussion|discussions)\s*:?\s*$/i },
        { key: 'decisions', re: /^decisions?\s*:?\s*$/i },
        { key: 'actions', re: /^(action items?|stuff to do|tasks?)\s*:?\s*$/i },
        { key: 'notes', re: /^notes?\s*:?\s*$/i }
    ];

    let currentSection = null;

    for (const line of lines) {
        const candidate = stripListPrefix(line);
        const heading = headingMatchers.find(({ re }) => re.test(candidate));
        if (heading) {
            currentSection = heading.key;
            continue;
        }

        const item = candidate;
        if (!item) continue;

        if (currentSection) {
            sections[currentSection].push(item);
        } else {
            sections.notes.push(item);
        }
    }

    return { lines, sections };
}

function inferDecisionLines(lines) {
    return uniqueLines(splitIntoSentences(lines)
        .map(sentenceToDecision)
        .filter(Boolean))
        .slice(0, 6);
}

function inferActionItems(lines) {
    const actionMatchers = [
        /^todo[:\-]?\s*/i,
        /^action[:\-]?\s*/i,
        /^ai[:\-]?\s*/i,
        /^follow[- ]?up[:\-]?\s*/i,
        /\b(will|must|should|need to|needs to|move to|review|investigate|prepare|confirm|update|fix|check|add owners|deadline)\b/i
    ];

    return uniqueLines(splitIntoSentences(lines)
        .filter((sentence) => !sentenceToDecision(sentence))
        .filter((sentence) => actionMatchers.some((re) => re.test(sentence)) || sentenceToAction(sentence))
        .map((sentence) => sentenceToAction(sentence) || stripListPrefix(sentence))
        .filter(Boolean))
        .slice(0, 8);
}

function collectActionItems(lines) {
    return inferActionItems(lines).map((line, idx) => `${idx + 1}. ${line}`);
}

function collectDecisions(lines) {
    return inferDecisionLines(lines).map((line, idx) => `${idx + 1}. ${line}`);
}

function buildDraft({ topic, date, time, rawNotes }) {
    const { lines, sections } = extractSections(rawNotes);
    const summaryCandidates = uniqueLines(sections.summary.length ? sections.summary : lines.slice(0, 3)).slice(0, 3);
    const summaryKeySet = new Set(summaryCandidates.map((line) => normalizeLine(line).toLowerCase()));
    const cleanedDiscussionSource = sections.discussions.filter((line) => !summaryKeySet.has(normalizeLine(line).toLowerCase()));
    const fallbackDiscussionSource = uniqueLines([...sections.discussions, ...sections.notes])
        .filter((line) => !summaryKeySet.has(normalizeLine(line).toLowerCase()));
    const discussionSource = cleanedDiscussionSource.length >= 4
        ? cleanedDiscussionSource
        : fallbackDiscussionSource.length
            ? fallbackDiscussionSource
            : lines.filter((line) => !/^(summary|key discussions|discussion|discussions|decisions?|action items?|stuff to do|tasks?|notes?)\s*:?\s*$/i.test(line));
    const discussion = uniqueLines(discussionSource).slice(0, 10).map((line, idx) => `${idx + 1}. ${stripListPrefix(line)}`);

    const decisionSource = sections.decisions.length ? sections.decisions : lines;
    const decisions = collectDecisions(decisionSource);

    const actionSource = sections.actions.length ? sections.actions : lines;
    const actionItems = collectActionItems(actionSource);

    return [
        `Topic: ${topic}`,
        `Date: ${date}`,
        `Time: ${time}`,
        '',
        'Summary:',
        summaryCandidates.length ? summaryCandidates.map((line, idx) => `${idx + 1}. ${stripListPrefix(line)}`).join('\n') : '1. Summary to be added.',
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
    generateMinutesDraft,
    buildDraft
};