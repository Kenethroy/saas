import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { platformApi } from "../../../lib/api";
import { platformStorage } from "../../../lib/storage";
import { Field, FieldRow, SectionCard, StatusBanner } from "../../../shared/ui/Primitives";

export function RegisterPage({ session, setSession }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: session?.account?.firstName || "",
    lastName: session?.account?.lastName || "",
    email: session?.account?.email || "",
    password: ""
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setPending(true);
    setError("");

    try {
      const response = await platformApi.register(form);
      platformStorage.setSession(response);
      setSession(response);
      navigate("/setup/business");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <SectionCard
      eyebrow="Step 1"
      title="Register the owner account"
      description="This uses `POST /platform/accounts/register` and stores the returned platform token locally for the next onboarding steps."
    >
      {session?.token ? (
        <StatusBanner tone="success">
          Signed in as <strong>{session.account.email}</strong>. Continue to business setup or sign out from the top bar.
        </StatusBanner>
      ) : null}

      {error ? <StatusBanner tone="danger">{error}</StatusBanner> : null}

      <form className="stack" onSubmit={submit}>
        <FieldRow>
          <Field label="First name">
            <input
              value={form.firstName}
              onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
            />
          </Field>
          <Field label="Last name">
            <input
              value={form.lastName}
              onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
            />
          </Field>
        </FieldRow>

        <Field label="Email">
          <input
            type="email"
            required
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          />
        </Field>

        <Field label="Password" hint="Minimum 8 characters">
          <input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
          />
        </Field>

        <button className="primary-button" disabled={pending} type="submit">
          {pending ? "Creating account..." : "Create Account"}
        </button>
      </form>
    </SectionCard>
  );
}
