import { useDeferredValue, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Pagination } from "@/shared/components/common/Pagination";
import { Skeleton, TableSkeleton } from "@/shared/components/common/Skeleton";
import {
  useAgentCollectionHistory,
  useAgentProfile,
  useAgentRemittanceLedger,
  useAgentSalesHistory
} from "../hooks/useAgentPerformance";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP"
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

function humanizeStatus(value) {
  if (!value) {
    return "N/A";
  }

  return String(value)
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getBadgeClasses(value) {
  const normalized = String(value ?? "").toLowerCase();

  if (["completed", "delivered", "paid", "active"].includes(normalized)) {
    return "border-[#a5d6a7] bg-[#e8f5e9] text-[#2e7d32]";
  }

  if (["pending", "processing", "for_delivery", "partial"].includes(normalized)) {
    return "border-[#ffe082] bg-[#fff8e1] text-[#f57f17]";
  }

  if (["cancelled", "inactive"].includes(normalized)) {
    return "border-[#ef9a9a] bg-[#fff5f5] text-[#c62828]";
  }

  if (["pending_remittance"].includes(normalized)) {
    return "border-[#ffcc80] bg-[#fff3e0] text-[#e65100]";
  }

  if (["recorded_non_cash"].includes(normalized)) {
    return "border-[#bbdefb] bg-[#e3f2fd] text-[#1565c0]";
  }

  return "border-[#b0bec5] bg-[#f3f6f9] text-[#546e7a]";
}

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-sm border border-[#dce5ec] bg-white px-4 py-3 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
      <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#607d8b]">{label}</div>
      <div className="mt-2 text-[18px] font-extrabold tracking-[0.2px] text-[#1a3557]">{value}</div>
      {hint ? <div className="mt-1 text-[10px] text-[#90a4ae]">{hint}</div> : null}
    </div>
  );
}

