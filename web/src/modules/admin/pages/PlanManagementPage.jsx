import { useEffect, useState } from "react";
import { platformAdminApi } from "../../../lib/api";
import { Field, FieldRow, SectionCard, StatusBanner } from "../../../shared/ui/Primitives";
import { formatCurrency } from "../../../shared/utils/formatters";
import { buildPlanPayload, buildPlanPricePayload, toPlanDraft, toPriceDraft } from "../../../shared/utils/planDrafts";

export function PlanManagementPage({ adminSession }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusByKey, setStatusByKey] = useState({});
  const [pendingPlans, setPendingPlans] = useState({});
  const [pendingPrices, setPendingPrices] = useState({});

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError("");

    platformAdminApi.listPlans(adminSession.token)
      .then((result) => {
        if (!active) {
          return;
        }

        setPlans(Array.isArray(result) ? result.map(toPlanDraft) : []);
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
  }, [adminSession.token]);

  const updatePlanField = (planId, field, value) => {
    setPlans((current) => current.map((plan) => (
      plan.id === planId
        ? { ...plan, [field]: value }
        : plan
    )));
  };

  const updatePriceField = (planId, priceId, field, value) => {
    setPlans((current) => current.map((plan) => (
      plan.id === planId
        ? {
            ...plan,
            prices: plan.prices.map((price) => (
              price.id === priceId
                ? { ...price, [field]: value }
                : price
            ))
          }
        : plan
    )));
  };

  const setStatus = (key, tone, message) => {
    setStatusByKey((current) => ({
      ...current,
      [key]: { tone, message }
    }));
  };

  const savePlan = async (plan) => {
    const statusKey = `plan-${plan.id}`;
    setPendingPlans((current) => ({ ...current, [plan.id]: true }));
    setStatus(statusKey, "neutral", "Saving plan changes...");

    try {
      const result = await platformAdminApi.updatePlan(adminSession.token, plan.id, buildPlanPayload(plan));
      setPlans((current) => current.map((item) => (item.id === plan.id ? toPlanDraft(result) : item)));
      setStatus(statusKey, "success", "Plan updated.");
    } catch (requestError) {
      setStatus(statusKey, "danger", requestError.message);
    } finally {
      setPendingPlans((current) => ({ ...current, [plan.id]: false }));
    }
  };

  const savePrice = async (planId, price) => {
    const statusKey = `price-${price.id}`;
    setPendingPrices((current) => ({ ...current, [price.id]: true }));
    setStatus(statusKey, "neutral", "Saving price row...");

    try {
      const result = await platformAdminApi.updatePlanPrice(adminSession.token, price.id, buildPlanPricePayload(price));
      setPlans((current) => current.map((plan) => (
        plan.id === planId
          ? {
              ...plan,
              prices: plan.prices.map((item) => (item.id === price.id ? toPriceDraft(result) : item))
            }
          : plan
      )));
      setStatus(statusKey, "success", "Price row updated.");
    } catch (requestError) {
      setStatus(statusKey, "danger", requestError.message);
    } finally {
      setPendingPrices((current) => ({ ...current, [price.id]: false }));
    }
  };

  return (
    <SectionCard
      eyebrow="Platform Admin"
      title="Manage subscription plans"
      description="This screen reads `GET /platform/admin/plans` and applies field-level edits through `PATCH /platform/admin/plans/:id` and `PATCH /platform/admin/plan-prices/:id`."
      className="feature-card"
    >
      <div className="status-grid admin-summary-grid">
        <div className="summary-panel">
          <span>Signed in as</span>
          <strong>{adminSession?.account?.email || "Unknown"}</strong>
        </div>
        <div className="summary-panel">
          <span>Roles</span>
          <strong>{(adminSession?.account?.roles || []).join(", ") || "No roles"}</strong>
        </div>
        <div className="summary-panel">
          <span>Catalog rows</span>
          <strong>{plans.reduce((total, plan) => total + plan.prices.length, 0)}</strong>
        </div>
      </div>

      {loading ? <StatusBanner>Loading plan catalog...</StatusBanner> : null}
      {error ? <StatusBanner tone="danger">{error}</StatusBanner> : null}

      <div className="plan-grid admin-plan-grid">
        {plans.map((plan) => (
          <article className="plan-card admin-plan-card" key={plan.id}>
            <div className="admin-plan-header">
              <div>
                <p className="eyebrow">{plan.code}</p>
                <h3>{plan.name || plan.code}</h3>
                <p className="muted">{plan.description || "No plan description configured."}</p>
              </div>
              <button
                className="primary-button"
                disabled={Boolean(pendingPlans[plan.id])}
                type="button"
                onClick={() => savePlan(plan)}
              >
                {pendingPlans[plan.id] ? "Saving..." : "Save Plan"}
              </button>
            </div>

            {statusByKey[`plan-${plan.id}`]?.message ? (
              <StatusBanner tone={statusByKey[`plan-${plan.id}`].tone}>
                {statusByKey[`plan-${plan.id}`].message}
              </StatusBanner>
            ) : null}

            <div className="stack">
              <Field label="Plan name">
                <input
                  value={plan.name}
                  onChange={(event) => updatePlanField(plan.id, "name", event.target.value)}
                />
              </Field>

              <Field label="Description">
                <textarea
                  rows={3}
                  value={plan.description}
                  onChange={(event) => updatePlanField(plan.id, "description", event.target.value)}
                />
              </Field>

              <FieldRow>
                <Field label="Monthly anchor price" hint="Legacy display field on the plan record.">
                  <input
                    min="0"
                    step="0.01"
                    type="number"
                    value={plan.priceMonthlyInput}
                    onChange={(event) => updatePlanField(plan.id, "priceMonthlyInput", event.target.value)}
                  />
                </Field>
                <Field label="Yearly anchor price" hint="Legacy display field on the plan record.">
                  <input
                    min="0"
                    step="0.01"
                    type="number"
                    value={plan.priceYearlyInput}
                    onChange={(event) => updatePlanField(plan.id, "priceYearlyInput", event.target.value)}
                  />
                </Field>
              </FieldRow>

              <FieldRow>
                <Field label="Max branches">
                  <input
                    min="0"
                    step="1"
                    type="number"
                    value={plan.maxBranchesInput}
                    onChange={(event) => updatePlanField(plan.id, "maxBranchesInput", event.target.value)}
                  />
                </Field>
                <Field label="Max users">
                  <input
                    min="0"
                    step="1"
                    type="number"
                    value={plan.maxUsersInput}
                    onChange={(event) => updatePlanField(plan.id, "maxUsersInput", event.target.value)}
                  />
                </Field>
              </FieldRow>

              <FieldRow>
                <Field label="Max products">
                  <input
                    min="0"
                    step="1"
                    type="number"
                    value={plan.maxProductsInput}
                    onChange={(event) => updatePlanField(plan.id, "maxProductsInput", event.target.value)}
                  />
                </Field>
                <Field label="Max storage (GB)">
                  <input
                    min="0"
                    step="1"
                    type="number"
                    value={plan.maxStorageGbInput}
                    onChange={(event) => updatePlanField(plan.id, "maxStorageGbInput", event.target.value)}
                  />
                </Field>
              </FieldRow>

              <div className="toggle-grid">
                <label className="toggle-card">
                  <input
                    checked={Boolean(plan.allowReports)}
                    type="checkbox"
                    onChange={(event) => updatePlanField(plan.id, "allowReports", event.target.checked)}
                  />
                  <span>Reports enabled</span>
                </label>
                <label className="toggle-card">
                  <input
                    checked={Boolean(plan.allowBackup)}
                    type="checkbox"
                    onChange={(event) => updatePlanField(plan.id, "allowBackup", event.target.checked)}
                  />
                  <span>Backup enabled</span>
                </label>
                <label className="toggle-card">
                  <input
                    checked={Boolean(plan.allowApiAccess)}
                    type="checkbox"
                    onChange={(event) => updatePlanField(plan.id, "allowApiAccess", event.target.checked)}
                  />
                  <span>API access enabled</span>
                </label>
                <label className="toggle-card">
                  <input
                    checked={Boolean(plan.allowMultiBranch)}
                    type="checkbox"
                    onChange={(event) => updatePlanField(plan.id, "allowMultiBranch", event.target.checked)}
                  />
                  <span>Multi-branch enabled</span>
                </label>
                <label className="toggle-card">
                  <input
                    checked={Boolean(plan.isActive)}
                    type="checkbox"
                    onChange={(event) => updatePlanField(plan.id, "isActive", event.target.checked)}
                  />
                  <span>Plan active</span>
                </label>
              </div>

              <div className="price-stack admin-price-stack">
                {plan.prices.map((price) => (
                  <div className="summary-panel admin-price-card" key={price.id}>
                    <div className="admin-price-header">
                      <div>
                        <strong>{price.code}</strong>
                        <span className="muted admin-price-meta">
                          {price.billingIntervalCount} {price.billingIntervalUnit}
                          {price.billingIntervalCount > 1 ? "s" : ""}
                          {" · "}
                          {price.currencyCode}
                        </span>
                      </div>
                      <button
                        className="ghost-button"
                        disabled={Boolean(pendingPrices[price.id])}
                        type="button"
                        onClick={() => savePrice(plan.id, price)}
                      >
                        {pendingPrices[price.id] ? "Saving..." : "Save Price"}
                      </button>
                    </div>

                    {statusByKey[`price-${price.id}`]?.message ? (
                      <StatusBanner tone={statusByKey[`price-${price.id}`].tone}>
                        {statusByKey[`price-${price.id}`].message}
                      </StatusBanner>
                    ) : null}

                    <FieldRow>
                      <Field label="Display name">
                        <input
                          value={price.name}
                          onChange={(event) => updatePriceField(plan.id, price.id, "name", event.target.value)}
                        />
                      </Field>
                      <Field label="Checkout mode">
                        <select
                          value={price.checkoutMode}
                          onChange={(event) => updatePriceField(plan.id, price.id, "checkoutMode", event.target.value)}
                        >
                          <option value="subscription">Subscription</option>
                          <option value="payment">Payment</option>
                        </select>
                      </Field>
                    </FieldRow>

                    <Field label="Description">
                      <textarea
                        rows={2}
                        value={price.description}
                        onChange={(event) => updatePriceField(plan.id, price.id, "description", event.target.value)}
                      />
                    </Field>

                    <FieldRow>
                      <Field label="Price amount">
                        <input
                          min="0"
                          step="0.01"
                          type="number"
                          value={price.priceInput}
                          onChange={(event) => updatePriceField(plan.id, price.id, "priceInput", event.target.value)}
                        />
                      </Field>
                      <Field label="Provider price ID">
                        <input
                          value={price.providerPriceId}
                          onChange={(event) => updatePriceField(plan.id, price.id, "providerPriceId", event.target.value)}
                        />
                      </Field>
                    </FieldRow>

                    <div className="admin-price-footer">
                      <span className="admin-price-total">{formatCurrency(price.price, price.currencyCode)}</span>
                      <label className="toggle-card compact">
                        <input
                          checked={Boolean(price.isActive)}
                          type="checkbox"
                          onChange={(event) => updatePriceField(plan.id, price.id, "isActive", event.target.checked)}
                        />
                        <span>Price row active</span>
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </SectionCard>
  );
}
