import { Link } from "react-router-dom";
import { PageIntro } from "@/shared/components/common/PageIntro";
import { useWorkspaceContext } from "@/shared/hooks/useWorkspaceContext";
import { useAuthStore } from "@/shared/store/auth.store";

function formatDateTime(value) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function statusTone(status) {
  const normalized = String(status ?? "").toLowerCase();
  if (normalized === "active" || normalized === "trialing") {
    return "bg-[#e8f5e9] text-[#2e7d32]";
  }

  if (normalized === "past_due" || normalized === "expired" || normalized === "cancelled" || normalized === "suspended") {
    return "bg-[#fff5f5] text-[#c62828]";
  }

  return "bg-[#fff8e1] text-[#f57f17]";
}

function SummaryCard({ label, value, helper = null }) {
  return (
    <div className="rounded-sm border border-[#d7e3ec] bg-white px-4 py-3 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
      <div className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#607d8b]">{label}</div>
      <div className="mt-2 text-[13px] font-bold text-[#1a3557]">{value}</div>
      {helper ? <div className="mt-1 text-[10px] text-[#78909c]">{helper}</div> : null}
    </div>
  );
}

export function TenantSubscriptionPage() {
  const user = useAuthStore((state) => state.user);
  const { tenant, subscription, subscriptionAccess } = useWorkspaceContext();
  const platformWebBaseUrl = import.meta.env.VITE_PLATFORM_WEB_BASE_URL;
  const billingPortalUrl = platformWebBaseUrl ? `${String(platformWebBaseUrl).replace(/\/+$/, "")}/` : null;

  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow="Workspace"
        title="Subscription and Billing"
        description="Current plan state, renewal timing, and recovery instructions for this tenant workspace."
      />

      {!subscriptionAccess.isActive ? (
        <section className="rounded-sm border border-[#ef9a9a] bg-[#fff7f7] px-4 py-4 text-[12px] text-[#8a1c1c]">
          <div className="flex items-start gap-3">
            <i className="fas fa-triangle-exclamation mt-0.5 text-[15px]" aria-hidden="true" />
            <div>
              <div className="font-bold">Workspace access is restricted until billing is restored.</div>
              <div className="mt-1 text-[11px] leading-5">
                Protected ERP routes are blocked for inactive subscriptions. Use the public SaaS onboarding and billing flow for recovery.
              </div>
              {billingPortalUrl ? (
                <a
                  href={billingPortalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-2 rounded-sm bg-[#c62828] px-3 py-2 text-[11px] font-bold text-white"
                >
                  <i className="fas fa-arrow-up-right-from-square" aria-hidden="true" />
                  Open Public Billing Flow
                </a>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <section className="erp-page-main-card p-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Tenant" value={tenant?.name ?? "Unknown tenant"} helper={tenant?.domain || tenant?.subdomain || "No primary domain recorded"} />
          <SummaryCard label="Plan" value={subscription?.planName ?? "Not assigned"} helper={subscription?.planPriceName || "No plan price selected"} />
          <SummaryCard label="Provider" value={subscription?.provider ? String(subscription.provider).toUpperCase() : "N/A"} helper={subscription?.providerSubscriptionId || "No provider subscription id"} />
          <div className="rounded-sm border border-[#d7e3ec] bg-white px-4 py-3 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
            <div className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#607d8b]">Status</div>
            <div className="mt-2">
              <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.4px] ${statusTone(subscriptionAccess.status)}`}>
                {subscriptionAccess.status || "unknown"}
              </span>
            </div>
            <div className="mt-2 text-[10px] text-[#78909c]">Tenant status: {tenant?.status || "N/A"}</div>
          </div>
        </div>
      </section>

      <section className="erp-page-main-card p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
          <div className="rounded-sm border border-[#d7e3ec] bg-white">
            <div className="border-b border-[#e8ecef] px-4 py-3">
              <div className="text-[12px] font-bold text-[#1a3557]">Subscription Details</div>
              <div className="mt-1 text-[10px] text-[#78909c]">Latest subscription context from the ERP session.</div>
            </div>
            <dl className="grid gap-0 divide-y divide-[#eef2f5]">
              <div className="grid grid-cols-[180px_minmax(0,1fr)] gap-3 px-4 py-3 text-[11px]">
                <dt className="font-bold text-[#607d8b]">Billing cycle</dt>
                <dd className="text-[#1a3557]">{subscription?.billingCycle || "N/A"}</dd>
              </div>
              <div className="grid grid-cols-[180px_minmax(0,1fr)] gap-3 px-4 py-3 text-[11px]">
                <dt className="font-bold text-[#607d8b]">Current period start</dt>
                <dd className="text-[#1a3557]">{formatDateTime(subscription?.currentPeriodStart)}</dd>
              </div>
              <div className="grid grid-cols-[180px_minmax(0,1fr)] gap-3 px-4 py-3 text-[11px]">
                <dt className="font-bold text-[#607d8b]">Current period end</dt>
                <dd className="text-[#1a3557]">{formatDateTime(subscription?.currentPeriodEnd)}</dd>
              </div>
              <div className="grid grid-cols-[180px_minmax(0,1fr)] gap-3 px-4 py-3 text-[11px]">
                <dt className="font-bold text-[#607d8b]">Renewal amount</dt>
                <dd className="text-[#1a3557]">
                  {subscription?.price === null || subscription?.price === undefined
                    ? "Manual pricing"
                    : `${subscription.currencyCode || tenant?.currencyCode || "PHP"} ${Number(subscription.price).toLocaleString()}`}
                </dd>
              </div>
              <div className="grid grid-cols-[180px_minmax(0,1fr)] gap-3 px-4 py-3 text-[11px]">
                <dt className="font-bold text-[#607d8b]">Authenticated ERP account</dt>
                <dd className="text-[#1a3557]">{user?.email || user?.username || "N/A"}</dd>
              </div>
            </dl>
          </div>

          <div className="space-y-4">
            <div className="rounded-sm border border-[#d7e3ec] bg-[#f8fbfd] px-4 py-4">
              <div className="text-[12px] font-bold text-[#1a3557]">Recovery path</div>
              <p className="mt-2 text-[11px] leading-5 text-[#546e7a]">
                Billing recovery currently happens in the public SaaS app. Log in with the linked platform account, open the billing flow, and renew the tenant subscription there.
              </p>
              {billingPortalUrl ? (
                <a
                  href={billingPortalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-2 rounded-sm border border-[#1e4a7a] bg-white px-3 py-2 text-[11px] font-bold text-[#1e4a7a]"
                >
                  <i className="fas fa-arrow-up-right-from-square" aria-hidden="true" />
                  Open Platform App
                </a>
              ) : (
                <p className="mt-3 text-[10px] text-[#90a4ae]">Set `VITE_PLATFORM_WEB_BASE_URL` to show a direct recovery link here.</p>
              )}
            </div>

            <div className="rounded-sm border border-[#d7e3ec] bg-white px-4 py-4">
              <div className="text-[12px] font-bold text-[#1a3557]">Quick navigation</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to="/tenant/settings" className="rounded-sm border border-[#d7e3ec] px-3 py-2 text-[11px] font-bold text-[#1a3557]">
                  Tenant Settings
                </Link>
                <Link to="/tenant/branches" className="rounded-sm border border-[#d7e3ec] px-3 py-2 text-[11px] font-bold text-[#1a3557]">
                  Branches
                </Link>
                <Link to="/admin/profile" className="rounded-sm border border-[#d7e3ec] px-3 py-2 text-[11px] font-bold text-[#1a3557]">
                  My Profile
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
