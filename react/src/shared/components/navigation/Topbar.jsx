import { useDeferredValue, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { logoutCurrentUser } from "@/modules/auth/api/auth.api";
import { useDashboardNotifications } from "@/modules/dashboard/hooks/useDashboard";
import { ConfirmationModal } from "@/shared/components/common/ConfirmationModal";
import { useNotification } from "@/shared/hooks/useNotification";
import { useUiStore } from "@/shared/store/ui.store";
import { useAuthStore } from "@/shared/store/auth.store";
import { getGlobalSearchResults } from "@/shared/api/global-search.api";
import { useWorkspaceContext } from "@/shared/hooks/useWorkspaceContext";

function notificationBadgeClasses(severity) {
  if (severity === "critical") {
    return "border-[#ef9a9a] bg-[#fff5f5] text-[#c62828]";
  }

  return "border-[#ffe082] bg-[#fff8e1] text-[#f57f17]";
}

export function Topbar() {
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const user = useAuthStore((state) => state.user);
  const { tenant, subscription, currentBranch, branches, subscriptionAccess, setCurrentBranch } = useWorkspaceContext();
  const notify = useNotification();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeSearchIndex, setActiveSearchIndex] = useState(-1);
  const menuRef = useRef(null);
  const notificationsRef = useRef(null);
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);
  const deferredSearch = useDeferredValue(searchInput.trim());
  const showNotifications = String(user?.role ?? "admin").toLowerCase() === "admin";
  const notificationsQuery = useDashboardNotifications({ enabled: showNotifications });
  const notificationFeed = notificationsQuery.data?.data;
  const notificationItems = notificationFeed?.items ?? [];
  const notificationCount = notificationFeed?.totalCount ?? 0;
  const searchQuery = useQuery({
    queryKey: ["global-search", debouncedSearch],
    queryFn: () => getGlobalSearchResults({ q: debouncedSearch }),
    enabled: searchOpen && debouncedSearch.length >= 2,
    staleTime: 30_000
  });

  const searchGroups = searchQuery.data?.data?.groups ?? [];
  const indexedSearchGroups = [];
  const flatSearchItems = [];
  let resultIndex = 0;

  for (const group of searchGroups) {
    const indexedItems = [];

    for (const item of group.items ?? []) {
      const indexedItem = {
        ...item,
        resultIndex
      };

      indexedItems.push(indexedItem);
      flatSearchItems.push(indexedItem);
      resultIndex += 1;
    }

    if (indexedItems.length > 0) {
      indexedSearchGroups.push({
        ...group,
        items: indexedItems
      });
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(deferredSearch);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [deferredSearch]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }

      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }

      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchOpen(false);
      }
    }

    function handleKeydown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        focusSearch();
        return;
      }

      if (event.key === "/" && !isEditableTarget(event.target)) {
        event.preventDefault();
        focusSearch();
        return;
      }

      if (event.key === "Escape") {
        setMenuOpen(false);
        setNotificationsOpen(false);
        setSearchOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeydown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeydown);
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setNotificationsOpen(false);
    setSearchOpen(false);
    setSearchInput("");
    setDebouncedSearch("");
    setActiveSearchIndex(-1);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (flatSearchItems.length === 0) {
      setActiveSearchIndex(-1);
      return;
    }

    setActiveSearchIndex(0);
  }, [searchQuery.dataUpdatedAt]);

  async function handleSignOut() {
    try {
      await logoutCurrentUser();
      clearAuth();
      setMenuOpen(false);
      setNotificationsOpen(false);
      setSignOutConfirmOpen(false);
      navigate("/login", { replace: true });
    } catch (error) {
      notify.error(error.response?.data?.message || "Failed to sign out. The server session is still active.");
    }
  }

  function handleNotificationToggle() {
    setMenuOpen(false);
    setSearchOpen(false);
    setNotificationsOpen((current) => !current);
  }

  function handleNotificationNavigate(href) {
    setNotificationsOpen(false);

    if (href) {
      navigate(href);
    }
  }

  function handleMenuNavigate(href) {
    setMenuOpen(false);
    if (href) {
      navigate(href);
    }
  }

  function focusSearch() {
    setMenuOpen(false);
    setNotificationsOpen(false);
    setSearchOpen(true);
    window.setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 0);
  }

  function handleSearchFocus() {
    setMenuOpen(false);
    setNotificationsOpen(false);
    setSearchOpen(true);
  }

  function moveActiveSearchIndex(direction) {
    if (flatSearchItems.length === 0) {
      setActiveSearchIndex(-1);
      return;
    }

    setActiveSearchIndex((current) => {
      if (current === -1) {
        return 0;
      }

      const nextIndex = current + direction;
      if (nextIndex < 0) {
        return flatSearchItems.length - 1;
      }

      if (nextIndex >= flatSearchItems.length) {
        return 0;
      }

      return nextIndex;
    });
  }

  function buildSearchTarget(item) {
    switch (item.targetType) {
      case "customer":
        return `/customers/${item.id}`;
      case "product":
        return `/products?search=${encodeURIComponent(item.searchValue || item.title || "")}`;
      case "supplier":
        return `/suppliers?search=${encodeURIComponent(item.searchValue || item.title || "")}`;
      case "sales_order":
        return `/sales-orders/${item.id}`;
      case "quotation":
        return `/quotations/${item.id}`;
      case "purchase_order":
        return `/purchase-orders/${item.id}`;
      case "delivery":
        return `/deliveries/${item.id}`;
      case "accounts_receivable":
        return `/accounts-receivable?search=${encodeURIComponent(item.searchValue || item.title || "")}`;
      case "customer_collection":
        return `/customer-collections?search=${encodeURIComponent(item.searchValue || item.title || "")}`;
      case "customer_return":
        return `/admin/customer-returns?search=${encodeURIComponent(item.searchValue || item.title || "")}`;
      case "user":
        return `/admin/users?search=${encodeURIComponent(item.searchValue || item.title || "")}`;
      default:
        return null;
    }
  }

  function navigateToSearchResult(item) {
    const target = buildSearchTarget(item);
    if (!target) {
      return;
    }

    setSearchOpen(false);
    navigate(target);
  }

  function handleSearchKeydown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActiveSearchIndex(1);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActiveSearchIndex(-1);
      return;
    }

    if (event.key === "Enter") {
      const activeItem = flatSearchItems[activeSearchIndex] ?? flatSearchItems[0];
      if (activeItem) {
        event.preventDefault();
        navigateToSearchResult(activeItem);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setSearchOpen(false);
    }
  }

  function getSearchIcon(targetType) {
    switch (targetType) {
      case "customer":
        return "fas fa-users";
      case "product":
        return "fas fa-box";
      case "supplier":
        return "fas fa-truck";
      case "sales_order":
        return "fas fa-shopping-cart";
      case "quotation":
        return "fas fa-file-invoice";
      case "purchase_order":
        return "fas fa-shopping-bag";
      case "delivery":
        return "fas fa-shipping-fast";
      case "accounts_receivable":
        return "fas fa-file-invoice-dollar";
      case "customer_collection":
        return "fas fa-money-bill-wave";
      case "customer_return":
        return "fas fa-rotate-left";
      case "user":
        return "fas fa-user-gear";
      default:
        return "fas fa-search";
    }
  }

  function isEditableTarget(target) {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const tagName = target.tagName;
    return target.isContentEditable || tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
  }

  const subscriptionBadgeClass = subscriptionAccess.isActive
    ? "bg-[#e8f5e9] text-[#2e7d32]"
    : "bg-[#fff5f5] text-[#c62828]";

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-white px-4 py-1.5">
      <div className="flex items-center gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            type="button"
            onClick={toggleSidebar}
            className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-border bg-white text-[12px] font-bold text-ink"
          >
            <i className="fas fa-bars" aria-hidden="true" />
          </button>
          <div className="flex items-center text-[11px]">
            <span className="font-bold uppercase tracking-[0.4px] text-ink">JRSPC ERP</span>
            <span className="mx-2 text-[#90a4ae]">&gt;</span>
            <span className="truncate text-muted">{tenant?.name || "Admin Panel"}</span>
          </div>
        </div>

        <div className="relative hidden w-full max-w-[420px] lg:block" ref={searchRef}>
          <div className="relative">
            <i className="fas fa-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
            <input
              ref={searchInputRef}
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
                setSearchOpen(true);
              }}
              onFocus={handleSearchFocus}
              onKeyDown={handleSearchKeydown}
              placeholder="Search customers, products, orders..."
              className="h-10 w-full rounded-sm border border-border bg-[#f9fafc] pl-9 pr-16 text-[12px] text-ink outline-none transition focus:border-[#1e4a7a] focus:bg-white focus:ring-2 focus:ring-[#1e4a7a]/10"
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border bg-white px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.3px] text-muted">
              /
            </span>
          </div>

          {searchOpen ? (
            <div className="absolute left-0 right-0 mt-2 overflow-hidden rounded-sm border border-border bg-white shadow-paper">
              <div className="border-b border-[#e8ecef] bg-[#f9fafc] px-4 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-bold text-ink">Global Search</p>
                    <p className="mt-0.5 text-[10px] text-muted">Customers, products, suppliers, orders, invoices, collections, returns, users.</p>
                  </div>
                  <span className="rounded border border-border bg-white px-2 py-1 text-[9px] font-bold uppercase tracking-[0.3px] text-muted">
                    Ctrl/Cmd+K
                  </span>
                </div>
              </div>

              {debouncedSearch.length < 2 ? (
                <div className="px-4 py-5 text-[11px] text-muted">Type at least 2 characters to search across modules.</div>
              ) : searchQuery.isLoading ? (
                <div className="px-4 py-5 text-[11px] text-muted">Searching records...</div>
              ) : searchQuery.isError ? (
                <div className="px-4 py-5 text-[11px] text-[#c62828]">Unable to search right now.</div>
              ) : flatSearchItems.length === 0 ? (
                <div className="px-4 py-5 text-[11px] text-muted">No matches found for "{debouncedSearch}".</div>
              ) : (
                <div className="max-h-[420px] overflow-y-auto">
                  {indexedSearchGroups.map((group) => (
                    <div key={group.key} className="border-b border-[#eef2f5] last:border-b-0">
                      <div className="bg-[#f9fafc] px-4 py-2 text-[9px] font-bold uppercase tracking-[0.5px] text-muted">
                        {group.label}
                      </div>
                      {group.items.map((item) => {
                        return (
                          <button
                            key={`${group.key}-${item.id}`}
                            type="button"
                            onMouseEnter={() => setActiveSearchIndex(item.resultIndex)}
                            onClick={() => navigateToSearchResult(item)}
                            className={`flex w-full items-start gap-3 px-4 py-3 text-left transition ${
                              item.resultIndex === activeSearchIndex ? "bg-[#eef5fb]" : "hover:bg-[#f8fbfd]"
                            }`}
                          >
                            <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-border bg-white text-[12px] text-[#1e4a7a]">
                              <i className={getSearchIcon(item.targetType)} aria-hidden="true" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[11px] font-bold text-ink">{item.title}</span>
                              {item.subtitle ? (
                                <span className="mt-1 block text-[10px] leading-4 text-muted">{item.subtitle}</span>
                              ) : null}
                            </span>
                            {item.meta ? (
                              <span className="shrink-0 text-[10px] font-medium text-[#90a4ae]">{item.meta}</span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 xl:flex">
            <div className="rounded-sm border border-[#d7e3ec] bg-[#f9fafc] px-3 py-2">
              <div className="text-[9px] font-bold uppercase tracking-[0.4px] text-[#78909c]">Subscription</div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[11px] font-bold text-[#1a3557]">{subscription?.planName || "No plan"}</span>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.3px] ${subscriptionBadgeClass}`}>
                  {subscriptionAccess.status || "unknown"}
                </span>
              </div>
            </div>

            <div className="rounded-sm border border-[#d7e3ec] bg-[#f9fafc] px-3 py-2">
              <div className="text-[9px] font-bold uppercase tracking-[0.4px] text-[#78909c]">Current Branch</div>
              {branches.length > 1 ? (
                <select
                  value={currentBranch?.id ?? ""}
                  onChange={(event) => setCurrentBranch(event.target.value)}
                  className="mt-1 min-w-[180px] border-0 bg-transparent p-0 text-[11px] font-bold text-[#1a3557] outline-none"
                >
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name} ({branch.code})
                    </option>
                  ))}
                </select>
              ) : (
                <div className="mt-1 text-[11px] font-bold text-[#1a3557]">
                  {currentBranch ? `${currentBranch.name} (${currentBranch.code})` : "No branch"}
                </div>
              )}
            </div>
          </div>

          {showNotifications ? (
            <div className="relative" ref={notificationsRef}>
              <button
                type="button"
                onClick={handleNotificationToggle}
                className="relative inline-flex h-11 w-11 items-center justify-center rounded-sm bg-[#f9fafc] text-[#1a3557] transition hover:bg-white"
                aria-label="Open notifications"
              >
                <i className="fas fa-bell text-[14px]" aria-hidden="true" />
                {notificationCount > 0 ? (
                  <span className="absolute right-1.5 top-1.5 min-w-[18px] rounded-full bg-[#c62828] px-1.5 py-[1px] text-center text-[9px] font-bold leading-none text-white">
                    {notificationCount > 99 ? "99+" : notificationCount}
                  </span>
                ) : null}
              </button>

              {notificationsOpen ? (
                <div className="absolute right-0 mt-2 w-[360px] overflow-hidden rounded-sm border border-border bg-white shadow-paper">
                  <div className="border-b border-[#e8ecef] bg-[#f9fafc] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[12px] font-bold text-ink">Admin Notifications</p>
                        <p className="mt-1 text-[10px] text-muted">Receivables and inventory issues that need attention.</p>
                      </div>
                      <span className="rounded-full bg-[#e8f1f8] px-2 py-1 text-[10px] font-bold text-[#1e4a7a]">
                        {notificationCount} active
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
                      <span className="rounded-full border border-[#d7e3ec] bg-white px-2 py-1 text-[#546e7a]">
                        Receivables {notificationFeed?.categories?.collections?.count ?? 0}
                      </span>
                      <span className="rounded-full border border-[#d7e3ec] bg-white px-2 py-1 text-[#546e7a]">
                        Inventory {notificationFeed?.categories?.inventory?.count ?? 0}
                      </span>
                    </div>
                  </div>

                  {notificationsQuery.isLoading ? (
                    <div className="px-4 py-6 text-[11px] text-muted">Loading notifications...</div>
                  ) : notificationsQuery.isError ? (
                    <div className="px-4 py-6 text-[11px] text-[#c62828]">Unable to load notifications right now.</div>
                  ) : notificationItems.length === 0 ? (
                    <div className="px-4 py-6 text-[11px] text-muted">No active admin alerts.</div>
                  ) : (
                    <div className="max-h-[420px] overflow-y-auto">
                      {notificationItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleNotificationNavigate(item.href)}
                          className="flex w-full items-start gap-3 border-b border-[#eef2f5] px-4 py-3 text-left transition hover:bg-[#f8fbfd]"
                        >
                          <span className={`mt-0.5 inline-flex shrink-0 rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.4px] ${notificationBadgeClasses(item.severity)}`}>
                            {item.label}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[11px] font-bold text-ink">{item.title}</span>
                            <span className="mt-1 block text-[10px] leading-4 text-muted">{item.message}</span>
                          </span>
                          <i className="fas fa-chevron-right mt-1 text-[10px] text-[#90a4ae]" aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => {
                setNotificationsOpen(false);
                setSearchOpen(false);
                setMenuOpen((current) => !current);
              }}
              className="flex items-center gap-3 rounded-sm bg-[#f9fafc] px-3 py-1.5 text-left transition hover:bg-white"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-[3px] bg-[#1e4a7a] text-white">
                <i className="fas fa-user-circle text-[15px]" aria-hidden="true" />
              </div>
              <div className="hidden sm:block">
                <p className="text-[11px] font-bold text-ink">{user?.username ?? "Administrator"}</p>
                <p className="text-[10px] uppercase text-muted">{user?.role ?? "admin"}</p>
              </div>
              <i className={`fas ${menuOpen ? "fa-chevron-up" : "fa-chevron-down"} text-[10px] text-muted`} aria-hidden="true" />
            </button>

            {menuOpen ? (
              <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-sm border border-border bg-white shadow-paper">
                <div className="border-b border-[#e8ecef] bg-[#f9fafc] px-3 py-2">
                  <p className="text-[11px] font-bold text-ink">{user?.username ?? "Administrator"}</p>
                  <p className="text-[10px] uppercase text-muted">{user?.role ?? "admin"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleMenuNavigate("/tenant/subscription")}
                  className="flex w-full items-center gap-2 border-b border-[#eef2f5] px-3 py-2 text-left text-[11px] font-medium text-ink transition hover:bg-[#f5f9fc]"
                >
                  <i className="fas fa-credit-card w-4 text-[11px] text-muted" aria-hidden="true" />
                  Subscription
                </button>
                <button
                  type="button"
                  onClick={() => handleMenuNavigate("/admin/profile")}
                  className="flex w-full items-center gap-2 border-b border-[#eef2f5] px-3 py-2 text-left text-[11px] font-medium text-ink transition hover:bg-[#f5f9fc]"
                >
                  <i className="fas fa-id-badge w-4 text-[11px] text-muted" aria-hidden="true" />
                  My Profile
                </button>
                <button
                  type="button"
                  onClick={() => handleMenuNavigate("/admin/settings/security")}
                  className="flex w-full items-center gap-2 border-b border-[#eef2f5] px-3 py-2 text-left text-[11px] font-medium text-ink transition hover:bg-[#f5f9fc]"
                >
                  <i className="fas fa-key w-4 text-[11px] text-muted" aria-hidden="true" />
                  Change Password
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setSignOutConfirmOpen(true);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11px] font-bold text-[#c62828] transition hover:bg-[#fff5f5]"
                >
                  <i className="fas fa-sign-out-alt w-4 text-[11px]" aria-hidden="true" />
                  Sign Out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <ConfirmationModal
        show={signOutConfirmOpen}
        title="Confirm Sign Out"
        message="Are you sure you want to sign out of the admin account?"
        type="warning"
        showCancel
        confirmText="Sign Out"
        onConfirm={handleSignOut}
        onClose={() => setSignOutConfirmOpen(false)}
      />
    </header>
  );
}
