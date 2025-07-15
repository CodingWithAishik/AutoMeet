import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../axios.config';
import { UserDataContext } from '../context/UserDataContext';

const SuggestMembers = () => {
    const { committeeId } = useParams();
    const { user } = useContext(UserDataContext);
    const navigate = useNavigate();
    const [committee, setCommittee] = useState(null);
    const [users, setUsers] = useState([]);
    const [suggestedConvener, setSuggestedConvener] = useState('');
    const [suggestedMembers, setSuggestedMembers] = useState([]);

    useEffect(() => {
        const fetchCommitteeAndUsers = async () => {
            try {
                const [committeeRes, usersRes] = await Promise.all([
                    axios.get(`/api/committees/${committeeId}`),
                    axios.get('/api/users')
                ]);
                setCommittee(committeeRes.data);
                setUsers(usersRes.data);
            } catch (error) {
                console.error('Error fetching data:', error);
            }
        };
        fetchCommitteeAndUsers();
    }, [committeeId]);

    const handleMemberSelection = (e) => {
        const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
        setSuggestedMembers(selectedOptions);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`/api/committees/${committeeId}/suggest-members`, {
                suggestedConvener,
                suggestedMembers
            });
            alert('Suggestions submitted to admin for approval.');
            navigate('/home');
        } catch (error) {
            console.error('Error submitting suggestions:', error);
            alert('Failed to submit suggestions.');
        }
    };

    if (!committee) return <div>Loading...</div>;

    // Only chairman can see this page
    if (committee.chairman !== user?._id) {
        return <div>You are not authorized to view this page.</div>;
    }

    return (
        <div>
            <h2>Suggest Members for {committee.name}</h2>
            <form onSubmit={handleSubmit}>
                <div>
                    <label>Convener</label>
                    <select value={suggestedConvener} onChange={(e) => setSuggestedConvener(e.target.value)} required>
                        <option value="">Select Convener</option>
                        {users.map(u => (
                            <option key={u._id} value={u._id}>{u.fullname.firstname} {u.fullname.lastname}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label>Members</label>
                    <select multiple value={suggestedMembers} onChange={handleMemberSelection} required>
                        {users.map(u => (
                            <option key={u._id} value={u._id}>{u.fullname.firstname} {u.fullname.lastname}</option>
                        ))}
                    </select>
                </div>
                <button type="submit">Submit Suggestions</button>
            </form>
        </div>
    );
};

export default SuggestMembers;
