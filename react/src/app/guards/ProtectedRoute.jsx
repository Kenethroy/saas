import { Navigate, useLocation } from "react-router-dom";
import { useAuthUser } from "@/shared/hooks/useAuthUser";
import { useWorkspaceContext } from "@/shared/hooks/useWorkspaceContext";

const subscriptionExemptPaths = new Set([
  "/tenant/subscription",
  "/admin/profile",
  "/forbidden"
]);

export function ProtectedRoute({ children }) {
  const location = useLocation();
  const { token, isLoadingUser, isUserError } = useAuthUser();
  const { isSubscriptionActive } = useWorkspaceContext();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (isLoadingUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="rounded-sm border border-[#d7e3ec] bg-white px-5 py-4 text-[12px] font-bold text-[#1a3557] shadow-paper">
          Loading workspace...
        </div>
      </div>
    );
  }

  if (isUserError) {
    return <Navigate to="/login" replace />;
  }

  if (!isSubscriptionActive && !subscriptionExemptPaths.has(location.pathname)) {
    return <Navigate to="/tenant/subscription" replace state={{ from: location }} />;
  }

  return children;
}
