import { useEffect, useState } from "react";
import { platformAdminApi } from "../../../lib/api";
import { Field, FieldRow, SectionCard, StatusBanner } from "../../../shared/ui/Primitives";
import { formatDateTime, formatJsonPreview, formatStatusLabel } from "../../../shared/utils/formatters";

export function OnboardingAuditPage({ adminSession }) {
  const [form, setForm] = useState({
    q: "",
    currentStep: "",
    tenantStatus: "",
    domainStatus: "",
    perPage: "10"
  });
  const [query, setQuery] = useState({
    page: 1,
    perPage: 10
  });
  const [result, setResult] = useState({
    items: [],
    page: 1,
    perPage: 10,
    total: 0,
    totalPages: 1
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState({
    loading: false,
    error: "",
    data: null,
    onboardingId: null
  });

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError("");

    platformAdminApi.listOnboardingAudits(adminSession.token, query)
      .then((response) => {
        if (!active) {
          return;
        }

        setResult(response ?? {
          items: [],
          page: query.page,
          perPage: query.perPage,
          total: 0,
          totalPages: 1
        });
      })
      .catch((requestError) => {
        if (!active) {
          return;
        }

        setError(requestError.message);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [adminSession.token, query]);

  const loadAuditDetail = async (onboardingId) => {
    setDetail({
      loading: true,
      error: "",
      data: null,
      onboardingId
    });

    try {
      const response = await platformAdminApi.getOnboardingAudit(adminSession.token, onboardingId);
      setDetail({
        loading: false,
        error: "",
        data: response,
        onboardingId
      });
    } catch (requestError) {
      setDetail({
        loading: false,
        error: requestError.message,
        data: null,
        onboardingId
      });
    }
  };

  const submitFilters = (event) => {
    event.preventDefault();
    setQuery({
      q: form.q.trim(),
      currentStep: form.currentStep,
      tenantStatus: form.tenantStatus,
      domainStatus: form.domainStatus,
      perPage: Number(form.perPage) || 10,
      page: 1
    });
  };

  const clearFilters = () => {
    setForm({
      q: "",
      currentStep: "",
      tenantStatus: "",
      domainStatus: "",
      perPage: "10"
    });
    setQuery({
      page: 1,
      perPage: 10
    });
  };

  const selectedAudit = detail.data;
  const completedCount = result.items.filter((item) => item.onboarding.currentStep === "completed").length;
  const pendingDomainCount = result.items.filter((item) => {
    const status = item.primaryDomain?.status;
    return status && !["active", "verified"].includes(status);
  }).length;

  return (
    <SectionCard
      eyebrow="Platform Admin"
      title="Audit domains and onboarding"
      description="This screen reads `GET /platform/admin/onboarding-audit` for the audit feed and `GET /platform/admin/onboarding-audit/:id` for domain history, onboarding milestones, and recent provider events."
      className="feature-card"
    >
      <div className="status-grid admin-summary-grid">
        <div className="summary-panel">
          <span>Visible onboarding records</span>
          <strong>{result.total}</strong>
        </div>
        <div className="summary-panel">
          <span>Completed on page</span>
          <strong>{completedCount}</strong>
        </div>
        <div className="summary-panel">
          <span>Pending or failed domains</span>
          <strong>{pendingDomainCount}</strong>
        </div>
      </div>

      <form className="stack" onSubmit={submitFilters}>
        <FieldRow>
          <Field label="Search" hint="Account email, preferred subdomain, tenant name, slug, or domain">
            <input
              value={form.q}
              onChange={(event) => setForm((current) => ({ ...current, q: event.target.value }))}
            />
          </Field>
          <Field label="Rows per page">
            <select
              value={form.perPage}
              onChange={(event) => setForm((current) => ({ ...current, perPage: event.target.value }))}
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="50">50</option>
            </select>
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Onboarding step">
            <select
              value={form.currentStep}
              onChange={(event) => setForm((current) => ({ ...current, currentStep: event.target.value }))}
            >
              <option value="">All steps</option>
              <option value="account">Account</option>
              <option value="business_info">Business Info</option>
              <option value="plan">Plan</option>
              <option value="payment">Payment</option>
              <option value="activation">Activation</option>
              <option value="completed">Completed</option>
            </select>
          </Field>
          <Field label="Tenant status">
            <select
              value={form.tenantStatus}
              onChange={(event) => setForm((current) => ({ ...current, tenantStatus: event.target.value }))}
            >
              <option value="">All tenant states</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="suspended">Suspended</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Primary domain status">
            <select
              value={form.domainStatus}
              onChange={(event) => setForm((current) => ({ ...current, domainStatus: event.target.value }))}
            >
              <option value="">All domain states</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="active">Active</option>
              <option value="failed">Failed</option>
              <option value="redirected">Redirected</option>
            </select>
          </Field>
          <div />
        </FieldRow>

        <div className="admin-filter-actions">
          <button className="primary-button" type="submit">
            Apply Filters
          </button>
          <button className="ghost-button" type="button" onClick={clearFilters}>
            Clear
          </button>
        </div>
      </form>

      {loading ? <StatusBanner>Loading onboarding audit data...</StatusBanner> : null}
      {error ? <StatusBanner tone="danger">{error}</StatusBanner> : null}

      <div className="admin-review-grid">
        <div className="stack">
          {(result.items || []).map((item) => (
            <article
              className={`summary-panel admin-review-card ${detail.onboardingId === item.onboarding.id ? "selected" : ""}`}
              key={item.onboarding.id}
            >
              <div className="admin-review-header">
                <div>
                  <strong>{item.account.email}</strong>
                  <span className="muted admin-review-domain">
                    {item.primaryDomain?.domain || item.onboarding.preferredSubdomain || "No domain yet"}
                  </span>
                </div>
                <span className={`status-pill ${item.onboarding.currentStep === "completed" ? "success" : "warning"}`}>
                  {formatStatusLabel(item.onboarding.currentStep)}
                </span>
              </div>

              <div className="admin-review-facts">
                <div>
                  <span>Tenant</span>
                  <strong>{item.tenant?.name || "Not provisioned"}</strong>
                </div>
                <div>
                  <span>Tenant status</span>
                  <strong>{formatStatusLabel(item.tenant?.status || "pending")}</strong>
                </div>
                <div>
                  <span>Primary domain status</span>
                  <strong>{formatStatusLabel(item.primaryDomain?.status || "pending")}</strong>
                </div>
                <div>
                  <span>Subscription</span>
                  <strong>{formatStatusLabel(item.subscription?.status || "none")}</strong>
                </div>
                <div>
                  <span>Latest provider event</span>
                  <strong>{item.latestProviderEvent?.eventType || "None"}</strong>
                </div>
                <div>
                  <span>Updated</span>
                  <strong>{formatDateTime(item.onboarding.updatedAt)}</strong>
                </div>
              </div>

              <div className="admin-filter-actions">
                <button className="ghost-button" type="button" onClick={() => loadAuditDetail(item.onboarding.id)}>
                  {detail.loading && detail.onboardingId === item.onboarding.id ? "Loading..." : "Inspect Audit"}
                </button>
              </div>
            </article>
          ))}

          {!loading && !error && result.items.length === 0 ? (
            <StatusBanner tone="warning">
              No onboarding records matched the current audit filters.
            </StatusBanner>
          ) : null}

          <div className="admin-pagination">
            <button
              className="ghost-button"
              disabled={result.page <= 1 || loading}
              type="button"
              onClick={() => setQuery((current) => ({ ...current, page: current.page - 1 }))}
            >
              Previous
            </button>
            <div className="summary-panel admin-pagination-panel">
              <span>Page</span>
              <strong>{result.page} of {result.totalPages}</strong>
            </div>
            <button
              className="ghost-button"
              disabled={result.page >= result.totalPages || loading}
              type="button"
              onClick={() => setQuery((current) => ({ ...current, page: current.page + 1 }))}
            >
              Next
            </button>
          </div>
        </div>

        <aside className="summary-panel admin-detail-panel">
          <div className="admin-review-header">
            <div>
              <strong>Audit Detail</strong>
              <span className="muted admin-review-domain">
                {selectedAudit?.account?.email || "Select an onboarding record from the audit list"}
              </span>
            </div>
            {selectedAudit ? (
              <span className={`status-pill ${selectedAudit.onboarding.currentStep === "completed" ? "success" : "warning"}`}>
                {formatStatusLabel(selectedAudit.onboarding.currentStep)}
              </span>
            ) : null}
          </div>

          {detail.loading ? <StatusBanner>Loading audit detail...</StatusBanner> : null}
          {detail.error ? <StatusBanner tone="danger">{detail.error}</StatusBanner> : null}

          {selectedAudit ? (
            <div className="stack">
              <div className="admin-detail-section">
                <h3>Account and Tenant</h3>
                <div className="admin-review-facts">
                  <div>
                    <span>Account status</span>
                    <strong>{formatStatusLabel(selectedAudit.account.status)}</strong>
                  </div>
                  <div>
                    <span>Preferred subdomain</span>
                    <strong>{selectedAudit.onboarding.preferredSubdomain || "Not set"}</strong>
                  </div>
                  <div>
                    <span>Tenant</span>
                    <strong>{selectedAudit.tenant?.name || "Not provisioned"}</strong>
                  </div>
                  <div>
                    <span>Tenant status</span>
                    <strong>{formatStatusLabel(selectedAudit.tenant?.status || "pending")}</strong>
                  </div>
                </div>
              </div>

              <div className="admin-detail-section">
                <h3>Onboarding Milestones</h3>
                <div className="admin-review-facts">
                  <div>
                    <span>Created</span>
                    <strong>{formatDateTime(selectedAudit.onboarding.createdAt)}</strong>
                  </div>
                  <div>
                    <span>Business info</span>
                    <strong>{formatDateTime(selectedAudit.onboarding.businessInfoCompletedAt)}</strong>
                  </div>
                  <div>
                    <span>Plan selected</span>
                    <strong>{formatDateTime(selectedAudit.onboarding.planSelectedAt)}</strong>
                  </div>
                  <div>
                    <span>Payment completed</span>
                    <strong>{formatDateTime(selectedAudit.onboarding.paymentCompletedAt)}</strong>
                  </div>
                  <div>
                    <span>Webhook confirmed</span>
                    <strong>{formatDateTime(selectedAudit.onboarding.webhookConfirmedAt)}</strong>
                  </div>
                  <div>
                    <span>Completed</span>
                    <strong>{formatDateTime(selectedAudit.onboarding.completedAt)}</strong>
                  </div>
                </div>
              </div>

              <div className="admin-detail-section">
                <h3>Domains</h3>
                <div className="stack">
                  {(selectedAudit.domains || []).map((domain) => (
                    <div className="summary-panel admin-domain-card" key={domain.id}>
                      <div className="admin-review-header">
                        <div>
                          <strong>{domain.domain}</strong>
                          <span className="muted admin-review-domain">
                            {domain.subdomain || "No subdomain"} · {formatStatusLabel(domain.type)}
                          </span>
                        </div>
                        <span className={`status-pill ${["active", "verified"].includes(domain.status) ? "success" : "warning"}`}>
                          {formatStatusLabel(domain.status)}
                        </span>
                      </div>
                      <div className="admin-review-facts">
                        <div>
                          <span>Primary</span>
                          <strong>{domain.isPrimary ? "Yes" : "No"}</strong>
                        </div>
                        <div>
                          <span>Verified at</span>
                          <strong>{formatDateTime(domain.verifiedAt)}</strong>
                        </div>
                      </div>
                    </div>
                  ))}
                  {(selectedAudit.domains || []).length === 0 ? (
                    <StatusBanner tone="warning">No domain records are attached to this onboarding record yet.</StatusBanner>
                  ) : null}
                </div>
              </div>

              <div className="admin-detail-section">
                <h3>Subdomain History</h3>
                <div className="stack">
                  {(selectedAudit.subdomainHistory || []).map((entry) => (
                    <div className="summary-panel admin-domain-card" key={entry.id}>
                      <strong>{entry.oldSubdomain} → {entry.newSubdomain}</strong>
                      <span className="muted admin-review-domain">
                        {entry.changedByEmail || "System"} · {formatDateTime(entry.changedAt)}
                      </span>
                    </div>
                  ))}
                  {(selectedAudit.subdomainHistory || []).length === 0 ? (
                    <StatusBanner>No recorded subdomain changes for this tenant.</StatusBanner>
                  ) : null}
                </div>
              </div>

              <div className="admin-detail-section">
                <h3>Recent Provider Events</h3>
                <div className="stack">
                  {(selectedAudit.recentProviderEvents || []).map((event) => (
                    <div className="summary-panel admin-domain-card" key={event.id}>
                      <div className="admin-review-header">
                        <div>
                          <strong>{event.eventType}</strong>
                          <span className="muted admin-review-domain">
                            {formatStatusLabel(event.provider)} · {event.eventId}
                          </span>
                        </div>
                        <span className={`status-pill ${event.status === "processed" ? "success" : "warning"}`}>
                          {formatStatusLabel(event.status)}
                        </span>
                      </div>
                      <div className="admin-review-facts">
                        <div>
                          <span>Created</span>
                          <strong>{formatDateTime(event.createdAt)}</strong>
                        </div>
                        <div>
                          <span>Processed</span>
                          <strong>{formatDateTime(event.processedAt)}</strong>
                        </div>
                      </div>
                      <pre className="admin-code-block">{formatJsonPreview(event.payload)}</pre>
                    </div>
                  ))}
                  {(selectedAudit.recentProviderEvents || []).length === 0 ? (
                    <StatusBanner>No provider events are linked to this onboarding record yet.</StatusBanner>
                  ) : null}
                </div>
              </div>
            </div>
          ) : !detail.loading ? (
            <StatusBanner>Select an onboarding record to inspect domain state, subdomain history, and billing event traces.</StatusBanner>
          ) : null}
        </aside>
      </div>
    </SectionCard>
  );
}