function TableSection({ title, description, columns, rows, isLoading, emptyMessage, pagination }) {
  return (
    <section className="overflow-hidden rounded-sm border border-[#dce5ec] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <div className="border-b border-[#e8eef3] bg-[#f8fbfd] px-4 py-3">
        <div className="text-[13px] font-bold text-[#1a3557]">{title}</div>
        <div className="mt-0.5 text-[10px] text-[#607d8b]">{description}</div>
      </div>
      <div className="overflow-x-auto">
        <table className="erp-table w-full min-w-[760px]">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={column.className ?? ""}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableSkeleton rows={5}>
                {(index) => (
                  <tr key={`${title}-sk-${index}`}>
                    {columns.map((column) => (
                      <td key={`${column.key}-${index}`}>
                        <Skeleton className={`h-3 ${column.skeletonClass ?? "w-24"}`} />
                      </td>
                    ))}
                  </tr>
                )}
              </TableSkeleton>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-[11px] italic text-[#90a4ae]">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.key}>
                  {columns.map((column) => (
                    <td key={`${row.key}-${column.key}`} className={column.className ?? ""}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pagination ? <Pagination {...pagination} /> : null}
    </section>
  );
}

export function AgentHistoryPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [activeTab, setActiveTab] = useState("sales");
  const [salesPage, setSalesPage] = useState(1);
  const [collectionPage, setCollectionPage] = useState(1);
  const [remittancePage, setRemittancePage] = useState(1);
  const [salesSearch, setSalesSearch] = useState("");
  const [collectionSearch, setCollectionSearch] = useState("");
  const [remittanceSearch, setRemittanceSearch] = useState("");
  const [salesStatus, setSalesStatus] = useState("");

  const deferredSalesSearch = useDeferredValue(salesSearch.trim());
  const deferredCollectionSearch = useDeferredValue(collectionSearch.trim());
  const deferredRemittanceSearch = useDeferredValue(remittanceSearch.trim());

  const profileQuery = useAgentProfile(id);
  const salesQuery = useAgentSalesHistory(id, {
    page: salesPage,
    limit: 10,
    ...(deferredSalesSearch ? { search: deferredSalesSearch } : {}),
    ...(salesStatus ? { status: salesStatus } : {})
  });
  const collectionQuery = useAgentCollectionHistory(id, {
    page: collectionPage,
    limit: 10,
    ...(deferredCollectionSearch ? { search: deferredCollectionSearch } : {})
  });
  const remittanceQuery = useAgentRemittanceLedger(id, {
    page: remittancePage,
    limit: 10,
    ...(deferredRemittanceSearch ? { search: deferredRemittanceSearch } : {})
  });

  const agent = profileQuery.data?.data;
  const sales = salesQuery.data?.data;
  const collections = collectionQuery.data?.data;
  const remittance = remittanceQuery.data?.data;

  if (profileQuery.isError) {
    return (
      <section className="table-card erp-page-main-card-joined">
        <div className="px-4 py-10 text-[11px] text-[#c62828]">
          Failed to load agent profile.
        </div>
      </section>
    );
  }

  const activeError = activeTab === "sales"
    ? salesQuery.isError
    : activeTab === "collections"
      ? collectionQuery.isError
      : remittanceQuery.isError;
  if (activeError) {
    return (
      <section className="table-card erp-page-main-card-joined">
        <div className="px-4 py-10 text-[11px] text-[#c62828]">
          Failed to load agent history.
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="erp-page-section erp-page-section-joined">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/admin/agent-operations")}
              className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-[#4a7fa8] bg-transparent text-[#90caf9] transition-colors hover:bg-white/10"
            >
              <i className="fas fa-arrow-left text-[11px]" />
            </button>
            <i className="fas fa-user-tie text-[18px] text-[#90caf9]" />
            <div>
              <div className="erp-page-title">Agent Ledger</div>
              <div className="erp-page-description">Admin drilldown for one agent across sales, collections, and derived remittance entries.</div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 border-b border-[#d7e3ec] bg-[#fbfdff] px-4 py-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Agent"
            value={profileQuery.isLoading ? "Loading..." : agent?.fullName ?? "N/A"}
            hint={agent ? `${agent.agentCode} · ${agent.position ?? "Agent"}` : ""}
          />
          <StatCard
            label="Status"
            value={profileQuery.isLoading ? "Loading..." : humanizeStatus(agent?.status)}
            hint={agent?.dateHired ? `Hired ${formatDate(agent.dateHired)}` : "No hire date"}
          />
          <StatCard
            label="Phone"
            value={profileQuery.isLoading ? "Loading..." : agent?.phone || "N/A"}
            hint={agent?.email || "No email"}
          />
          <StatCard
            label="Current View"
            value={activeTab === "sales" ? "Sales History" : activeTab === "collections" ? "Collection History" : "Remittance Ledger"}
            hint={activeTab === "sales" ? "Order-level drilldown" : activeTab === "collections" ? "Allocation-level drilldown" : "Derived turnover review"}
          />
        </div>

        <div className="border-b border-[#d7e3ec] bg-white px-4 pt-3">
          <div className="flex flex-wrap gap-2">
            {[
              { key: "sales", label: "Sales History", icon: "fa-file-invoice-dollar" },
              { key: "collections", label: "Collection History", icon: "fa-hand-holding-dollar" },
              { key: "remittance", label: "Remittance Ledger", icon: "fa-money-bill-transfer" }
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 border-b-2 px-4 py-2 text-[12px] font-bold transition-colors ${
                  activeTab === tab.key
                    ? "border-[#0070b8] bg-[#e8f1f8] text-[#0070b8]"
                    : "border-transparent text-[#607d8b] hover:bg-[#f5f9fc] hover:text-[#1a3557]"
                }`}
              >
                <i className={`fas ${tab.icon} text-[11px]`} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "sales" ? (
          <div className="erp-page-filters">
            <div className="erp-filter-label">
              <i className="fas fa-filter mr-1" />
              Sales Filters
            </div>
            <div className="relative min-w-[240px] flex-1">
              <i className="fas fa-search pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
              <input
                type="text"
                value={salesSearch}
                onChange={(event) => {
                  setSalesSearch(event.target.value);
                  setSalesPage(1);
                }}
                placeholder="Search SO number or customer"
                className="erp-input pl-7"
              />
            </div>
            <div className="relative min-w-[160px]">
              <i className="fas fa-list pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
              <select
                value={salesStatus}
                onChange={(event) => {
                  setSalesStatus(event.target.value);
                  setSalesPage(1);
                }}
                className="erp-select pl-7"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="for_delivery">For Delivery</option>
                <option value="delivered">Delivered</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        ) : activeTab === "collections" ? (
          <div className="erp-page-filters">
            <div className="erp-filter-label">
              <i className="fas fa-filter mr-1" />
              Collection Filters
            </div>
            <div className="relative min-w-[240px] flex-1">
              <i className="fas fa-search pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
              <input
                type="text"
                value={collectionSearch}
                onChange={(event) => {
                  setCollectionSearch(event.target.value);
                  setCollectionPage(1);
                }}
                placeholder="Search payment, invoice, order, or customer"
                className="erp-input pl-7"
              />
            </div>
          </div>
        ) : (
          <div className="erp-page-filters">
            <div className="erp-filter-label">
              <i className="fas fa-filter mr-1" />
              Remittance Filters
            </div>
            <div className="relative min-w-[240px] flex-1">
              <i className="fas fa-search pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
              <input
                type="text"
                value={remittanceSearch}
                onChange={(event) => {
                  setRemittanceSearch(event.target.value);
                  setRemittancePage(1);
                }}
                placeholder="Search payment number, reference, or customer"
                className="erp-input pl-7"
              />
            </div>
          </div>
        )}
      </section>

      {activeTab === "sales" ? (
        <>
          <section className="table-card erp-page-main-card-joined">
            <div className="grid gap-3 border-b border-[#d7e3ec] bg-[#fbfdff] px-4 py-3 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Total Sales" value={formatCurrency(sales?.summary?.totalSales)} hint={`${sales?.summary?.totalOrders ?? 0} orders`} />
              <StatCard label="Pending Pipeline" value={String(sales?.summary?.pendingOrders ?? 0)} hint="Pending, processing, and for delivery" />
              <StatCard label="Completed Orders" value={String(sales?.summary?.completedOrders ?? 0)} hint="Delivered or completed" />
              <StatCard label="Invoiced Orders" value={String(sales?.summary?.invoicedOrders ?? 0)} hint="With linked invoice record" />
            </div>
          </section>

          <TableSection
            title="Sales Orders"
            description="Order-level history for this agent."
            isLoading={salesQuery.isLoading || salesQuery.isFetching}
            rows={(sales?.rows ?? []).map((row) => ({ ...row, key: `sales-${row.id}` }))}
            emptyMessage="No sales orders found for the current filters."
            columns={[
              { key: "date", label: "Order Date", render: (row) => formatDate(row.orderDate), skeletonClass: "w-20" },
              { key: "so", label: "SO Number", render: (row) => <span className="font-mono font-bold text-[#0070b8]">{row.salesOrderNumber}</span>, skeletonClass: "w-24" },
              { key: "customer", label: "Customer", render: (row) => <span className="font-bold text-[#1a3557]">{row.customer?.name ?? "N/A"}</span>, skeletonClass: "w-28" },
              { key: "items", label: "Items", className: "text-right", render: (row) => <span className="font-mono">{row.itemCount}</span>, skeletonClass: "ml-auto w-10" },
              { key: "amount", label: "Total Amount", className: "text-right", render: (row) => <span className="font-mono">{formatCurrency(row.totalAmount)}</span>, skeletonClass: "ml-auto w-20" },
              { key: "invoice", label: "Invoice", render: (row) => row.invoice ? <div><div className="font-mono text-[#1a3557]">{row.invoice.invoiceNumber}</div><div className="text-[10px] text-[#607d8b]">{humanizeStatus(row.invoice.status)}</div></div> : <span className="text-[#90a4ae]">Not invoiced</span>, skeletonClass: "w-24" },
              { key: "status", label: "Status", render: (row) => <span className={`inline-flex rounded-sm border px-2 py-0.5 text-[10px] font-bold ${getBadgeClasses(row.status)}`}>{humanizeStatus(row.status)}</span>, skeletonClass: "w-16" },
              { key: "action", label: "Action", render: (row) => <button type="button" onClick={() => navigate(`/sales-orders/${row.id}`)} className="rounded-sm border border-[#b0bec5] bg-white px-2 py-1 text-[10px] font-bold text-[#546e7a] transition-colors hover:border-[#0070b8] hover:bg-[#e8f1f8] hover:text-[#0070b8]">VIEW</button>, skeletonClass: "ml-auto w-12" }
            ]}
            pagination={{
              currentPage: sales?.pagination?.currentPage ?? 1,
              lastPage: sales?.pagination?.lastPage ?? 1,
              perPage: sales?.pagination?.perPage ?? 10,
              total: sales?.pagination?.total ?? 0,
              itemLabel: "orders",
              loading: salesQuery.isFetching,
              onPrevious: () => setSalesPage((page) => Math.max(1, page - 1)),
              onNext: () => setSalesPage((page) => Math.min(sales?.pagination?.lastPage ?? page, page + 1)),
              onGoto: setSalesPage
            }}
          />
        </>
      ) : activeTab === "collections" ? (
        <>
          <section className="table-card erp-page-main-card-joined">
            <div className="grid gap-3 border-b border-[#d7e3ec] bg-[#fbfdff] px-4 py-3 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Total Collected" value={formatCurrency(collections?.summary?.totalCollected)} hint={`${collections?.summary?.totalAllocations ?? 0} allocations`} />
              <StatCard label="Payments" value={String(collections?.summary?.paymentCount ?? 0)} hint="Unique payment records" />
              <StatCard label="Customers" value={String(collections?.summary?.customerCount ?? 0)} hint="Customers touched by allocations" />
              <StatCard label="Rows Loaded" value={String(collections?.rows?.length ?? 0)} hint="Current page size" />
            </div>
          </section>

          <TableSection
            title="Collection Allocations"
            description="Payment allocations linked to this agent's receivables."
            isLoading={collectionQuery.isLoading || collectionQuery.isFetching}
            rows={(collections?.rows ?? []).map((row) => ({ ...row, key: `collection-${row.id}` }))}
            emptyMessage="No collection allocations found for the current filters."
            columns={[
              { key: "paymentDate", label: "Payment Date", render: (row) => formatDate(row.payment?.paymentDate), skeletonClass: "w-20" },
              { key: "payment", label: "Payment", render: (row) => <div><div className="font-mono font-bold text-[#0070b8]">{row.payment?.paymentNumber ?? "N/A"}</div><div className="text-[10px] text-[#607d8b]">{humanizeStatus(row.payment?.paymentMethod)}</div></div>, skeletonClass: "w-24" },
              { key: "customer", label: "Customer", render: (row) => <span className="font-bold text-[#1a3557]">{row.customer?.name ?? "N/A"}</span>, skeletonClass: "w-28" },
              { key: "invoice", label: "Invoice", render: (row) => row.invoice?.invoiceNumber ?? "Opening Balance", skeletonClass: "w-20" },
              { key: "order", label: "Order", render: (row) => row.salesOrder?.salesOrderNumber ?? "N/A", skeletonClass: "w-20" },
              { key: "allocated", label: "Allocated", className: "text-right", render: (row) => <span className="font-mono text-[#2e7d32]">{formatCurrency(row.allocatedAmount)}</span>, skeletonClass: "ml-auto w-20" },
              { key: "outstanding", label: "Outstanding", className: "text-right", render: (row) => <span className="font-mono text-[#c62828]">{formatCurrency(row.receivable?.outstandingAmount)}</span>, skeletonClass: "ml-auto w-20" }
            ]}
            pagination={{
              currentPage: collections?.pagination?.currentPage ?? 1,
              lastPage: collections?.pagination?.lastPage ?? 1,
              perPage: collections?.pagination?.perPage ?? 10,
              total: collections?.pagination?.total ?? 0,
              itemLabel: "allocations",
              loading: collectionQuery.isFetching,
              onPrevious: () => setCollectionPage((page) => Math.max(1, page - 1)),
              onNext: () => setCollectionPage((page) => Math.min(collections?.pagination?.lastPage ?? page, page + 1)),
              onGoto: setCollectionPage
            }}
          />
        </>
      ) : (
        <>
          <section className="table-card erp-page-main-card-joined">
            <div className="grid gap-3 border-b border-[#d7e3ec] bg-[#fbfdff] px-4 py-3 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Recorded Collections" value={formatCurrency(remittance?.summary?.totalCollected)} hint={`${remittance?.summary?.totalAllocations ?? 0} allocations`} />
              <StatCard label="Non-Cash Recorded" value={formatCurrency(remittance?.summary?.nonCashRecorded)} hint="Cheque, bank transfer, and card" />
              <StatCard label="Cash Pending" value={formatCurrency(remittance?.summary?.cashPendingRemittance)} hint="Cash without deposit verification model" />
              <StatCard label="Remittance Gap" value={formatCurrency(remittance?.summary?.remittanceGap)} hint={`${remittance?.summary?.paymentCount ?? 0} payment records`} />
            </div>
          </section>

          <section className="overflow-hidden rounded-sm border border-[#dce5ec] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            <div className="border-b border-[#e8eef3] bg-[#f8fbfd] px-4 py-3">
              <div className="text-[13px] font-bold text-[#1a3557]">Ledger Assumption</div>
              <div className="mt-0.5 text-[10px] text-[#607d8b]">
                Cash is treated as pending remittance. Non-cash methods are treated as already recorded outside a deposit-verification workflow because no deposit model exists yet.
              </div>
            </div>
          </section>

          <TableSection
            title="Variance Breakdown"
            description="Daily view of recorded collections, non-cash captured, and cash still pending remittance."
            isLoading={remittanceQuery.isLoading || remittanceQuery.isFetching}
            rows={(remittance?.variance ?? []).map((row) => ({ ...row, key: `variance-${row.accountingPeriod}` }))}
            emptyMessage="No remittance variance rows found."
            columns={[
              { key: "period", label: "Accounting Period", render: (row) => row.accountingPeriod, skeletonClass: "w-24" },
              { key: "collected", label: "Collected", className: "text-right", render: (row) => <span className="font-mono">{formatCurrency(row.collected)}</span>, skeletonClass: "ml-auto w-20" },
              { key: "nonCash", label: "Non-Cash Recorded", className: "text-right", render: (row) => <span className="font-mono text-[#1565c0]">{formatCurrency(row.nonCashRecorded)}</span>, skeletonClass: "ml-auto w-20" },
              { key: "cashPending", label: "Cash Pending", className: "text-right", render: (row) => <span className="font-mono text-[#e65100]">{formatCurrency(row.cashPendingRemittance)}</span>, skeletonClass: "ml-auto w-20" },
              { key: "variance", label: "Variance", className: "text-right", render: (row) => <span className="font-mono text-[#c62828]">{formatCurrency(row.variance)}</span>, skeletonClass: "ml-auto w-20" }
            ]}
          />

          <TableSection
            title="Remittance Ledger Entries"
            description="Payment-level ledger grouped from allocations attached to this agent's receivables."
            isLoading={remittanceQuery.isLoading || remittanceQuery.isFetching}
            rows={(remittance?.rows ?? []).map((row) => ({ ...row, key: `remittance-${row.paymentId}` }))}
            emptyMessage="No remittance ledger entries found for the current filters."
            columns={[
              { key: "date", label: "Payment Date", render: (row) => formatDate(row.paymentDate), skeletonClass: "w-20" },
              { key: "payment", label: "Payment", render: (row) => <div><div className="font-mono font-bold text-[#0070b8]">{row.paymentNumber}</div><div className="text-[10px] text-[#607d8b]">{humanizeStatus(row.paymentMethod)}</div></div>, skeletonClass: "w-24" },
              { key: "reference", label: "Reference", render: (row) => row.referenceNumber || "N/A", skeletonClass: "w-20" },
              { key: "customers", label: "Customers", render: (row) => <div><div className="font-bold text-[#1a3557]">{row.customerCount}</div><div className="text-[10px] text-[#607d8b]">{row.customerNames.slice(0, 2).join(", ") || "N/A"}</div></div>, skeletonClass: "w-24" },
              { key: "collected", label: "Collected", className: "text-right", render: (row) => <span className="font-mono">{formatCurrency(row.collectedAmount)}</span>, skeletonClass: "ml-auto w-20" },
              { key: "nonCash", label: "Non-Cash", className: "text-right", render: (row) => <span className="font-mono text-[#1565c0]">{formatCurrency(row.nonCashAmount)}</span>, skeletonClass: "ml-auto w-20" },
              { key: "cash", label: "Cash Pending", className: "text-right", render: (row) => <span className="font-mono text-[#e65100]">{formatCurrency(row.cashAmount)}</span>, skeletonClass: "ml-auto w-20" },
              { key: "status", label: "Status", render: (row) => <span className={`inline-flex rounded-sm border px-2 py-0.5 text-[10px] font-bold ${getBadgeClasses(row.status)}`}>{humanizeStatus(row.status)}</span>, skeletonClass: "w-16" }
            ]}
            pagination={{
              currentPage: remittance?.pagination?.currentPage ?? 1,
              lastPage: remittance?.pagination?.lastPage ?? 1,
              perPage: remittance?.pagination?.perPage ?? 10,
              total: remittance?.pagination?.total ?? 0,
              itemLabel: "ledger entries",
              loading: remittanceQuery.isFetching,
              onPrevious: () => setRemittancePage((page) => Math.max(1, page - 1)),
              onNext: () => setRemittancePage((page) => Math.min(remittance?.pagination?.lastPage ?? page, page + 1)),
              onGoto: setRemittancePage
            }}
          />
        </>
      )}
    </div>
  );
}
