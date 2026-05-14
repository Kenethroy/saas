import { PageIntro } from "@/shared/components/common/PageIntro";
import { useWorkspaceContext } from "@/shared/hooks/useWorkspaceContext";

function InfoRow({ label, value }) {
  return (
    <div className="grid grid-cols-[180px_minmax(0,1fr)] gap-3 px-4 py-3 text-[11px]">
      <div className="font-bold text-[#607d8b]">{label}</div>
      <div className="text-[#1a3557]">{value || "N/A"}</div>
    </div>
  );
}

export function TenantSettingsPage() {
  const { tenant, currentBranch, branches } = useWorkspaceContext();

  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow="Workspace"
        title="Tenant Settings"
        description="Read-only tenant profile, primary domain, and branch summary carried by the ERP session."
      />

      <section className="erp-page-main-card overflow-hidden">
        <div className="border-b border-[#e8ecef] bg-[#f8fbfd] px-4 py-3">
          <div className="text-[12px] font-bold text-[#1a3557]">Tenant Profile</div>
          <div className="mt-1 text-[10px] text-[#78909c]">Tenant mutations are not wired yet. This page confirms the tenant context resolved for the authenticated ERP user.</div>
        </div>
        <div className="divide-y divide-[#eef2f5]">
          <InfoRow label="Tenant name" value={tenant?.name} />
          <InfoRow label="Legal name" value={tenant?.legalName} />
          <InfoRow label="Business type" value={tenant?.businessType} />
          <InfoRow label="Primary domain" value={tenant?.domain} />
          <InfoRow label="Subdomain" value={tenant?.subdomain} />
          <InfoRow label="Currency" value={tenant?.currencyCode} />
          <InfoRow label="Timezone" value={tenant?.timezone} />
          <InfoRow label="Contact email" value={tenant?.email} />
          <InfoRow label="Phone" value={tenant?.phone} />
          <InfoRow label="Address" value={tenant?.address} />
          <InfoRow label="Resolved current branch" value={currentBranch ? `${currentBranch.name} (${currentBranch.code})` : null} />
          <InfoRow label="Known branches" value={branches.length ? String(branches.length) : "0"} />
        </div>
      </section>
    </div>
  );
}
