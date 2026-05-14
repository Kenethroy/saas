import { Outlet } from "react-router-dom";
import { Sidebar } from "@/shared/components/navigation/Sidebar";
import { Topbar } from "@/shared/components/navigation/Topbar";
import { useUiStore } from "@/shared/store/ui.store";

export function DashboardLayout() {
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <Sidebar />
      <div
        className={`flex min-h-screen flex-1 flex-col overflow-hidden transition-all duration-300 ${
          sidebarOpen ? "lg:ml-[260px]" : "lg:ml-[64px]"
        }`}
      >
        <Topbar />
        <main className="erp-content-surface flex-1 overflow-y-auto p-3">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
