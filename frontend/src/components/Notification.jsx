import { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { UserDataContext } from '../context/UserDataContext';
import { apiBaseUrl } from '../utils/apiBaseUrl';

const NotificationList = () => {
  const { user } = useContext(UserDataContext);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const currentUserId = user?._id ? String(user._id) : null;

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!currentUserId) {
        setNotifications([]);
        setLoading(false);
        return;
      }

      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${apiBaseUrl}/api/notifications`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        const scopedNotifications = Array.isArray(res.data)
          ? res.data.filter((notification) => String(notification.userId) === currentUserId)
          : [];
        setNotifications(scopedNotifications);
      } catch {
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, [currentUserId]);

  const handleNotificationClick = (notification) => {
    if (notification.link) {
      navigate(notification.link);
    }
  };

  if (!user?._id) return null;
  if (loading) return <div>Loading notifications...</div>;
  if (notifications.length === 0) return <div>No notifications.</div>;

  return (
    <div className="notification-list">
      <h4>Notifications</h4>
      <ul>
        {notifications.map((n) => (
          <li key={n._id} style={{ cursor: n.link ? 'pointer' : 'default', background: n.isRead ? '#eee' : '#ccefff' }} onClick={() => handleNotificationClick(n)}>
            {n.message}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default NotificationList;
