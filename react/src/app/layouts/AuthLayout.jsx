import { Outlet } from "react-router-dom";

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-[#f3f6f9]">
      <div className="fixed inset-x-0 top-0 flex items-center justify-between bg-ink px-5 py-1.5 text-[10px] text-[#90caf9]">
        <div className="flex items-center gap-2">
          <span className="font-bold uppercase tracking-[0.8px] text-white">JRSPC</span>
          <span className="text-[#4a7fa8]">&gt;</span>
          <span>Sign In</span>
        </div>
        <div>
          <span className="mr-1 text-[#66bb6a]">o</span>
          System Online
        </div>
      </div>

      <div className="flex min-h-screen items-center justify-center px-4 pt-12">
        <div className="w-full max-w-[380px]">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-sm bg-ink text-white shadow-paper">
              <i className="fas fa-building text-[24px]" aria-hidden="true" />
            </div>
            <div className="text-[24px] font-black uppercase tracking-[0.18em] text-ink">JRSPC</div>
            <div className="mt-1 text-[11px] font-semibold text-muted">Inventory Management System</div>
          </div>

          <section className="app-shell-card">
            <Outlet />
          </section>
        </div>
      </div>
    </div>
  );
}
