import { PageIntro } from "@/shared/components/common/PageIntro";
import { useWorkspaceContext } from "@/shared/hooks/useWorkspaceContext";

export function BranchManagementPage() {
  const { branches, currentBranch, setCurrentBranch, subscription } = useWorkspaceContext();

  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow="Workspace"
        title="Branch Management"
        description="Current branch state and a lightweight switcher for the tenant branches already returned by the ERP session."
      />

      <section className="erp-page-main-card p-4">
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="rounded-sm border border-[#d7e3ec] bg-[#f8fbfd] px-4 py-4">
            <div className="text-[12px] font-bold text-[#1a3557]">Current Branch</div>
            <div className="mt-2 text-[20px] font-bold text-[#0f2742]">{currentBranch?.name || "No branch"}</div>
            <div className="mt-1 text-[11px] text-[#607d8b]">{currentBranch ? `${currentBranch.code} • ${currentBranch.type}` : "No current branch available."}</div>

            {branches.length > 0 ? (
              <div className="mt-4">
                <label className="erp-label">Switch branch</label>
                <select
                  value={currentBranch?.id ?? ""}
                  onChange={(event) => setCurrentBranch(event.target.value)}
                  className="erp-input"
                >
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name} ({branch.code})
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-[10px] text-[#78909c]">
                  This updates the client-side branch context only. API branch scoping rollout is still part of the later ERP refactor phase.
                </p>
              </div>
            ) : null}

            <div className="mt-4 rounded-sm border border-[#d7e3ec] bg-white px-3 py-3 text-[10px] text-[#607d8b]">
              Plan branch limit:
              {" "}
              <strong className="text-[#1a3557]">{subscription?.maxBranches ?? "Custom / unlimited"}</strong>
            </div>
          </div>

          <div className="overflow-hidden rounded-sm border border-[#d7e3ec] bg-white">
            <div className="border-b border-[#e8ecef] bg-[#f8fbfd] px-4 py-3">
              <div className="text-[12px] font-bold text-[#1a3557]">Branches</div>
              <div className="mt-1 text-[10px] text-[#78909c]">Read-only branch inventory from the current ERP session.</div>
            </div>
            <div className="divide-y divide-[#eef2f5]">
              {branches.length === 0 ? (
                <div className="px-4 py-5 text-[11px] text-[#78909c]">No branches are associated with this tenant yet.</div>
              ) : (
                branches.map((branch) => (
                  <div key={branch.id} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div>
                      <div className="text-[12px] font-bold text-[#1a3557]">
                        {branch.name}
                        {branch.isPrimary ? (
                          <span className="ml-2 inline-flex rounded-full bg-[#e8f1f8] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.4px] text-[#1e4a7a]">
                            Primary
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-[10px] text-[#607d8b]">{branch.code} • {branch.type} • {branch.status}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentBranch(branch.id)}
                      className={`rounded-sm px-3 py-2 text-[10px] font-bold ${
                        Number(currentBranch?.id) === Number(branch.id)
                          ? "bg-[#1e4a7a] text-white"
                          : "border border-[#d7e3ec] bg-white text-[#1a3557]"
                      }`}
                    >
                      {Number(currentBranch?.id) === Number(branch.id) ? "Current" : "Use This Branch"}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
