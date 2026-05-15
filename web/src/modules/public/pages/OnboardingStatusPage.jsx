import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { platformApi } from "../../../lib/api";
import { platformStorage } from "../../../lib/storage";
import { SectionCard, StatusBanner } from "../../../shared/ui/Primitives";

export function OnboardingStatusPage({ session, setSession }) {
  const checkout = platformStorage.getCheckout() || {};
  const [state, setState] = useState({
    loading: false,
    error: "",
    onboarding: checkout?.onboardingId ? session?.onboarding : null
  });

  const onboardingId = checkout?.onboardingId || session?.onboarding?.id;

  const shouldAttemptStripeConfirm = Boolean(
    session?.token
    && checkout?.provider === "stripe"
    && checkout?.providerMode === "live"
    && checkout?.referenceId
    && checkout?.paymentSessionId
  );

  const refresh = async () => {
    if (!session?.token || !onboardingId) {
      setState({
        loading: false,
        error: "No onboarding session available yet.",
        onboarding: null
      });
      return;
    }

    setState((current) => ({ ...current, loading: true, error: "" }));

    try {
      let onboarding = await platformApi.getOnboardingStatus(session.token, onboardingId);

      if (
        shouldAttemptStripeConfirm
        && (!onboarding?.completedAt || onboarding?.subscription?.status !== "active")
      ) {
        const confirmation = await platformApi.confirmCheckout(session.token, {
          provider: checkout.provider,
          referenceId: checkout.referenceId,
          paymentSessionId: checkout.paymentSessionId
        });

        if (confirmation?.confirmed) {
          onboarding = await platformApi.getOnboardingStatus(session.token, onboardingId);
        }
      }

      const nextSession = {
        ...session,
        onboarding
      };

      platformStorage.setSession(nextSession);
      setSession(nextSession);
      setState({
        loading: false,
        error: "",
        onboarding
      });
    } catch (requestError) {
      setState({
        loading: false,
        error: requestError.message,
        onboarding: null
      });
    }
  };

  useEffect(() => {
    if (!session?.token || !onboardingId) {
      return undefined;
    }

    refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => window.clearInterval(timer);
  }, [onboardingId, session?.token]);

  return (
    <SectionCard
      eyebrow="Step 5"
      title="Monitor onboarding status"
      description="This polls `GET /platform/onboarding/:id/status` so the public app can wait for webhook confirmation and tenant provisioning."
    >
      {state.error ? <StatusBanner tone="danger">{state.error}</StatusBanner> : null}

      <div className="stack">
        <button className="ghost-button" disabled={state.loading} type="button" onClick={refresh}>
          {state.loading ? "Refreshing..." : "Refresh Status"}
        </button>

        {state.onboarding ? (
          <div className="status-grid">
            <div className="summary-panel">
              <span>Current step</span>
              <strong>{state.onboarding.currentStep}</strong>
            </div>
            <div className="summary-panel">
              <span>Tenant</span>
              <strong>{state.onboarding.tenant?.name || "Pending"}</strong>
            </div>
            <div className="summary-panel">
              <span>Subscription</span>
              <strong>{state.onboarding.subscription?.status || "Pending"}</strong>
            </div>
          </div>
        ) : null}

        {shouldAttemptStripeConfirm && !state.onboarding?.completedAt ? (
          <StatusBanner tone="warning">
            This page will try to reconcile a successful Stripe checkout in case the webhook has not reached the local backend yet.
          </StatusBanner>
        ) : null}

        {state.onboarding?.completedAt ? (
          <Link className="primary-button" to="/auth/redirect">
            Continue to Login Redirect
          </Link>
        ) : null}
      </div>
    </SectionCard>
  );
}
