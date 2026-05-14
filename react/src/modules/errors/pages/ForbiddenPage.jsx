import { useNavigate } from "react-router-dom";

export function ForbiddenPage() {
  const navigate = useNavigate();

  return (
    <section className="erp-page-main-card flex min-h-[360px] flex-col items-center justify-center px-6 py-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#fff5f5] text-[#c62828]">
        <i className="fas fa-ban text-[24px]" aria-hidden="true" />
      </div>
      <div className="mt-5 text-[22px] font-bold text-[#1a3557]">Access Denied</div>
      <div className="mt-2 max-w-[480px] text-[12px] leading-6 text-[#607d8b]">
        Your account is authenticated, but the assigned role and permissions do not allow access to this page.
      </div>
      <button
        type="button"
        onClick={() => navigate("/dashboard")}
        className="mt-6 inline-flex items-center justify-center rounded-sm bg-[#0070b8] px-4 py-2 text-[11px] font-bold text-white transition hover:bg-[#005a94]"
      >
        Return to Dashboard
      </button>
    </section>
  );
}
