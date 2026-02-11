import { Navigate, Outlet } from 'react-router-dom';
import { DashboardLayout } from './layout/dashboard-layout';

const useAuth = () => {
  const token = localStorage.getItem('token');
  // In a real app, you'd also validate the token here
  return { isAuthenticated: !!token };
};

export const ProtectedRoute = () => {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
};
