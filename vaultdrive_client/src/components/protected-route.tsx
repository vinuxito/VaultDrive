import { Navigate, Outlet } from 'react-router-dom';
import { DashboardLayout } from './layout/dashboard-layout';

const useAuth = () => {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  return {
    isAuthenticated: !!token,
    forcePasswordChange: !!user.force_password_change,
  };
};

export const ProtectedRoute = () => {
  const { isAuthenticated, forcePasswordChange } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (forcePasswordChange) {
    return <Navigate to="/force-password-change" replace />;
  }

  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
};
