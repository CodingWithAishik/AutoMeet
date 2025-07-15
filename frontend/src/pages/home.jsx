import { useState, useContext, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { UserDataContext } from '../context/UserDataContext';

import styles from '../styles/home.module.css';

const Home = () => {
  const { user } = useContext(UserDataContext); // Fetch user data from context
  const [notifications, setNotifications] = useState([]);
  const [showNotis, setShowNotis] = useState(false);
  const navigate = useNavigate();

  // Fetch notifications from API
  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token'); // Fetch token from localStorage
      const response = await axios.get(`/api/notifications`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setNotifications(response.data);
    } catch {
      setNotifications([]);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleNotificationClick = (notification) => {
    // Mark notification as read
    axios.put(`/api/notifications/${notification._id}/read`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    // Navigate to the link
    navigate(notification.link);
  };
  // Removed userCommittees, errorMessage, loading state as 'Your Committees' section is removed

  // Removed useEffect for fetching user committees as 'Your Committees' section is removed

  return (
    <div>
      {/* Header Section */}
      <header className={styles.pageHeader}>
        <h1>
          Meeting <br />
          Management Workspace
        </h1>
      </header>

      <div className={styles.container}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <h1>
            Meeting <br />
            Manager
          </h1>
          <nav className={styles.menu}>
            <Link to="/home" className={styles.menuItem}>
              Home
            </Link>
            <Link to="/committee" className={styles.menuItem}>
              Committee
            </Link>
            <Link to="/user/logout" className={styles.menuItem}>
              Logout
            </Link>
          </nav>
        </aside>

        {/* Main Content */}
        <div className={styles.homeContent}>
          <div className={styles.top}>
            {/* Profile Section */}
            <div className={styles.pfp}>
              <img
                src="https://static.vecteezy.com/system/resources/previews/036/280/650/original/default-avatar-profile-icon-social-media-user-image-gray-avatar-icon-blank-profile-silhouette-illustration-vector.jpg"
                alt="Profile"
              />
            </div>
            <div className={styles.person}>
              <p>
                <i className="fas fa-user"></i> Name: {user?.fullname?.firstname || 'Guest'}{' '}
                {user?.fullname?.lastname || ''}
              </p>
              <p>
                <i className="fas fa-envelope"></i> User ID: {user?.email || 'N/A'}
              </p>
              {user?.status === 'admin' && (
                <p>
                  <i className="fas fa-envelope"></i> Status: {user.status}
                </p>
              )}
            </div>

            {/* Notifications Section */}
            <div className={styles.noti}>
              <button onClick={() => setShowNotis(!showNotis)}>
                <img src="/assets/noti.png" alt="Notifications" />
                {notifications.filter(n => !n.isRead).length > 0 && (
                  <span className={styles.notiCount}>{notifications.filter(n => !n.isRead).length}</span>
                )}
              </button>
              {showNotis && (
                <div className={styles.notiDropdown}>
                  {notifications.map(n => (
                    <div key={n._id} onClick={() => handleNotificationClick(n)}>
                      {n.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Main Section */}
          <div className={styles.mainSection}>
            {/* Content for the main section can be added here */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
