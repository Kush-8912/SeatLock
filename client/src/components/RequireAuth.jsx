import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ErrorState, PageLoader } from './States';

// Route guard. The server enforces every rule anyway; this just sends people
// to the right place instead of showing them a 401/403 page.
export function RequireAuth({ role, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (role && user.role !== role) {
    return <ErrorState title="Wrong account type" error={{ message: `This page is for ${role}s. You're signed in as an ${user.role}.` }} />;
  }
  return children;
}
