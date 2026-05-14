import { NavLink } from "react-router-dom";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/shared/store/auth.store";
import { useUiStore } from "@/shared/store/ui.store";
import { canAccess } from "@/shared/utils/access-control";

const sections = [
  {
    title: null,
    items: [
      { label: "Dashboard", to: "/dashboard", icon: "fa-chart-line", end: true },
      { label: "Assistant", to: "/assistant", icon: "fa-robot", permission: "customers.view" }
    ]
  },
  {
    title: "Workspace",
    items: [
      { label: "Subscription", to: "/tenant/subscription", icon: "fa-credit-card", permission: "subscription.view" },
      { label: "Tenant Settings", to: "/tenant/settings", icon: "fa-building", permission: "tenant.profile.view" },
      { label: "Branches", to: "/tenant/branches", icon: "fa-code-branch", permission: "branches.view" }
    ]
  },
  {
    title: "Core Records",
    items: [
      { label: "Categories", to: "/categories", icon: "fa-tags", permission: "categories.view" },
      { label: "Products", to: "/products", icon: "fa-box", permission: "products.view" },
      { label: "Trucks", to: "/trucks", icon: "fa-truck", permission: "trucks.view" },
      { label: "Customers", to: "/customers", icon: "fa-users", permission: "customers.view" },
      { label: "Suppliers", to: "/suppliers", icon: "fa-truck-ramp-box", permission: "suppliers.view" }
    ]
  },
  {
    title: "Operations",
    items: [
      { label: "Quotations", to: "/quotations", icon: "fa-file-invoice", permission: "quotations.view" },
      { label: "Sales Orders", to: "/sales-orders", icon: "fa-file-invoice", permission: "salesOrders.view" },
      { label: "Purchase Orders", to: "/purchase-orders", icon: "fa-shopping-bag", permission: "purchaseOrders.view" },
      { label: "Deliveries", to: "/deliveries", icon: "fa-truck-fast", permission: "deliveries.view" }
    ]
  },
  {
    title: "Inventory Control",
    items: [
      { label: "Inventory Overview", to: "/inventory", icon: "fa-warehouse", permission: "products.view" },
      { label: "Stock Movement Logs", to: "/stock-movement-logs", icon: "fa-right-left", permission: "inventory.viewLogs" },
      { label: "Stock Adjustments", to: "/stock-adjustments", icon: "fa-sliders", permissions: ["view_stock_adjustments", "inventory.viewLogs"], requireAny: true },
      { label: "Customer Return RMA", to: "/customer-return-rma", icon: "fa-rotate-left", permission: "customerReturns.view" }
    ]
  },
  {
    title: "Finance",
    items: [
      { label: "Payment Terms", to: "/payment-terms", icon: "fa-calendar-check", permission: "paymentTerms.view" },
      { label: "Accounts Receivable", to: "/accounts-receivable", icon: "fa-money-bill-wave" },
      { label: "Customer Collections", to: "/customer-collections", icon: "fa-file-invoice-dollar", permission: "payments.view" },
      { label: "Accounts Payable", to: "/accounts-payable", icon: "fa-wallet", permission: "accountsPayable.view" },
      { label: "Business Expenses", to: "/business-expenses", icon: "fa-receipt", permission: "businessExpenses.view" }
    ]
  },
  {
    title: "Reports",
    items: [
      { label: "Profit and Loss", to: "/reports/profit-and-loss", icon: "fa-chart-pie" },
      { label: "Sales and Purchase Analysis", to: "/reports/sales-and-purchase-analysis", icon: "fa-chart-column" },
      { label: "Inventory Movement Analysis", to: "/reports/inventory-movement-analysis", icon: "fa-boxes-stacked" }
    ]
  },
  {
    title: "Admin",
    items: [
      { label: "Agent Operations", to: "/admin/agent-operations", icon: "fa-clipboard-check" },
      { label: "Employees", to: "/admin/employees", icon: "fa-id-card", permission: "employees.view" },
      { label: "Payslips", to: "/admin/payslips", icon: "fa-receipt", permission: "payslips.view" },
      { label: "Users", to: "/admin/users", icon: "fa-user-gear", permission: "users.view" },
      { label: "Permissions", to: "/admin/permissions", icon: "fa-user-shield", permission: "users.permissions.manage" },
      { label: "Activity Logs", to: "/admin/activity-logs", icon: "fa-history", permission: "activity_logs.view" },
      { label: "System Settings", to: "/admin/settings", icon: "fa-cog", permission: "settings.view" }
    ]
  }
];

