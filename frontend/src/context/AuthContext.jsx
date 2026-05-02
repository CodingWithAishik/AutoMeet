import { createContext, useState, useEffect } from 'react';
import axios from 'axios';
import PropTypes from 'prop-types';
import { apiBaseUrl } from '../utils/apiBaseUrl';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));

    useEffect(() => {
        if (token) {
            axios.get(`${apiBaseUrl}/users/profile`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            .then(response => {
                setUser(response.data);
            })
            .catch(() => {
                setToken(null);
                localStorage.removeItem('token');
            });
        }
    }, [token]);

    const login = (token) => {
        setToken(token);
        localStorage.setItem('token', token);
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

AuthProvider.propTypes = {
    children: PropTypes.node.isRequired
};