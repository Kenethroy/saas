import { Navigate } from "react-router-dom";
import { useAuthUser } from "@/shared/hooks/useAuthUser";
import { canAccess } from "@/shared/utils/access-control";

function GuardLoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="rounded-sm border border-[#d7e3ec] bg-white px-5 py-4 text-[12px] font-bold text-[#1a3557] shadow-paper">
        Checking access...
      </div>
    </div>
  );
}

export function PermissionRoute({ children, permission = null, permissions = [], requireAny = false }) {
  const { token, user, isLoadingUser, isUserError } = useAuthUser();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (isLoadingUser) {
    return <GuardLoadingScreen />;
  }

  if (isUserError || !user) {
    return <Navigate to="/login" replace />;
  }

  if (!canAccess(user, { permission, permissions, requireAny })) {
    return <Navigate to="/forbidden" replace />;
  }

  return children;
}