function itemClasses(isActive, compact) {
  return [
    "group mx-2 flex items-center rounded-[3px] border-l-[3px] py-2 text-[#b3cde0] transition-all duration-150 hover:bg-[#1e4a7a] hover:text-white hover:border-l-[#4a90b8]",
    compact ? "justify-center px-0" : "justify-start gap-[10px] px-4",
    isActive ? "border-l-[#64b5f6] bg-[#0070b8] text-white" : "border-l-transparent"
  ].join(" ");
}

export function Sidebar() {
  const sidebarOpen = useUiStore((state) => state.sidebarOpen);
  const user = useAuthStore((state) => state.user);
  const compact = !sidebarOpen;
  const [hoveredItem, setHoveredItem] = useState(null);
  const closeTimerRef = useRef(null);
  const visibleSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        canAccess(user, {
          permission: item.permission ?? null,
          permissions: item.permissions ?? [],
          requireAny: item.requireAny ?? false
        })
      )
    }))
    .filter((section) => section.items.length > 0);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  function openHoverCard(item, event) {
    if (!compact) {
      return;
    }

    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    setHoveredItem({
      label: item.label,
      top: rect.top + rect.height / 2,
      left: rect.right + 8
    });
  }

  function scheduleHoverCardClose() {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }

    closeTimerRef.current = window.setTimeout(() => {
      setHoveredItem(null);
    }, 100);
  }

  function keepHoverCardOpen() {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  return (
    <>
      <aside
        className={`erp-sidebar-body fixed inset-y-0 left-0 z-40 hidden h-screen flex-col overflow-hidden border-r-[3px] border-[#0070b8] font-sans text-[13px] shadow-[8px_0_24px_rgba(15,33,56,0.18)] transition-[width,min-width] duration-300 ease-in-out lg:flex ${
          sidebarOpen ? "w-[260px] min-w-[260px]" : "w-[64px] min-w-[64px]"
        }`}
      >
        <div
          className={`flex items-center border-b border-white/10 bg-[#12263f] py-[14px] transition-all duration-300 ${
            compact ? "justify-center px-0" : "gap-3 px-3"
          }`}
        >
          <div
            className={`flex h-[40px] w-[40px] items-center justify-center overflow-hidden rounded-full bg-[#0070b8] text-white transition-all duration-300 ${
              compact ? "opacity-100" : "opacity-100"
            }`}
          >
            <i className="fas fa-warehouse text-[17px]" aria-hidden="true" />
          </div>
          <div className={`overflow-hidden transition-all duration-300 ${compact ? "max-w-0 w-0 opacity-0" : "flex-1 opacity-100"}`}>
            <div className="whitespace-nowrap text-[16px] font-bold uppercase leading-[1.1] tracking-[1.5px] text-white">JRSPC</div>
            <div className="mt-0.5 whitespace-nowrap text-[9px] uppercase tracking-[0.3px] text-[#64b5f6]">Hardware Enterprise</div>
          </div>
        </div>

        <div
          className={`flex items-center gap-[6px] border-b border-white/10 bg-[#152d4a] py-[5px] text-[9px] font-bold uppercase tracking-[1px] text-[#4a90b8] transition-all duration-300 ${
            compact ? "justify-center px-0" : "px-4"
          }`}
        >
          <i className="fas fa-th-large shrink-0 text-[9px] opacity-70" aria-hidden="true" />
          {!compact ? <span>Main Navigation</span> : null}
        </div>

        <nav className="erp-sidebar-scroll flex-1 overflow-y-auto overflow-x-hidden py-2">
          {visibleSections.map((section) => (
            <div key={section.title ?? section.items[0]?.to ?? "section"} className="mb-2">
              {!compact && section.title ? <p className="px-4 py-1 text-[9px] font-bold uppercase tracking-[0.8px] text-[#4a90b8]">{section.title}</p> : null}
              <div className="space-y-1">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => itemClasses(isActive, compact)}
                    onMouseEnter={(event) => openHoverCard(item, event)}
                    onMouseLeave={scheduleHoverCardClose}
                    onFocus={(event) => openHoverCard(item, event)}
                    onBlur={scheduleHoverCardClose}
                  >
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] bg-white/5 text-center text-[11px] opacity-90">
                      <i className={`fas ${item.icon}`} aria-hidden="true" />
                    </span>
                    {!compact ? <span className="truncate text-[12.5px] font-semibold tracking-[0.1px]">{item.label}</span> : null}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {hoveredItem && compact
        ? createPortal(
            <div
              className="fixed z-[90] min-w-[180px] rounded-[6px] border border-[#2c5f8a] bg-[#0d1f33] px-4 py-2 text-[12px] font-semibold text-[#b3cde0] shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
              style={{
                top: hoveredItem.top,
                left: hoveredItem.left,
                transform: "translateY(-50%)"
              }}
              onMouseEnter={keepHoverCardOpen}
              onMouseLeave={scheduleHoverCardClose}
            >
              {hoveredItem.label}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
