import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { platformApi } from "../../../lib/api";
import { platformStorage } from "../../../lib/storage";
import { SectionCard, StatusBanner } from "../../../shared/ui/Primitives";

export function PaymentPage({ session }) {
  const navigate = useNavigate();
  const businessDraft = platformStorage.getBusinessDraft();
  const selectedCheckout = platformStorage.getCheckout() || {};
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(platformStorage.getCheckout());

  const ready = Boolean(session?.token && businessDraft?.preferredSubdomain && selectedCheckout?.planPriceCode);

  const submit = async () => {
    if (!ready) {
      setError("Complete the account, business setup, and plan selection steps first.");
      return;
    }

    setPending(true);
    setError("");

    try {
      const checkout = await platformApi.createCheckout(session.token, {
        ...businessDraft,
        planPriceCode: selectedCheckout.planPriceCode,
        provider: "stripe"
      });

      platformStorage.setCheckout({
        ...checkout,
        planPriceCode: selectedCheckout.planPriceCode
      });
      setResult({
        ...checkout,
        planPriceCode: selectedCheckout.planPriceCode
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <SectionCard
      eyebrow="Step 4"
      title="Start payment"
      description="This triggers `POST /platform/subscriptions/checkout` with the saved onboarding draft and selected `planPriceCode`."
    >
      {!ready ? (
        <StatusBanner tone="warning">
          Account registration, business setup, and plan selection must be completed before checkout.
        </StatusBanner>
      ) : null}
      {error ? <StatusBanner tone="danger">{error}</StatusBanner> : null}

      <div className="stack">
        <div className="summary-panel">
          <span>Plan price</span>
          <strong>{selectedCheckout.planPriceCode || "Not selected"}</strong>
        </div>

        <button className="primary-button" disabled={!ready || pending} type="button" onClick={submit}>
          {pending ? "Creating checkout..." : "Create Stripe Checkout Session"}
        </button>

        {result?.paymentLinkUrl ? (
          <StatusBanner tone="success">
            Checkout created. Open the payment session:
            {" "}
            <a href={result.paymentLinkUrl} rel="noreferrer" target="_blank">
              {result.paymentLinkUrl}
            </a>
          </StatusBanner>
        ) : null}

        {result?.mockWebhookPayload ? (
          <StatusBanner tone="warning">
            Mock billing mode is active. Continue to status after replaying the webhook payload against the backend.
          </StatusBanner>
        ) : null}

        {result?.onboardingId ? (
          <button className="ghost-button" type="button" onClick={() => navigate("/setup/status")}>
            View Onboarding Status
          </button>
        ) : null}
      </div>
    </SectionCard>
  );
}
