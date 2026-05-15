import { useEffect, useState } from "react";
import { platformAdminApi } from "../../../lib/api";
import { Field, FieldRow, SectionCard, StatusBanner } from "../../../shared/ui/Primitives";
import { formatCurrency, formatDateTime, formatStatusLabel } from "../../../shared/utils/formatters";

export function SubscriptionReviewPage({ adminSession }) {
  const [form, setForm] = useState({
    q: "",
    status: "",
    tenantStatus: "",
    provider: "",
    planCode: "",
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
    tenantId: null
  });
  const [actionState, setActionState] = useState({
    pending: false,
    error: "",
    success: "",
    reason: ""
  });

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError("");

    platformAdminApi.listSubscriptions(adminSession.token, query)
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

  const loadBillingDetail = async (tenantId) => {
    setActionState((current) => ({
      ...current,
      error: "",
      success: ""
    }));
    setDetail({
      loading: true,
      error: "",
      data: null,
      tenantId
    });

    try {
      const response = await platformAdminApi.getTenantBilling(adminSession.token, tenantId);
      setDetail({
        loading: false,
        error: "",
        data: response,
        tenantId
      });
    } catch (requestError) {
      setDetail({
        loading: false,
        error: requestError.message,
        data: null,
        tenantId
      });
    }
  };

  const refreshList = async (nextQuery = query) => {
    const response = await platformAdminApi.listSubscriptions(adminSession.token, nextQuery);
    setResult(response ?? {
      items: [],
      page: nextQuery.page,
      perPage: nextQuery.perPage,
      total: 0,
      totalPages: 1
    });
  };

  const applySubscriptionAction = async (action) => {
    if (!detail.tenantId) {
      return;
    }

    setActionState((current) => ({
      ...current,
      pending: true,
      error: "",
      success: ""
    }));

    try {
      const response = await platformAdminApi.applySubscriptionAction(adminSession.token, detail.tenantId, {
        action,
        reason: actionState.reason
      });

      setDetail({
        loading: false,
        error: "",
        data: response,
        tenantId: detail.tenantId
      });
      await refreshList();
      setActionState((current) => ({
        ...current,
        pending: false,
        error: "",
        success: action === "reactivate" ? "Tenant access reactivated." : "Tenant access suspended."
      }));
    } catch (requestError) {
      setActionState((current) => ({
        ...current,
        pending: false,
        error: requestError.message,
        success: ""
      }));
    }
  };

  const submitFilters = (event) => {
    event.preventDefault();
    setQuery({
      q: form.q.trim(),
      status: form.status,
      tenantStatus: form.tenantStatus,
      provider: form.provider,
      planCode: form.planCode.trim(),
      perPage: Number(form.perPage) || 10,
      page: 1
    });
  };

  const clearFilters = () => {
    setForm({
      q: "",
      status: "",
      tenantStatus: "",
      provider: "",
      planCode: "",
      perPage: "10"
    });
    setQuery({
      page: 1,
      perPage: 10
    });
  };

  const selectedTenant = detail.data?.tenant ?? null;
  const selectedSubscription = detail.data?.subscription ?? null;
  const selectedPlanPrices = Array.isArray(detail.data?.availablePlanPrices) ? detail.data.availablePlanPrices : [];
  const recoveryCount = result.items.filter((item) => item.recoveryEligible).length;
  const canReactivate = selectedTenant && selectedTenant.subscriptionStatus !== "active";
  const canSuspend = selectedTenant && ["active", "trialing", "past_due", "incomplete", "expired"].includes(selectedTenant.subscriptionStatus);

  return (
    <SectionCard
      eyebrow="Platform Admin"
      title="Review tenant subscriptions"
      description="This screen reads `GET /platform/admin/subscriptions` for the catalog view and `GET /platform/admin/tenants/:id/billing` for a full tenant billing inspection."
      className="feature-card"
    >
      <div className="status-grid admin-summary-grid">
        <div className="summary-panel">
          <span>Visible tenants</span>
          <strong>{result.total}</strong>
        </div>
        <div className="summary-panel">
          <span>Recovery eligible on page</span>
          <strong>{recoveryCount}</strong>
        </div>
        <div className="summary-panel">
          <span>Selected tenant</span>
          <strong>{selectedTenant?.name || "None"}</strong>
        </div>
      </div>

      <form className="stack" onSubmit={submitFilters}>
        <FieldRow>
          <Field label="Search" hint="Tenant name, slug, domain, or provider subscription ID">
            <input
              value={form.q}
              onChange={(event) => setForm((current) => ({ ...current, q: event.target.value }))}
            />
          </Field>
          <Field label="Plan code">
            <input
              value={form.planCode}
              onChange={(event) => setForm((current) => ({ ...current, planCode: event.target.value }))}
            />
          </Field>
        </FieldRow>

        <FieldRow>
          <Field label="Subscription status">
            <select
              value={form.status}
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
            >
              <option value="">All statuses</option>
              <option value="incomplete">Incomplete</option>
              <option value="trialing">Trialing</option>
              <option value="active">Active</option>
              <option value="past_due">Past Due</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
              <option value="suspended">Suspended</option>
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
          <Field label="Provider">
            <select
              value={form.provider}
              onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value }))}
            >
              <option value="">All providers</option>
              <option value="manual">Manual</option>
              <option value="stripe">Stripe</option>
              <option value="paymongo">PayMongo</option>
              <option value="xendit">Xendit</option>
              <option value="paddle">Paddle</option>
            </select>
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

        <div className="admin-filter-actions">
          <button className="primary-button" type="submit">
            Apply Filters
          </button>
          <button className="ghost-button" type="button" onClick={clearFilters}>
            Clear
          </button>
        </div>
      </form>

      {loading ? <StatusBanner>Loading subscription review data...</StatusBanner> : null}
      {error ? <StatusBanner tone="danger">{error}</StatusBanner> : null}

      <div className="admin-review-grid">
        <div className="stack">
          {(result.items || []).map((item) => (
            <article
              className={`summary-panel admin-review-card ${detail.tenantId === item.tenant.id ? "selected" : ""}`}
              key={item.tenant.id}
            >
              <div className="admin-review-header">
                <div>
                  <strong>{item.tenant.name}</strong>
                  <span className="muted admin-review-domain">
                    {item.tenant.domain || item.tenant.subdomain || item.tenant.slug}
                  </span>
                </div>
                <span className={`status-pill ${item.recoveryEligible ? "warning" : "success"}`}>
                  {item.subscription?.effectiveStatus ? formatStatusLabel(item.subscription.effectiveStatus) : "No Subscription"}
                </span>
              </div>

              <div className="admin-review-facts">
                <div>
                  <span>Plan</span>
                  <strong>{item.plan?.name || "Unassigned"}</strong>
                </div>
                <div>
                  <span>Provider</span>
                  <strong>{formatStatusLabel(item.subscription?.provider || "manual")}</strong>
                </div>
                <div>
                  <span>Cycle</span>
                  <strong>{formatStatusLabel(item.subscription?.billingCycle || "custom")}</strong>
                </div>
                <div>
                  <span>Current period end</span>
                  <strong>{formatDateTime(item.subscription?.currentPeriodEnd)}</strong>
                </div>
                <div>
                  <span>Latest invoice</span>
                  <strong>{item.latestInvoice ? formatCurrency(item.latestInvoice.amountDue, item.latestInvoice.currency) : "None"}</strong>
                </div>
                <div>
                  <span>Latest payment</span>
                  <strong>{item.latestPayment ? formatCurrency(item.latestPayment.amount, item.latestPayment.currency) : "None"}</strong>
                </div>
              </div>

              <div className="admin-filter-actions">
                <button className="ghost-button" type="button" onClick={() => loadBillingDetail(item.tenant.id)}>
                  {detail.loading && detail.tenantId === item.tenant.id ? "Loading..." : "Review Details"}
                </button>
              </div>
            </article>
          ))}

          {!loading && !error && result.items.length === 0 ? (
            <StatusBanner tone="warning">
              No tenants matched the current review filters.
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
              <strong>Tenant Billing Detail</strong>
              <span className="muted admin-review-domain">
                {selectedTenant?.name || "Select a tenant from the review list"}
              </span>
            </div>
            {detail.data?.recoveryEligible ? (
              <span className="status-pill warning">Recovery Eligible</span>
            ) : selectedTenant ? (
              <span className="status-pill success">Protected</span>
            ) : null}
          </div>

          {detail.loading ? <StatusBanner>Loading tenant billing detail...</StatusBanner> : null}
          {detail.error ? <StatusBanner tone="danger">{detail.error}</StatusBanner> : null}
          {actionState.error ? <StatusBanner tone="danger">{actionState.error}</StatusBanner> : null}
          {actionState.success ? <StatusBanner tone="success">{actionState.success}</StatusBanner> : null}

          {detail.data ? (
            <div className="stack">
              <div className="admin-detail-section">
                <h3>Manual Access Control</h3>
                <Field label="Admin reason" hint="Optional note stored on the subscription metadata for this override.">
                  <textarea
                    rows={3}
                    value={actionState.reason}
                    onChange={(event) => setActionState((current) => ({
                      ...current,
                      reason: event.target.value,
                      error: "",
                      success: ""
                    }))}
                  />
                </Field>
                <div className="admin-filter-actions">
                  <button
                    className="primary-button"
                    disabled={!canSuspend || actionState.pending}
                    type="button"
                    onClick={() => applySubscriptionAction("suspend")}
                  >
                    {actionState.pending ? "Applying..." : "Suspend Access"}
                  </button>
                  <button
                    className="ghost-button"
                    disabled={!canReactivate || actionState.pending}
                    type="button"
                    onClick={() => applySubscriptionAction("reactivate")}
                  >
                    {actionState.pending ? "Applying..." : "Reactivate Access"}
                  </button>
                </div>
              </div>

              <div className="admin-detail-section">
                <h3>Tenant</h3>
                <div className="admin-review-facts">
                  <div>
                    <span>Tenant status</span>
                    <strong>{formatStatusLabel(selectedTenant.status)}</strong>
                  </div>
                  <div>
                    <span>Subscription status</span>
                    <strong>{formatStatusLabel(selectedTenant.subscriptionStatus)}</strong>
                  </div>
                  <div>
                    <span>Domain</span>
                    <strong>{selectedTenant.domain || "Not set"}</strong>
                  </div>
                  <div>
                    <span>Timezone</span>
                    <strong>{selectedTenant.timezone || "Not set"}</strong>
                  </div>
                </div>
              </div>

              <div className="admin-detail-section">
                <h3>Subscription</h3>
                {selectedSubscription ? (
                  <div className="admin-review-facts">
                    <div>
                      <span>Plan</span>
                      <strong>{selectedSubscription.plan?.name || "Unknown"}</strong>
                    </div>
                    <div>
                      <span>Plan price</span>
                      <strong>{selectedSubscription.planPrice?.name || "Unknown"}</strong>
                    </div>
                    <div>
                      <span>Provider subscription</span>
                      <strong>{selectedSubscription.providerSubscriptionId || "Not linked"}</strong>
                    </div>
                    <div>
                      <span>Period end</span>
                      <strong>{formatDateTime(selectedSubscription.currentPeriodEnd)}</strong>
                    </div>
                    <div>
                      <span>Cancel at period end</span>
                      <strong>{selectedSubscription.cancelAtPeriodEnd ? "Yes" : "No"}</strong>
                    </div>
                    <div>
                      <span>Started</span>
                      <strong>{formatDateTime(selectedSubscription.startedAt)}</strong>
                    </div>
                  </div>
                ) : (
                  <StatusBanner tone="warning">No current subscription record is attached to this tenant.</StatusBanner>
                )}
              </div>

              <div className="admin-detail-section">
                <h3>Billing Artifacts</h3>
                <div className="admin-review-facts">
                  <div>
                    <span>Latest invoice</span>
                    <strong>{detail.data.latestInvoice?.invoiceNumber || "None"}</strong>
                  </div>
                  <div>
                    <span>Invoice status</span>
                    <strong>{formatStatusLabel(detail.data.latestInvoice?.status || "none")}</strong>
                  </div>
                  <div>
                    <span>Latest payment</span>
                    <strong>{detail.data.latestPayment?.providerPaymentId || "None"}</strong>
                  </div>
                  <div>
                    <span>Payment status</span>
                    <strong>{formatStatusLabel(detail.data.latestPayment?.status || "none")}</strong>
                  </div>
                </div>
              </div>

              <div className="admin-detail-section">
                <h3>Available renewal prices</h3>
                <div className="price-stack admin-price-stack">
                  {selectedPlanPrices.map((price) => (
                    <div className="summary-panel admin-price-card" key={price.id}>
                      <strong>{price.name}</strong>
                      <span className="muted admin-price-meta">
                        {price.code} · {price.billingIntervalCount} {price.billingIntervalUnit}
                        {price.billingIntervalCount > 1 ? "s" : ""}
                      </span>
                      <strong>{formatCurrency(price.price, price.currencyCode)}</strong>
                    </div>
                  ))}
                  {selectedPlanPrices.length === 0 ? (
                    <StatusBanner tone="warning">No active plan prices are available for this tenant's current plan.</StatusBanner>
                  ) : null}
                </div>
              </div>
            </div>
          ) : !detail.loading ? (
            <StatusBanner>Select a tenant to review its billing state, latest invoice, and payment records.</StatusBanner>
          ) : null}
        </aside>
      </div>
    </SectionCard>
  );
}
