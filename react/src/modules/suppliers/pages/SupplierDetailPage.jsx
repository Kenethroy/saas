import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Pagination } from "@/shared/components/common/Pagination";
import { Skeleton } from "@/shared/components/common/Skeleton";
import { getAccountsPayable } from "@/modules/accounts-payable/api/accounts-payable.api";
import { RecordSupplierPaymentModal } from "@/modules/accounts-payable/components/RecordSupplierPaymentModal";
import { getPurchaseOrders } from "@/modules/purchase-orders/api/purchase-orders.api";
import { getSupplierDetails } from "@/modules/suppliers/api/suppliers.api";

function formatMoney(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2
  }).format(Number(value ?? 0));
}

function formatDate(value) {
  if (!value) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function titleCase(value) {
  if (!value) {
    return "N/A";
  }

  return String(value)
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parsePositiveInt(value, fallback = 1) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isSupplierActive(supplier) {
  return supplier?.status === true || Number(supplier?.status) === 1;
}

function isOverduePayable(payable) {
  if (!payable?.dueDate || payable?.status === "paid") {
    return false;
  }

  return new Date(payable.dueDate) < new Date();
}

function getPurchaseOrderStatusClass(status) {
  switch (status) {
    case "pending":
      return "border-[#efd79a] bg-[#fff9ec] text-[#9a6a00]";
    case "approved":
      return "border-[#b8d4ea] bg-[#f4f9fd] text-[#1d6fa5]";
    case "received":
      return "border-[#c2ddbe] bg-[#f3faf1] text-[#356b37]";
    case "cancelled":
      return "border-[#e6b8b8] bg-[#fff7f7] text-[#a44d4d]";
    default:
      return "border-[#b0bec5] bg-[#f3f6f9] text-[#607d8b]";
  }
}

function getPayableStatusClass(status) {
  switch (status) {
    case "paid":
      return "border-[#a5d6a7] bg-[#e8f5e9] text-[#2e7d32]";
    case "partial":
      return "border-[#fff59d] bg-[#fffde7] text-[#f57f17]";
    default:
      return "border-[#ef9a9a] bg-[#ffebee] text-[#c62828]";
  }
}

function buildSupplierInsight(supplier, statistics) {
  const totalOrders = Number(statistics?.totalOrders ?? 0);
  const outstanding = Number(statistics?.totalOutstanding ?? 0);
  const overdue = Number(statistics?.totalOverdue ?? 0);
  const openPayablesCount = Number(statistics?.openPayablesCount ?? 0);
  const overduePayablesCount = Number(statistics?.overduePayablesCount ?? 0);

  if (overdue > 0) {
    return `${supplier?.name ?? "This supplier"} has ${overduePayablesCount} overdue payable record(s) totaling ${formatMoney(overdue)}. Prioritize settlement or due-date review before placing additional orders.`;
  }

  if (outstanding > 0) {
    return `${supplier?.name ?? "This supplier"} currently has ${openPayablesCount} open payable record(s) with ${formatMoney(outstanding)} still outstanding. Receiving activity is active, but the account is not yet fully settled.`;
  }

  if (totalOrders > 0) {
    return `${supplier?.name ?? "This supplier"} has ${totalOrders} recorded purchase order(s) and no open payable balance right now. The account is currently clean from an accounts payable standpoint.`;
  }

  return `${supplier?.name ?? "This supplier"} does not have purchase order or payable activity yet. The record is ready for procurement once the first order is placed.`;
}

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-sm border border-[#d7e3ec] bg-white px-4 py-3">
      <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#607d8b]">{label}</div>
      <div className="mt-2 text-[18px] font-extrabold tracking-[0.2px] text-[#1a3557]">{value}</div>
      {hint ? <div className="mt-1 text-[10px] text-[#90a4ae]">{hint}</div> : null}
    </div>
  );
}

function SectionCard({ title, description, actions = null, children }) {
  return (
    <section className="overflow-hidden rounded-sm border border-[#d7e3ec] bg-white">
      <div className="flex flex-col gap-3 border-b border-[#e8eef3] bg-[#f8fbfd] px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-[13px] font-bold text-[#1a3557]">{title}</div>
          {description ? <div className="mt-0.5 text-[10px] text-[#607d8b]">{description}</div> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function TableEmptyState({ colSpan, message }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-[11px] italic text-[#90a4ae]">
        {message}
      </td>
    </tr>
  );
}

const supplierTabs = [
  { key: "orders", label: "Purchase Orders", icon: "fas fa-shopping-bag" },
  { key: "payables", label: "Accounts Payable", icon: "fas fa-wallet" }
];

export function SupplierDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [paymentTarget, setPaymentTarget] = useState(null);

  const activeTab = supplierTabs.some((tab) => tab.key === searchParams.get("tab"))
    ? searchParams.get("tab")
    : "orders";
  const currentOrdersPage = parsePositiveInt(searchParams.get("ordersPage"), 1);
  const currentPayablesPage = parsePositiveInt(searchParams.get("payablesPage"), 1);
  const ordersStatus = searchParams.get("ordersStatus") || "";
  const payablesStatus = searchParams.get("payablesStatus") || "";
  const overdueOnly = searchParams.get("payablesOverdue") === "true";

  const {
    data: detailsResponse,
    isLoading: isDetailsLoading,
    isError: isDetailsError,
    error: detailsError
  } = useQuery({
    queryKey: ["supplier-detail", id],
    enabled: Boolean(id),
    queryFn: () => getSupplierDetails(id)
  });

  const {
    data: ordersResponse,
    isLoading: isOrdersLoading,
    isFetching: isOrdersFetching
  } = useQuery({
    queryKey: ["supplier-purchase-orders", id, currentOrdersPage, ordersStatus],
    enabled: Boolean(id),
    queryFn: () =>
      getPurchaseOrders({
        page: currentOrdersPage,
        perPage: 10,
        supplierId: id,
        ...(ordersStatus ? { status: ordersStatus } : {})
      }),
    placeholderData: keepPreviousData
  });

  const {
    data: payablesResponse,
    isLoading: isPayablesLoading,
    isFetching: isPayablesFetching
  } = useQuery({
    queryKey: ["supplier-payables", id, currentPayablesPage, payablesStatus, overdueOnly],
    enabled: Boolean(id),
    queryFn: () =>
      getAccountsPayable({
        page: currentPayablesPage,
        perPage: 10,
        supplierId: id,
        ...(payablesStatus ? { status: payablesStatus } : {}),
        ...(overdueOnly ? { overdue: "true" } : {})
      }),
    placeholderData: keepPreviousData
  });

  const details = detailsResponse?.data ?? null;
  const supplier = details?.supplier ?? null;
  const statistics = details?.statistics ?? {};
  const purchaseOrders = ordersResponse?.data ?? [];
  const purchaseOrdersMeta = ordersResponse?.meta ?? {};
  const payables = payablesResponse?.data ?? [];
  const payablesMeta = payablesResponse?.meta ?? {};
  const openPayablesPreview = payables.filter((entry) => entry.status !== "paid").slice(0, 5);
  const insight = buildSupplierInsight(supplier, statistics);

  function updateSupplierParams(nextValues) {
    const nextParams = new URLSearchParams(searchParams);

    Object.entries(nextValues).forEach(([key, value]) => {
      if (value === "" || value === null || value === undefined || value === false) {
        nextParams.delete(key);
        return;
      }

      nextParams.set(key, String(value));
    });

    setSearchParams(nextParams);
  }

  function handleTabChange(tabKey) {
    updateSupplierParams({ tab: tabKey });
  }

  if (isDetailsError) {
    return (
      <section className="rounded-sm border border-[#ef9a9a] bg-[#fff5f5] px-4 py-8 text-[11px] text-[#c62828]">
        Failed to load supplier details{detailsError?.message ? `: ${detailsError.message}` : "."}
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-sm border border-[#cfdce7] bg-white shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
        <div className="bg-[linear-gradient(180deg,#f8fbfd_0%,#eef5fa_100%)] px-5 py-5 text-[#1a3557]">
          <div className="flex flex-col gap-3 border-b border-[#dbe6ee] pb-4 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => navigate("/suppliers")}
                className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-sm border border-[#c3d4e1] bg-white text-[#1a3557] transition hover:border-[#8fb1c9] hover:bg-[#eef5fa]"
                title="Back to Suppliers"
              >
                <i className="fas fa-arrow-left text-[12px]" />
              </button>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.7px] text-[#607d8b]">Supplier Details</div>
                <div className="mt-1 text-[12px] text-[#546e7a]">Procurement history, supplier payables, and account overview</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => navigate(`/purchase-orders/create?supplier=${id}`)}
                className="inline-flex items-center justify-center rounded-sm bg-[#0070b8] px-3.5 py-1.5 text-[11px] font-bold text-white transition hover:bg-[#005a94] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!supplier}
              >
                <i className="fas fa-plus mr-1.5" />
                New Purchase Order
              </button>
              <button
                type="button"
                onClick={() => handleTabChange("payables")}
                className="inline-flex items-center justify-center rounded-sm border border-[#c3d4e1] bg-white px-3.5 py-1.5 text-[11px] font-bold text-[#1a3557] transition hover:border-[#8fb1c9] hover:bg-[#eef5fa] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!supplier}
              >
                <i className="fas fa-wallet mr-1.5" />
                View Payables
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1.7fr_1fr]">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.7px] text-[#607d8b]">Supplier Account</div>
              <div className="mt-2 text-[26px] font-extrabold tracking-[0.3px]">
                {isDetailsLoading ? <Skeleton className="h-7 w-64 bg-[#d9e6f0]" /> : supplier?.name ?? "N/A"}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#546e7a]">
                <span>{supplier?.companyName || "No company"}</span>
                <span>{supplier?.email || "No email"}</span>
                <span>{supplier?.phone || "No phone"}</span>
              </div>
              <div className="mt-2 text-[11px] text-[#546e7a]">{supplier?.address || "No address set"}</div>
            </div>

            <div className="rounded-sm border border-[#d7e3ec] bg-white px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#607d8b]">Terms & Status</div>
              <div className="mt-3 space-y-2 text-[12px]">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#607d8b]">Contact Person</span>
                  <span className="font-bold">{supplier?.contactPerson || "N/A"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#607d8b]">Payment Terms</span>
                  <span className="font-bold">
                    {supplier?.paymentTerm?.name
                      ? `${supplier.paymentTerm.name}${supplier.paymentTerm.days ? ` (${supplier.paymentTerm.days} days)` : ""}`
                      : "Cash / None"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#607d8b]">Supplier Since</span>
                  <span className="font-bold">{formatDate(supplier?.createdAt)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[#607d8b]">Account Status</span>
                  <span className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-[10px] font-bold uppercase ${isSupplierActive(supplier) ? "border-[#a5d6a7] bg-[#e8f5e9] text-[#2e7d32]" : "border-[#ef9a9a] bg-[#fff5f5] text-[#c62828]"}`}>
                    {isSupplierActive(supplier) ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 border-t border-[#dbe6ee] pt-5 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Purchase Orders" value={isDetailsLoading ? "..." : statistics.totalOrders ?? 0} hint={`${formatDate(statistics.lastOrderDate)} last order date`} />
            <StatCard label="Total Purchased" value={isDetailsLoading ? "..." : formatMoney(statistics.totalSpent)} hint={`${formatMoney(statistics.totalReceived)} received value`} />
            <StatCard label="Outstanding" value={isDetailsLoading ? "..." : formatMoney(statistics.totalOutstanding)} hint={`${statistics.openPayablesCount ?? 0} open payable record(s)`} />
            <StatCard label="Overdue" value={isDetailsLoading ? "..." : formatMoney(statistics.totalOverdue)} hint={`${statistics.overduePayablesCount ?? 0} overdue payable(s)`} />
          </div>
        </div>

        <div className="grid gap-4 border-t border-[#dbe6ee] bg-[#fbfdff] px-5 py-5 xl:grid-cols-[1.7fr_1fr]">
          <SectionCard title="Open Payables" description="Recent unpaid or partially paid records for this supplier.">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed border-collapse">
                <thead>
                  <tr>
                    <th className="w-[20%] border-b border-[#9fb3c2] bg-[#2c5f8a] px-2.5 py-2 text-left text-[10px] font-bold uppercase tracking-[0.3px] text-white">PO Number</th>
                    <th className="w-[17%] border-b border-[#9fb3c2] bg-[#2c5f8a] px-2.5 py-2 text-left text-[10px] font-bold uppercase tracking-[0.3px] text-white">Receipt Date</th>
                    <th className="w-[17%] border-b border-[#9fb3c2] bg-[#2c5f8a] px-2.5 py-2 text-left text-[10px] font-bold uppercase tracking-[0.3px] text-white">Due Date</th>
                    <th className="w-[18%] border-b border-[#9fb3c2] bg-[#2c5f8a] px-2.5 py-2 text-right text-[10px] font-bold uppercase tracking-[0.3px] text-white">Amount</th>
                    <th className="w-[18%] border-b border-[#9fb3c2] bg-[#2c5f8a] px-2.5 py-2 text-right text-[10px] font-bold uppercase tracking-[0.3px] text-white">Outstanding</th>
                    <th className="w-[10%] border-b border-[#9fb3c2] bg-[#2c5f8a] px-2.5 py-2 text-left text-[10px] font-bold uppercase tracking-[0.3px] text-white">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {isPayablesLoading ? (
                    <TableEmptyState colSpan={6} message="Loading supplier payables..." />
                  ) : openPayablesPreview.length === 0 ? (
                    <TableEmptyState colSpan={6} message="No open payables for this supplier." />
                  ) : (
                    openPayablesPreview.map((entry) => {
                      const overdue = isOverduePayable(entry);
                      return (
                        <tr key={entry.id} className="border-t border-[#d3dee7] bg-[#fbfdff] align-top even:bg-[#f7fbfe] hover:bg-[#edf5fb]">
                          <td className="px-2.5 py-2 text-[11px] font-mono font-bold text-[#1a3557]">{entry.poNumber}</td>
                          <td className="px-2.5 py-2 text-[10px] text-[#546e7a]">{formatDate(entry.receiptDate)}</td>
                          <td className="px-2.5 py-2 text-[10px] text-[#546e7a]">
                            <div>{formatDate(entry.dueDate)}</div>
                            {overdue ? <div className="mt-0.5 text-[10px] text-[#c62828]">Overdue</div> : null}
                          </td>
                          <td className="px-2.5 py-2 text-right text-[10px] font-mono text-[#1a3557]">{formatMoney(entry.amount)}</td>
                          <td className="px-2.5 py-2 text-right text-[10px] font-mono font-bold text-[#c62828]">{formatMoney(entry.outstandingAmount)}</td>
                          <td className="px-2.5 py-2">
                            <span className={`inline-flex rounded-sm border px-1.5 py-0.5 text-[8px] font-bold uppercase leading-none ${getPayableStatusClass(entry.status)}`}>
                              {titleCase(entry.status)}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title="Supplier Insight" description="Quick summary from current purchasing and payable activity.">
            <div className="h-full bg-[radial-gradient(circle_at_top_left,#e8f4fb_0%,#f8fbfd_42%,#ffffff_100%)] px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-sm bg-[#d9edf9] text-[#0070b8]">
                  <i className="fas fa-chart-line text-[15px]" />
                </div>
                <p className="text-[12px] leading-6 text-[#355163]">{insight}</p>
              </div>

              <div className="mt-5 grid gap-2">
                <div className="flex items-center justify-between rounded-sm border border-[#e1eaf0] bg-white px-3 py-2 text-[11px]">
                  <span className="font-bold text-[#607d8b]">Last Order Date</span>
                  <span className="font-mono font-bold text-[#1a3557]">{formatDate(statistics.lastOrderDate)}</span>
                </div>
                <div className="flex items-center justify-between rounded-sm border border-[#e1eaf0] bg-white px-3 py-2 text-[11px]">
                  <span className="font-bold text-[#607d8b]">Last Receipt Date</span>
                  <span className="font-mono font-bold text-[#1a3557]">{formatDate(statistics.lastReceiptDate)}</span>
                </div>
                <div className="flex items-center justify-between rounded-sm border border-[#e1eaf0] bg-white px-3 py-2 text-[11px]">
                  <span className="font-bold text-[#607d8b]">Open Payables</span>
                  <span className="font-mono font-bold text-[#1a3557]">{statistics.openPayablesCount ?? 0}</span>
                </div>
                <div className="flex items-center justify-between rounded-sm border border-[#e1eaf0] bg-white px-3 py-2 text-[11px]">
                  <span className="font-bold text-[#607d8b]">Overdue Payables</span>
                  <span className="font-mono font-bold text-[#c62828]">{statistics.overduePayablesCount ?? 0}</span>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="border-t border-[#dbe6ee]">
          <section className="overflow-hidden bg-white">
            <div className="hide-scrollbar flex overflow-x-auto overflow-y-hidden border-b-2 border-[#dce5ec] bg-[#f3f6f9]">
              {supplierTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => handleTabChange(tab.key)}
                  className={`-mb-0.5 whitespace-nowrap border-b-[3px] px-5 py-2.5 text-[12px] font-bold transition-all ${
                    activeTab === tab.key
                      ? "border-[#0070b8] bg-white text-[#0070b8]"
                      : "border-transparent text-[#546e7a] hover:bg-[#e8f1f8] hover:text-[#0070b8]"
                  }`}
                >
                  <i className={`${tab.icon} mr-1.5`} />
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "orders" ? (
              <div>
                <div className="flex flex-col gap-3 bg-[#1a3557] px-4 py-2 md:flex-row md:items-center md:justify-between">
                  <div className="text-[10px] font-bold uppercase tracking-[0.8px] text-[#90caf9]">
                    <i className="fas fa-shopping-bag mr-1.5" />
                    Purchase Order History
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={ordersStatus}
                      onChange={(event) => {
                        updateSupplierParams({
                          ordersStatus: event.target.value,
                          ordersPage: 1
                        });
                      }}
                      className="erp-select h-8 min-w-[170px] border-[#b0bec5] bg-white text-[11px]"
                    >
                      <option value="">All Orders</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="received">Received</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="erp-table w-full min-w-[860px]">
                    <thead>
                      <tr>
                        <th>PO Number</th>
                        <th>Order Date</th>
                        <th>Expected Date</th>
                        <th>Payment Terms</th>
                        <th>Total Amount</th>
                        <th>Items</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isOrdersLoading ? (
                        <TableEmptyState colSpan={7} message="Loading purchase orders..." />
                      ) : purchaseOrders.length === 0 ? (
                        <TableEmptyState colSpan={7} message="No purchase orders found for this supplier." />
                      ) : (
                        purchaseOrders.map((order) => (
                          <tr key={order.id} className="cursor-pointer" onClick={() => navigate(`/purchase-orders/${order.id}`)}>
                            <td className="font-mono text-[#1a3557]">{order.poNumber}</td>
                            <td>{formatDate(order.orderDate)}</td>
                            <td>{formatDate(order.expectedDate)}</td>
                            <td>{order.paymentTermsName || "Cash / None"}</td>
                            <td className="font-bold text-[#1a3557]">{formatMoney(order.totalAmount)}</td>
                            <td>{order._count?.items ?? "—"}</td>
                            <td>
                              <span className={`rounded-sm border px-1.5 py-0.5 text-[9px] font-bold uppercase ${getPurchaseOrderStatusClass(order.status)}`}>
                                {titleCase(order.status)}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {!isOrdersLoading && (purchaseOrdersMeta.total ?? 0) > 0 ? (
                  <Pagination
                    currentPage={purchaseOrdersMeta.page ?? 1}
                    lastPage={purchaseOrdersMeta.totalPages ?? 1}
                    perPage={purchaseOrdersMeta.limit ?? 10}
                    total={purchaseOrdersMeta.total ?? 0}
                    itemLabel="purchase orders"
                    loading={isOrdersFetching}
                    onPrevious={() => updateSupplierParams({ ordersPage: Math.max(1, currentOrdersPage - 1) })}
                    onNext={() => updateSupplierParams({ ordersPage: Math.min(purchaseOrdersMeta.totalPages ?? currentOrdersPage, currentOrdersPage + 1) })}
                    onGoto={(target) => updateSupplierParams({ ordersPage: target })}
                  />
                ) : null}
              </div>
            ) : null}

            {activeTab === "payables" ? (
              <div>
                <div className="flex flex-col gap-3 bg-[#1a3557] px-4 py-2 md:flex-row md:items-center md:justify-between">
                  <div className="text-[10px] font-bold uppercase tracking-[0.8px] text-[#90caf9]">
                    <i className="fas fa-wallet mr-1.5" />
                    Accounts Payable History
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={payablesStatus}
                      onChange={(event) => {
                        updateSupplierParams({
                          payablesStatus: event.target.value,
                          payablesPage: 1
                        });
                      }}
                      className="erp-select h-8 min-w-[160px] border-[#b0bec5] bg-white text-[11px]"
                    >
                      <option value="">All Payables</option>
                      <option value="unpaid">Unpaid</option>
                      <option value="partial">Partial</option>
                      <option value="paid">Paid</option>
                    </select>

                    <label className="flex items-center gap-1.5 rounded-sm border border-[#416b91] bg-[#244a6f] px-2.5 py-1.5 text-[10px] font-bold text-white">
                      <input
                        type="checkbox"
                        checked={overdueOnly}
                        onChange={(event) => {
                          updateSupplierParams({
                            payablesOverdue: event.target.checked ? "true" : "",
                            payablesPage: 1
                          });
                        }}
                        className="h-[13px] w-[13px] accent-[#90caf9]"
                      />
                      Overdue Only
                    </label>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="erp-table w-full min-w-[920px]">
                    <thead>
                      <tr>
                        <th>PO Number</th>
                        <th>Receipt Date</th>
                        <th>Due Date</th>
                        <th>Amount</th>
                        <th>Paid</th>
                        <th>Outstanding</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isPayablesLoading ? (
                        <TableEmptyState colSpan={8} message="Loading payable history..." />
                      ) : payables.length === 0 ? (
                        <TableEmptyState colSpan={8} message="No payable records found for this supplier." />
                      ) : (
                        payables.map((entry) => {
                          const overdue = isOverduePayable(entry);
                          return (
                            <tr key={entry.id} className={overdue ? "bg-[#fff5f5]" : undefined}>
                              <td className="font-mono text-[#1a3557]">{entry.poNumber}</td>
                              <td>{formatDate(entry.receiptDate)}</td>
                              <td className={overdue ? "font-bold text-[#c62828]" : undefined}>
                                {formatDate(entry.dueDate)}
                              </td>
                              <td className="font-mono">{formatMoney(entry.amount)}</td>
                              <td className="font-mono text-[#2e7d32]">{formatMoney(entry.paidAmount)}</td>
                              <td className="font-mono font-bold text-[#c62828]">{formatMoney(entry.outstandingAmount)}</td>
                              <td>
                                <div className="flex flex-col gap-1">
                                  <span className={`w-fit rounded-sm border px-1.5 py-0.5 text-[9px] font-bold uppercase ${getPayableStatusClass(entry.status)}`}>
                                    {titleCase(entry.status)}
                                  </span>
                                  {overdue ? <span className="text-[10px] text-[#c62828]">Overdue</span> : null}
                                </div>
                              </td>
                              <td>
                                <div className="flex items-center justify-center">
                                  <button
                                    type="button"
                                    onClick={() => setPaymentTarget(entry)}
                                    className="erp-icon-button-md"
                                    title="Record supplier payment"
                                    disabled={entry.status === "paid" || Number(entry.outstandingAmount ?? 0) <= 0}
                                  >
                                    <i className="fas fa-money-check-dollar text-[11px]" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {!isPayablesLoading && (payablesMeta.total ?? 0) > 0 ? (
                  <Pagination
                    currentPage={payablesMeta.currentPage ?? 1}
                    lastPage={payablesMeta.lastPage ?? 1}
                    perPage={payablesMeta.perPage ?? 10}
                    total={payablesMeta.total ?? 0}
                    itemLabel="payables"
                    loading={isPayablesFetching}
                    onPrevious={() => updateSupplierParams({ payablesPage: Math.max(1, currentPayablesPage - 1) })}
                    onNext={() => updateSupplierParams({ payablesPage: Math.min(payablesMeta.lastPage ?? currentPayablesPage, currentPayablesPage + 1) })}
                    onGoto={(target) => updateSupplierParams({ payablesPage: target })}
                  />
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      </section>

      <RecordSupplierPaymentModal
        show={Boolean(paymentTarget)}
        record={paymentTarget}
        onClose={() => setPaymentTarget(null)}
      />
    </div>
  );
}
