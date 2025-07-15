import React, { useState, useEffect } from 'react';
import axios from '../axios.config';

const CommitteeForm = () => {
    const [name, setName] = useState('');
    const [chairmanId, setChairmanId] = useState('');
    const [users, setUsers] = useState([]);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await axios.get('/api/users');
                setUsers(response.data);
            } catch (error) {
                console.error('Error fetching users:', error);
            }
        };
        fetchUsers();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/committees/create', { name, chairmanId });
            alert('Committee created successfully! The chairman will be notified to suggest members.');
            setName('');
            setChairmanId('');
        } catch (error) {
            console.error('Error creating committee:', error);
            alert('Failed to create committee.');
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <h2>Create New Committee</h2>
            <div>
                <label>Committee Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
                <label>Chairman</label>
                <select value={chairmanId} onChange={(e) => setChairmanId(e.target.value)} required>
                    <option value="">Select Chairman</option>
                    {users.map(user => (
                        <option key={user._id} value={user._id}>{user.fullname.firstname} {user.fullname.lastname}</option>
                    ))}
                </select>
            </div>
            <button type="submit">Create Committee</button>
        </form>
    );
};

export default CommitteeForm;