import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { platformAdminApi } from "../../../lib/api";
import { platformStorage } from "../../../lib/storage";
import { Field, SectionCard, StatusBanner } from "../../../shared/ui/Primitives";

export function AdminLoginPage({ adminSession, setAdminSession }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    credential: adminSession?.account?.email || "",
    password: ""
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  if (adminSession?.token) {
    return <Navigate to="/admin/subscriptions" replace />;
  }

  const submit = async (event) => {
    event.preventDefault();
    setPending(true);
    setError("");

    try {
      const response = await platformAdminApi.login(form);
      platformStorage.setAdminSession(response);
      setAdminSession(response);
      navigate("/admin/subscriptions");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPending(false);
    }
  };

  return (
    <SectionCard
      eyebrow="Platform Admin"
      title="Authenticate into the control plane"
      description="This uses `POST /platform/admin/auth/login` and stores a separate platform-admin session for plan management tasks."
      className="feature-card"
    >
      {error ? <StatusBanner tone="danger">{error}</StatusBanner> : null}

      <form className="stack" onSubmit={submit}>
        <Field label="Admin email">
          <input
            type="email"
            required
            value={form.credential}
            onChange={(event) => setForm((current) => ({ ...current, credential: event.target.value }))}
          />
        </Field>

        <Field label="Password">
          <input
            type="password"
            required
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
          />
        </Field>

        <button className="primary-button" disabled={pending} type="submit">
          {pending ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </SectionCard>
  );
}
