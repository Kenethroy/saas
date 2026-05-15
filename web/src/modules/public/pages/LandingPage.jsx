import { Link } from "react-router-dom";
import { SectionCard } from "../../../shared/ui/Primitives";

export function LandingPage() {
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
            <Link className="ghost-button" to="/admin/subscriptions">
              Platform Admin
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
