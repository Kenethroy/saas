import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { platformApi } from "./lib/api";
import { platformStorage } from "./lib/storage";

const platformBaseDomain = import.meta.env.VITE_PLATFORM_BASE_DOMAIN || "";

function Shell({ session, onLogout, children }) {
  return (
    <div className="shell">
      <header className="topbar">
        <Link className="brand" to="/">
          <span className="brand-mark">JR</span>
          <span>
            <strong>JRSPC SaaS</strong>
            <small>Platform onboarding</small>
          </span>
        </Link>

        <nav className="topnav">
          <Link to="/register">Register</Link>
          <Link to="/setup/business">Business Setup</Link>
          <Link to="/setup/plans">Plans</Link>
          <Link to="/setup/payment">Payment</Link>
          <Link to="/setup/status">Status</Link>
          {session ? (
            <button className="ghost-button" type="button" onClick={onLogout}>
              Sign Out
            </button>
          ) : null}
        </nav>
      </header>

      <main>{children}</main>
    </div>
  );
}

function SectionCard({ eyebrow, title, description, children }) {
  return (
    <section className="card">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h2>{title}</h2>
      {description ? <p className="muted lead">{description}</p> : null}
      {children}
    </section>
  );
}

function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function FieldRow({ children }) {
  return <div className="field-row">{children}</div>;
}

function StatusBanner({ tone = "neutral", children }) {
  return <div className={`status-banner ${tone}`}>{children}</div>;
}

function ProtectedRoute({ session, children }) {
  if (!session?.token) {
    return <Navigate to="/register" replace />;
  }

  return children;
}

function LandingPage() {
  return (
    <div className="page-grid">
      <section className="hero">
        <div>
          <p className="eyebrow">Public SaaS onboarding</p>
          <h1>From signup to activated tenant without manual provisioning.</h1>
          <p className="lead">
            Register the owner account, capture business details, pick a term, and hand off billing to
            Stripe with a clean activation path behind it.
          </p>
          <div className="cta-row">
            <Link className="primary-button" to="/register">
              Start Registration
            </Link>
            <Link className="ghost-button" to="/setup/plans">
              Explore Plans
            </Link>
          </div>
        </div>

        <div className="hero-panel">
          <div className="metric">
            <strong>3</strong>
            <span>plan families</span>
          </div>
          <div className="metric">
            <strong>12</strong>
            <span>plan-price variants</span>
          </div>
          <div className="metric">
            <strong>1</strong>
            <span>checkout source of truth</span>
          </div>
        </div>
      </section>

      <div className="card-grid">
        <SectionCard
          eyebrow="Flow"
          title="Structured onboarding"
          description="Account creation, business setup, plan selection, payment, status polling, and tenant redirect are separated into explicit routes."
        />
        <SectionCard
          eyebrow="Billing"
          title="Stripe-first checkout"
          description="The public app uses the platform API and surfaces either a live Checkout Session URL or the mock webhook path during local integration."
        />
        <SectionCard
          eyebrow="Tenancy"
          title="Recovery-safe lifecycle"
          description="Inactive subscriptions can renew without being trapped behind tenant guards, while webhook processing remains public and idempotent."
        />
      </div>
    </div>
  );
}

function RegisterPage({ session, setSession }) {
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

function BusinessSetupPage({ session, setSession }) {
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

function PlanSelectionPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    platformApi.listPlans()
      .then((result) => {
        if (!active) return;
        setPlans(Array.isArray(result) ? result : []);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectPrice = (planPriceCode) => {
    const checkout = platformStorage.getCheckout() || {};
    platformStorage.setCheckout({
      ...checkout,
      planPriceCode
    });
    navigate("/setup/payment");
  };

  return (
    <SectionCard
      eyebrow="Step 3"
      title="Choose a plan price"
      description="This page reads `GET /platform/plans` and persists the selected `planPriceCode` for checkout."
    >
      {loading ? <StatusBanner>Loading plan catalog...</StatusBanner> : null}
      {error ? <StatusBanner tone="danger">{error}</StatusBanner> : null}

      <div className="plan-grid">
        {plans.map((plan) => (
          <article className="plan-card" key={plan.code}>
            <div>
              <p className="eyebrow">{plan.code}</p>
              <h3>{plan.name}</h3>
              <p className="muted">{plan.description || "Plan details available during checkout."}</p>
            </div>

            <div className="price-stack">
              {(plan.prices || []).map((price) => (
                <button
                  className="price-option"
                  key={price.code}
                  type="button"
                  onClick={() => selectPrice(price.code)}
                >
                  <span>{price.name}</span>
                  <strong>{price.price === null ? "Custom" : `${price.currencyCode} ${Number(price.price).toLocaleString()}`}</strong>
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </SectionCard>
  );
}

function PaymentPage({ session }) {
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

function OnboardingStatusPage({ session, setSession }) {
  const [state, setState] = useState({
    loading: false,
    error: "",
    onboarding: platformStorage.getCheckout()?.onboardingId ? session?.onboarding : null
  });

  const onboardingId = platformStorage.getCheckout()?.onboardingId || session?.onboarding?.id;

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
      const onboarding = await platformApi.getOnboardingStatus(session.token, onboardingId);
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

        {state.onboarding?.completedAt ? (
          <Link className="primary-button" to="/auth/redirect">
            Continue to Login Redirect
          </Link>
        ) : null}
      </div>
    </SectionCard>
  );
}

function LoginRedirectPage({ session }) {
  const tenant = session?.onboarding?.tenant;
  const tenantUrl = useMemo(() => {
    if (!tenant?.subdomain || !platformBaseDomain) {
      return null;
    }

    return `https://${tenant.subdomain}.${platformBaseDomain}`;
  }, [tenant]);

  return (
    <SectionCard
      eyebrow="Step 6"
      title="Redirect into the tenant app"
      description="Once onboarding is completed, this route surfaces the provisioned tenant domain and acts as the bridge into the ERP frontend."
    >
      {tenant ? (
        <div className="stack">
          <div className="summary-panel">
            <span>Provisioned tenant</span>
            <strong>{tenant.name}</strong>
          </div>
          <div className="summary-panel">
            <span>Primary subdomain</span>
            <strong>{tenant.subdomain || "Not available"}</strong>
          </div>
          {tenantUrl ? (
            <a className="primary-button" href={tenantUrl} rel="noreferrer" target="_blank">
              Open {tenantUrl}
            </a>
          ) : (
            <StatusBanner tone="warning">
              Set `VITE_PLATFORM_BASE_DOMAIN` to generate a direct tenant URL from the subdomain.
            </StatusBanner>
          )}
        </div>
      ) : (
        <StatusBanner tone="warning">
          No completed tenant is available yet. Return to status polling until the provisioning flow reaches `completed`.
        </StatusBanner>
      )}
    </SectionCard>
  );
}

export default function App() {
  const navigate = useNavigate();
  const [session, setSession] = useState(() => platformStorage.getSession());

  const logout = () => {
    platformStorage.clearSession();
    setSession(null);
    navigate("/");
  };

  return (
    <Shell session={session} onLogout={logout}>
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
      </Routes>
    </Shell>
  );
}
