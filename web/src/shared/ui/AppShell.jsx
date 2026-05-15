import { NavLink, useLocation } from "react-router-dom";

const publicNavItems = [
  { to: "/register", label: "Register" },
  { to: "/setup/business", label: "Business Setup" },
  { to: "/setup/plans", label: "Plans" },
  { to: "/setup/payment", label: "Payment" },
  { to: "/setup/status", label: "Status" },
  { to: "/admin/subscriptions", label: "Admin" }
];

const adminNavItems = [
  { to: "/admin/login", label: "Admin Login" },
  { to: "/admin/subscriptions", label: "Subscription Review" },
  { to: "/admin/onboarding-audit", label: "Domain Audit" },
  { to: "/admin/plans", label: "Plan Catalog" },
  { to: "/register", label: "Public Flow" }
];

function linkClassName({ isActive }) {
  return `topnav-link${isActive ? " active" : ""}`;
}

export function AppShell({ session, adminSession, onLogout, onAdminLogout, children }) {
  const location = useLocation();
  const adminMode = location.pathname.startsWith("/admin");
  const activeSession = adminMode ? adminSession : session;
  const logoutHandler = adminMode ? onAdminLogout : onLogout;
  const navItems = adminMode ? adminNavItems : publicNavItems;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-copy">
          <NavLink className="brand" to="/">
            <span className="brand-mark">JR</span>
            <span>
              <strong>JRSPC SaaS</strong>
              <small>{adminMode ? "Platform administration" : "Platform onboarding"}</small>
            </span>
          </NavLink>
          <span className={`mode-pill ${adminMode ? "admin" : "public"}`}>
            {adminMode ? "Admin Module" : "Public Module"}
          </span>
        </div>

        <nav className="topnav">
          {navItems.map((item) => (
            <NavLink key={item.to} className={linkClassName} to={item.to}>
              {item.label}
            </NavLink>
          ))}
          {activeSession ? (
            <button className="ghost-button topnav-button" type="button" onClick={logoutHandler}>
              Sign Out
            </button>
          ) : null}
        </nav>
      </header>

      <main className="page-stack">{children}</main>
    </div>
  );
}
