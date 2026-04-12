import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import "../styles/committeeList.css";

const CommitteeList = ({ committees }) => {
  return (
    <div className="committee-list">
      <h2>Existing Committees</h2>
      {committees.length === 0 ? (
        <p>No committees found.</p>
      ) : (
        <div className="committees-grid">
          {committees.map((committee) => (
            <Link 
              to={`/committeeDashboard/${committee._id}`} 
              key={committee._id} 
              className="committee-card"
            >
              <h3>{committee.committeeName}</h3>
              <p><strong>Purpose:</strong> {committee.committeePurpose}</p>
              <div className="committee-members">
                <p><strong>Chairman:</strong> {committee.chairman?.name || "N/A"}</p>
                <p><strong>Convener:</strong> {committee.convener?.name || "N/A"}</p>
                <div className="members-section">
                  <strong>Members:</strong>
                  <ul>
                    {committee.members.map((member, index) => (
                      <li key={member.email || index}>{member.name}</li>
                    ))}
                  </ul>
                </div>
                {/* All role-based actions are now in the dashboard, not here */}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

CommitteeList.propTypes = {
  committees: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
      committeeName: PropTypes.string,
      committeePurpose: PropTypes.string,
      chairman: PropTypes.shape({
        name: PropTypes.string
      }),
      convener: PropTypes.shape({
        name: PropTypes.string
      }),
      members: PropTypes.arrayOf(
        PropTypes.shape({
          name: PropTypes.string,
          email: PropTypes.string
        })
      )
    })
  ).isRequired
};

export default CommitteeList;
