import { useMemo } from "react";
import { SectionCard, StatusBanner } from "../../../shared/ui/Primitives";

const platformBaseDomain = import.meta.env.VITE_PLATFORM_BASE_DOMAIN || "";

export function LoginRedirectPage({ session }) {
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
