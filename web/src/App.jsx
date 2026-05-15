import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppRoutes } from "./app/AppRoutes";
import { platformStorage } from "./lib/storage";
import { AppShell } from "./shared/ui/AppShell";

export default function App() {
  const navigate = useNavigate();
  const [session, setSession] = useState(() => platformStorage.getSession());
  const [adminSession, setAdminSession] = useState(() => platformStorage.getAdminSession());

  const logout = () => {
    platformStorage.clearSession();
    setSession(null);
    navigate("/");
  };

  const adminLogout = () => {
    platformStorage.clearAdminSession();
    setAdminSession(null);
    navigate("/admin/login");
  };

  return (
    <AppShell session={session} adminSession={adminSession} onLogout={logout} onAdminLogout={adminLogout}>
      <AppRoutes
        adminSession={adminSession}
        session={session}
        setAdminSession={setAdminSession}
        setSession={setSession}
      />
    </AppShell>
  );
}
