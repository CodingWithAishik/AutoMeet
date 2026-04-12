import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

const PrivateRoute = () => {
    const { user } = useAuth();

    return user ? <Outlet /> : <Navigate to="/Login" />;
};

export default PrivateRoute;
