import { Navigate } from "react-router-dom";

export function ProtectedRoute({ session, children }) {
  if (!session?.token) {
    return <Navigate to="/register" replace />;
  }

  return children;
}

export function AdminProtectedRoute({ adminSession, children }) {
  if (!adminSession?.token) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}
