import { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { UserDataContext } from '../context/UserDataContext';
import styles from '../styles/RegisterPage.module.css'; // Optional for custom styling

function RegisterPage() {
  const [firstname, setFirstName] = useState('');
  const [lastname, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const navigate = useNavigate();
  const { setUser } = useContext(UserDataContext);


  const resetFields = () => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (password !== confirmPassword) {
      setErrorMessage("Passwords don't match!");
      return;
    }

    const newUser = {
      fullname: {
        firstname: firstname, // Required
        lastname: lastname,   // Optional
      },
      email: email,           // Required
      password: password,     // Required
    };

    try {
      const response = await axios.post(
        `${import.meta.env.VITE_BASE_URL}/users/register`,
        newUser
      );

      if (response.status === 201) {
        setSuccessMessage('Registration successful! Redirecting to login...');
        resetFields();
        const data = response.data
        setUser(data.user)
        localStorage.setItem('token', data.token)
        setTimeout(() => navigate('/home'), 500); // Redirect after 2 seconds
      }
    } catch (error) {
      const errorResponse =
        error.response?.data?.message || 'Something went wrong!';
      setErrorMessage(errorResponse);
    }
  };

  return (
    <div className={styles.registercontainer}>
      <h1>Register</h1>
      <form onSubmit={handleRegister}>
        <div>
          <label htmlFor="firstname">First Name:</label>
          <input
            type="text"
            id="firstname"
            value={firstname}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="lastname">Last Name:</label>
          <input
            type="text"
            id="lastname"
            value={lastname}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="email">Email:</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="password">Password:</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ paddingRight: '2.5rem' }}
            />
            <span
              onClick={() => setShowPassword((prev) => !prev)}
              style={{
                position: 'absolute',
                right: '0.5rem',
                top: '50%',
                transform: 'translateY(-50%)',
                cursor: 'pointer',
                fontSize: '1.2rem',
                color: '#888'
              }}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? '🙈' : '👁️'}
            </span>
          </div>
        </div>
        <div>
          <label htmlFor="confirmPassword">Confirm Password:</label>
          <div style={{ position: 'relative' }}>
            <input
              type={showConfirmPassword ? "text" : "password"}
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              style={{ paddingRight: '2.5rem' }}
            />
            <span
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              style={{
                position: 'absolute',
                right: '0.5rem',
                top: '50%',
                transform: 'translateY(-50%)',
                cursor: 'pointer',
                fontSize: '1.2rem',
                color: '#888'
              }}
              title={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              {showConfirmPassword ? '🙈' : '👁️'}
            </span>
          </div>
        </div>
        {errorMessage && <p className={styles.errormessage}>{errorMessage}</p>}
        {successMessage && <p className={styles.successmessage}>{successMessage}</p>}
        <button type="submit">Register</button>
        <p>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
}

export default RegisterPage;
