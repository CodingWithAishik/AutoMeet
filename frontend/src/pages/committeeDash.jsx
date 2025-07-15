import { useState, useEffect, useContext, useCallback } from "react";
import { useNavigate, useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { jsPDF } from "jspdf";
import "../styles/committeeDash.css";
import { UserDataContext } from '../context/UserDataContext';
import React from "react";

function CommitteeDashboard() {
    const navigate = useNavigate();
    const { id } = useParams();
    const { user } = useContext(UserDataContext);

    const [committee, setCommittee] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showRecentMeetings, setShowRecentMeetings] = useState(false);
    const [selectedMinutes, setSelectedMinutes] = useState("");
    const [showMinutes, setShowMinutes] = useState(false);
    const [editedMinutes, setEditedMinutes] = useState("");
    const [selectedMeetingIndex, setSelectedMeetingIndex] = useState(null);
    const [suggestionBoxIndex, setSuggestionBoxIndex] = useState(null);
    const [suggestionText, setSuggestionText] = useState("");
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestions] = useState([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);

    useEffect(() => {
        const fetchCommittee = async () => {
            try {
                const response = await axios.get(`/api/committees/${id}`);
                setCommittee(response.data);
                setLoading(false);
            } catch (err) {
                setError(err.message);
                setLoading(false);
            }
        };
        fetchCommittee();
    }, [id]);

    // Determine the user's role for this committee
    let userCommitteeRole = null;
    if (committee && user?._id) {
        if (committee.chairman && committee.chairman === user._id) {
            userCommitteeRole = "chairman";
        } else if (committee.convener && committee.convener === user._id) {
            userCommitteeRole = "convener";
        } else if (committee.members && Array.isArray(committee.members)) {
            const found = committee.members.find(m => m === user._id);
            if (found) userCommitteeRole = "member";
        }
    }

    // Global admin check (remains admin for all committees)
    const isAdmin = user?.status === "admin";
    // Role-based access for this committee
    const isConvener = userCommitteeRole === "convener";
    const isMember = userCommitteeRole === "member";
    const isChairman = userCommitteeRole === "chairman";
    // Admin can always see Manage Users, but other actions are per-committee role
    const canEditMinutes = isConvener;
    const canScheduleMeetings = isConvener;
    const canManageUsers = isAdmin;
    const canSuggestMembers = isChairman && committee?.approvalStatus === 'pending_chairman_suggestion';
    const canResuggestMembers = isChairman && committee?.approvalStatus === 'rejected_by_admin';
    const canApproveMembers = isAdmin && committee?.approvalStatus === 'pending_admin_approval';

    const [newMinutesText, setNewMinutesText] = useState("");
    const [showCreateMoM, setShowCreateMoM] = useState(false);
    const [newMoMTopic, setNewMoMTopic] = useState("");
    const [newMoMDate, setNewMoMDate] = useState("");
    const [newMoMTime, setNewMoMTime] = useState("");


    const DUMMY_RECENT_MEETINGS = React.useMemo(() => [
        {
            topic: "Budget Planning",
            date: "2024-03-10",
            time: "10:00 AM",
            minutesText: "Discussed allocation of funds for upcoming projects and reviewed last quarter's expenses."
        },
        {
            topic: "Annual Report Discussion",
            date: "2024-03-15",
            time: "2:30 PM",
            minutesText: "Reviewed department performance, proposed improvements, and finalized the annual report format."
        },
        {
            topic: "Event Coordination",
            date: "2024-03-20",
            time: "11:00 AM",
            minutesText: "Planned logistics, assigned roles, and confirmed the venue for the upcoming seminar."
        }
    ], []);

    const [recentMeetings, setRecentMeetings] = useState([]);

    const fetchMinutes = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(
                `/api/minutes/committee/${id}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            if (response.data && response.data.length > 0) {
                setRecentMeetings(response.data);
            }
        } catch (error) {
            console.error("Failed to fetch minutes:", error);
        }
    }, [id]);

    useEffect(() => {
        fetchMinutes();
    }, [fetchMinutes]);

    if (loading) return <div>Loading...</div>;
    if (error) return <div>Error: {error}</div>;
    if (!committee) return <div>Committee not found.</div>;

    const handleSuggestPeople = () => {
        navigate(`/committee/${id}/suggest-members`);
    };

    const handleApproveMembers = () => {
        navigate(`/committee/${id}/approve-members`);
    };

    const handleToggleRecentMeetings = () => {
        if (!showRecentMeetings && recentMeetings.length === 0) {
            fetchMinutes();
        }
        setShowRecentMeetings(prev => !prev);
    };

    const handleViewMinutes = (minutesText, index) => {
        setSelectedMinutes(minutesText);
        setEditedMinutes(minutesText);
        setSelectedMeetingIndex(index);
        setShowMinutes(true);
    };

    const handleSaveMinutes = async () => {
    if (selectedMeetingIndex === null) return;

    const updatedMeetings = [...recentMeetings];
    updatedMeetings[selectedMeetingIndex].minutesText = editedMinutes;

    // Detect if it's a dummy meeting (no _id property)
    const isDummy = !recentMeetings[selectedMeetingIndex]._id;

    if (isDummy) {
        // Just update the local state
        setRecentMeetings(updatedMeetings);
        setShowMinutes(false);
        setSelectedMeetingIndex(null);
        alert("Dummy meeting minutes updated locally.");
        return;
    }

    if (!canEditMinutes) return;

    try {
        const token = localStorage.getItem('token');
        const meeting = recentMeetings[selectedMeetingIndex];
        // Validate and format date/time
        const formattedDate = meeting.date ? new Date(meeting.date).toISOString().slice(0, 10) : '';
        let formattedTime = meeting.time;
        if (formattedTime && formattedTime.length === 5 && formattedTime[2] === ':') {
            // already in HH:mm
        } else if (formattedTime && formattedTime.match(/\d{1,2}:\d{2}\s?(AM|PM)/i)) {
            // Convert 12-hour to 24-hour
            const [time, period] = formattedTime.split(/\s/);
            let [hours, minutes] = time.split(":");
            hours = parseInt(hours, 10);
            if (/PM/i.test(period) && hours < 12) hours += 12;
            if (/AM/i.test(period) && hours === 12) hours = 0;
            formattedTime = `${hours.toString().padStart(2, '0')}:${minutes}`;
        }
        if (!meeting.topic || !formattedDate || !formattedTime || !editedMinutes.trim()) {
            alert("All fields (topic, date, time, minutes) are required.");
            return;
        }
        await axios.put(
            `${import.meta.env.VITE_BASE_URL}/api/minutes/${meeting._id}`,
            {
                topic: meeting.topic,
                date: formattedDate,
                time: formattedTime,
                minutesText: editedMinutes,
                committeeId: meeting.committeeId || committee._id || id
            },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        await fetchMinutes();
        setShowMinutes(false);
        setSelectedMeetingIndex(null);
    } catch (err) {
        setError('Failed to save minutes: ' + (err.response?.data?.message || err.message));
        alert('Failed to save minutes: ' + (err.response?.data?.message || err.message));
    }
};

    const handleSaveNewMoM = async () => {
        if (!newMoMTopic.trim() || !newMoMDate || !newMoMTime || !newMinutesText.trim()) {
            alert("Please fill in all fields for the new MoM.");
            return;
        }
        try {
            const token = localStorage.getItem("token");
            await axios.post(
                `${import.meta.env.VITE_BASE_URL}/api/minutes/create`,
                {
                    committeeId: id,
                    topic: newMoMTopic,
                    date: newMoMDate,
                    time: newMoMTime,
                    minutesText: newMinutesText
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                }
            );
            alert("MoM saved successfully!");
            setNewMinutesText("");
            setNewMoMTopic("");
            setNewMoMDate("");
            setNewMoMTime("");
            setShowCreateMoM(false);
            fetchMinutes();
        } catch (err) {
            console.error("Error saving MoM:", err);
            alert("Failed to save MoM.");
        }
    };

    const handleGeneratePDF = () => {
        if (!selectedMinutes) return;
        const doc = new jsPDF();
        const maxWidth = 190;
        const textLines = doc.splitTextToSize(selectedMinutes, maxWidth);
        doc.text(textLines, 10, 10);
        doc.save("minutes.pdf");
    };

    const handleDissolveCommittee = async () => {
        const confirmed = window.confirm('Are you sure you want to dissolve this committee? This action cannot be undone.');
        if (!confirmed) return;
        try {
            const token = localStorage.getItem('token');
            await axios.delete(
                `${import.meta.env.VITE_BASE_URL}/api/committees/${id}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    data: { committeeId: id }
                }
            );
            alert('Committee dissolved successfully.');
            navigate('/committee');
        } catch (err) {
            console.error('Error dissolving committee:', err);
            setError(err.response?.data?.message || 'Error dissolving committee');
            alert('Failed to dissolve committee: ' + (err.response?.data?.message || err.message));
        }
    };

    const handleSubmitSuggestion = async (meetingId) => {
        if (!meetingId) {
            alert("Cannot submit suggestion for this meeting.");
            return;
        }
        if (!suggestionText.trim()) return;

        try {
            const token = localStorage.getItem('token');
            await axios.post(
                `${import.meta.env.VITE_BASE_URL}/api/minutes/${meetingId}/suggestions`,
                {
                    userId: user._id,
                    suggestion: suggestionText.trim()
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            alert("Suggestion submitted successfully.");
            setSuggestionBoxIndex(null);
            setSuggestionText("");
        } catch (err) {
            console.error('Error submitting suggestion:', err);
            alert("Failed to submit suggestion.");
        }
    };



    // For convener: suggestions grouped by MoM
    const [momSuggestions, setMomSuggestions] = useState([]);

    useEffect(() => {
        if (isConvener && showRecentMeetings) {
            const fetchSuggestions = async () => {
                setLoadingSuggestions(true);
                try {
                    const token = localStorage.getItem('token');
                    const res = await axios.get(
                        `${import.meta.env.VITE_BASE_URL}/api/minutes/committee/${id}/suggestions`,
                        {
                            headers: {
                                Authorization: `Bearer ${token}`,
                                'Content-Type': 'application/json'
                            }
                        }
                    );
                    setMomSuggestions(res.data || []);
                } catch {
                    setMomSuggestions([]);
                } finally {
                    setLoadingSuggestions(false);
                }
            };
            fetchSuggestions();
        }
    }, [isConvener, showRecentMeetings, id]);

    return (
        <div className="committee-dashboard">
            <header className="dashboard-header">
                <h1>{committee.name}</h1>
                <div className="header-actions">
                    {canSuggestMembers && <button onClick={handleSuggestPeople}>Suggest People</button>}
                    {canResuggestMembers && (
                        <div>
                            <p><strong>Admin's Comment:</strong> {committee.rejectionComment}</p>
                            <button onClick={handleSuggestPeople}>Resuggest People</button>
                        </div>
                    )}
                    {canApproveMembers && <button onClick={handleApproveMembers}>Review Suggestions</button>}
                    <button onClick={() => navigate('/home')}>Home</button>
                    <button onClick={() => navigate('/user/logout')}>Logout</button>
                </div>
            </header>
            <main className="dashboard-main">
                <section className="committee-details">
                    <h2>Committee Details</h2>
                    <p><strong>Chairman:</strong> {committee.chairman?.name}</p>
                    {committee.approvalStatus === 'approved' && (
                        <>
                            <p><strong>Convener:</strong> {committee.convener?.name}</p>
                            <p><strong>Members:</strong></p>
                            <ul>
                                {committee.members?.map(m => <li key={m._id}>{m.name}</li>)}
                            </ul>
                        </>
                    )}
                </section>
                {/* The rest of the dashboard components */}
            </main>
        </div>
    );
}

export default CommitteeDashboard;
