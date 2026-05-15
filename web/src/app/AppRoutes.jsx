import { Navigate, Route, Routes } from "react-router-dom";
import { AdminLoginPage } from "../modules/admin/pages/AdminLoginPage";
import { OnboardingAuditPage } from "../modules/admin/pages/OnboardingAuditPage";
import { PlanManagementPage } from "../modules/admin/pages/PlanManagementPage";
import { SubscriptionReviewPage } from "../modules/admin/pages/SubscriptionReviewPage";
import { BusinessSetupPage } from "../modules/public/pages/BusinessSetupPage";
import { LandingPage } from "../modules/public/pages/LandingPage";
import { LoginRedirectPage } from "../modules/public/pages/LoginRedirectPage";
import { OnboardingStatusPage } from "../modules/public/pages/OnboardingStatusPage";
import { PaymentPage } from "../modules/public/pages/PaymentPage";
import { PlanSelectionPage } from "../modules/public/pages/PlanSelectionPage";
import { RegisterPage } from "../modules/public/pages/RegisterPage";
import { AdminProtectedRoute, ProtectedRoute } from "../shared/ui/RouteGuards";

export function AppRoutes({ session, setSession, adminSession, setAdminSession }) {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/register" element={<RegisterPage session={session} setSession={setSession} />} />
      <Route
        path="/setup/business"
        element={(
          <ProtectedRoute session={session}>
            <BusinessSetupPage session={session} setSession={setSession} />
          </ProtectedRoute>
        )}
      />
      <Route path="/setup/plans" element={<PlanSelectionPage />} />
      <Route
        path="/setup/payment"
        element={(
          <ProtectedRoute session={session}>
            <PaymentPage session={session} />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/setup/status"
        element={(
          <ProtectedRoute session={session}>
            <OnboardingStatusPage session={session} setSession={setSession} />
          </ProtectedRoute>
        )}
      />
      <Route
        path="/auth/redirect"
        element={(
          <ProtectedRoute session={session}>
            <LoginRedirectPage session={session} />
          </ProtectedRoute>
        )}
      />
      <Route path="/admin/login" element={<AdminLoginPage adminSession={adminSession} setAdminSession={setAdminSession} />} />
      <Route path="/admin" element={<Navigate to="/admin/subscriptions" replace />} />
      <Route
        path="/admin/subscriptions"
        element={(
          <AdminProtectedRoute adminSession={adminSession}>
            <SubscriptionReviewPage adminSession={adminSession} />
          </AdminProtectedRoute>
        )}
      />
      <Route
        path="/admin/onboarding-audit"
        element={(
          <AdminProtectedRoute adminSession={adminSession}>
            <OnboardingAuditPage adminSession={adminSession} />
          </AdminProtectedRoute>
        )}
      />
      <Route
        path="/admin/plans"
        element={(
          <AdminProtectedRoute adminSession={adminSession}>
            <PlanManagementPage adminSession={adminSession} />
          </AdminProtectedRoute>
        )}
      />
    </Routes>
  );
}
