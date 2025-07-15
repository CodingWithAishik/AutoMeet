import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../axios.config';
import { UserDataContext } from '../context/UserDataContext';

const ApproveMembers = () => {
    const { committeeId } = useParams();
    const { user } = useContext(UserDataContext);
    const navigate = useNavigate();
    const [committee, setCommittee] = useState(null);
    const [rejectionComment, setRejectionComment] = useState('');

    useEffect(() => {
        const fetchCommittee = async () => {
            try {
                const response = await axios.get(`/api/committees/${committeeId}`);
                setCommittee(response.data);
            } catch (error) {
                console.error('Error fetching committee:', error);
            }
        };
        fetchCommittee();
    }, [committeeId]);

    const handleApprove = async () => {
        try {
            await axios.post(`/api/committees/${committeeId}/approve-members`);
            alert('Committee members approved.');
            navigate('/home');
        } catch (error) {
            console.error('Error approving members:', error);
            alert('Failed to approve members.');
        }
    };

    const handleReject = async () => {
        if (!rejectionComment) {
            alert('Please provide a reason for rejection.');
            return;
        }
        try {
            await axios.post(`/api/committees/${committeeId}/reject-members`, { rejectionComment });
            alert('Suggestions rejected. The chairman will be notified.');
            navigate('/home');
        } catch (error) {
            console.error('Error rejecting members:', error);
            alert('Failed to reject members.');
        }
    };

    if (!committee) return <div>Loading...</div>;

    // Only admin can see this page
    if (user?.status !== 'admin') {
        return <div>You are not authorized to view this page.</div>;
    }

    return (
        <div>
            <h2>Approve Members for {committee.name}</h2>
            <p><strong>Suggested Convener:</strong> {committee.suggestedConvener?.name}</p>
            <p><strong>Suggested Members:</strong></p>
            <ul>
                {committee.suggestedMembers?.map(m => <li key={m._id}>{m.name}</li>)}
            </ul>

            {committee.approvalStatus === 'pending_admin_approval' && (
                <div>
                    <button onClick={handleApprove}>Approve</button>
                    <div>
                        <textarea 
                            placeholder="Reason for rejection" 
                            value={rejectionComment} 
                            onChange={(e) => setRejectionComment(e.target.value)}
                        />
                        <button onClick={handleReject}>Reject</button>
                    </div>
                </div>
            )}

            {committee.approvalStatus === 'rejected_by_admin' && (
                <div>
                    <p><strong>Rejection Comment:</strong> {committee.rejectionComment}</p>
                    <p>Waiting for chairman to resubmit suggestions.</p>
                </div>
            )}
        </div>
    );
};

export default ApproveMembers;
