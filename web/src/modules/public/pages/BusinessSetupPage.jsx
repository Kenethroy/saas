import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { platformApi } from "../../../lib/api";
import { platformStorage } from "../../../lib/storage";
import { Field, FieldRow, SectionCard, StatusBanner } from "../../../shared/ui/Primitives";

export function BusinessSetupPage({ session, setSession }) {
  const navigate = useNavigate();
  const draft = platformStorage.getBusinessDraft();
  const [form, setForm] = useState({
    preferredSubdomain: draft?.preferredSubdomain || "",
    businessName: draft?.businessName || "",
    legalName: draft?.legalName || "",
    businessType: draft?.businessType || "",
    phone: draft?.phone || "",
    businessEmail: draft?.businessEmail || session?.account?.email || "",
    address: draft?.address || "",
    currencyCode: draft?.currencyCode || "PHP",
    timezone: draft?.timezone || "Asia/Manila",
    ownerUsername: draft?.ownerUsername || "",
    primaryBranchName: draft?.primaryBranchName || "Main Branch"
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");

    try {
      const onboarding = await platformApi.startOnboarding(session.token, form);
      const nextSession = { ...session, onboarding };
      platformStorage.setBusinessDraft(form);
      platformStorage.setSession(nextSession);
      setSession(nextSession);
      setMessage("Business setup saved. Continue to plan selection.");
      navigate("/setup/plans");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <SectionCard
      eyebrow="Step 2"
      title="Capture business setup"
      description="This saves the subdomain and onboarding progress through `POST /platform/onboarding/start`."
    >
      {message ? <StatusBanner tone="success">{message}</StatusBanner> : null}
      {error ? <StatusBanner tone="danger">{error}</StatusBanner> : null}

      <form className="stack" onSubmit={submit}>
        <FieldRow>
          <Field label="Preferred subdomain" hint="Lowercase letters, numbers, and dashes only">
            <input
              required
              value={form.preferredSubdomain}
              onChange={(event) => setForm((current) => ({ ...current, preferredSubdomain: event.target.value.toLowerCase() }))}
            />
          </Field>
          <Field label="Owner username">
            <input
              required
              value={form.ownerUsername}
              onChange={(event) => setForm((current) => ({ ...current, ownerUsername: event.target.value }))}
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Business name">
            <input
              required
              value={form.businessName}
              onChange={(event) => setForm((current) => ({ ...current, businessName: event.target.value }))}
            />
          </Field>
          <Field label="Legal name">
            <input
              value={form.legalName}
              onChange={(event) => setForm((current) => ({ ...current, legalName: event.target.value }))}
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Business type">
            <input
              value={form.businessType}
              onChange={(event) => setForm((current) => ({ ...current, businessType: event.target.value }))}
            />
          </Field>
          <Field label="Primary branch name">
            <input
              value={form.primaryBranchName}
              onChange={(event) => setForm((current) => ({ ...current, primaryBranchName: event.target.value }))}
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Phone">
            <input
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
            />
          </Field>
          <Field label="Business email">
            <input
              type="email"
              value={form.businessEmail}
              onChange={(event) => setForm((current) => ({ ...current, businessEmail: event.target.value }))}
            />
          </Field>
        </FieldRow>

        <Field label="Address">
          <textarea
            rows={4}
            value={form.address}
            onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
          />
        </Field>

        <FieldRow>
          <Field label="Currency code">
            <input
              value={form.currencyCode}
              onChange={(event) => setForm((current) => ({ ...current, currencyCode: event.target.value.toUpperCase() }))}
            />
          </Field>
          <Field label="Timezone">
            <input
              value={form.timezone}
              onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))}
            />
          </Field>
        </FieldRow>

        <button className="primary-button" disabled={pending} type="submit">
          {pending ? "Saving setup..." : "Save Business Setup"}
        </button>
      </form>
    </SectionCard>
  );
}
