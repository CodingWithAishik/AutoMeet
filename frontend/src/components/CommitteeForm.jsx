const CommitteeForm = ({ 
  formData = {
    committeeName: '',
    committeePurpose: '',
    chairman: { name: '', email: '' }
  }, 
  users = [], 
  onSubmit, 
  onChange, 
  onAddMember 
}) => {
  return (
    <form onSubmit={onSubmit}>
      <div className="form-group">
        <label>Committee Name:</label>
        <input
          type="text"  
          value={formData.committeeName || ''}
          onChange={(e) => onChange('committeeName', e.target.value)}
          required
        />
      </div>

      <div className="form-group">
        <label>Committee Purpose:</label>
        <input
          type="text"
          value={formData.committeePurpose || ''}
          onChange={(e) => onChange('committeePurpose', e.target.value)}
          required
        />
      </div>


      <div className="form-group">
        <label>Chairman:</label>
        <select
          value={formData.chairman?.email || ''}
          onChange={(e) => {
            const selectedUser = users.find(user => user.email === e.target.value);
            if (selectedUser) {
              onChange('chairman', {
                name: `${selectedUser.fullname.firstname} ${selectedUser.fullname.lastname}`,
                email: selectedUser.email
              });
            }
          }}
          required
        >
          <option value="">Select Chairman</option>
          {users.map((user) => (
            <option key={user._id} value={user.email}>
              {user.fullname.firstname} {user.fullname.lastname} ({user.email})
            </option>
          ))}
        </select>
      </div>

      <button type="submit" className="committeebtn">
        Create Committee
      </button>
    </form>
  );
};

import PropTypes from 'prop-types';

CommitteeForm.propTypes = {
  formData: PropTypes.shape({
    committeeName: PropTypes.string,
    committeePurpose: PropTypes.string,
    chairman: PropTypes.shape({
      name: PropTypes.string,
      email: PropTypes.string
    }),
    convener: PropTypes.shape({
      name: PropTypes.string,
      email: PropTypes.string
    }),
    members: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string,
        email: PropTypes.string
      })
    )
  }),
  users: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
      email: PropTypes.string.isRequired,
      fullname: PropTypes.shape({
        firstname: PropTypes.string.isRequired,
        lastname: PropTypes.string.isRequired
      }).isRequired
    })
  ),
  onSubmit: PropTypes.func,
  onChange: PropTypes.func,
  onAddMember: PropTypes.func
};

export default CommitteeForm;