import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { platformApi } from "../../../lib/api";
import { platformStorage } from "../../../lib/storage";
import { SectionCard, StatusBanner } from "../../../shared/ui/Primitives";
import { formatCurrency } from "../../../shared/utils/formatters";

export function PlanSelectionPage() {
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
                  <strong>{formatCurrency(price.price, price.currencyCode)}</strong>
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </SectionCard>
  );
}
