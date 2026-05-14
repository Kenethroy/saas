import { useDeferredValue, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pagination } from "@/shared/components/common/Pagination";
import { Skeleton, TableSkeleton } from "@/shared/components/common/Skeleton";
import { AgentMetricBars } from "../components/AgentMetricBars";
import { TrendLineChart } from "../components/TrendLineChart";
import {
  useAgentCollectionPerformance,
  useAgentCollectionQueue,
  useAgentCollectionTrend,
  useAgentRemittanceReview,
  useAgentSalesPerformance,
  useAgentSalesTrend
} from "../hooks/useAgentPerformance";

const MONTH_OPTIONS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" }
];

const QUARTER_OPTIONS = [
  { value: 1, label: "Q1 (Jan-Mar)" },
  { value: 2, label: "Q2 (Apr-Jun)" },
  { value: 3, label: "Q3 (Jul-Sep)" },
  { value: 4, label: "Q4 (Oct-Dec)" }
];

function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP"
  }).format(Number(value ?? 0));
}

function formatPercentage(value) {
  return `${Number(value ?? 0).toFixed(1)}%`;
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

function humanizeLabel(value) {
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

  if (["high", "overdue", "needs_review", "cancelled"].includes(normalized)) {
    return "border-[#ef9a9a] bg-[#fff5f5] text-[#c62828]";
  }

  if (["medium", "partial", "processing", "for_delivery"].includes(normalized)) {
    return "border-[#ffe082] bg-[#fff8e1] text-[#f57f17]";
  }

  if (["normal", "current", "recorded", "paid", "completed", "delivered"].includes(normalized)) {
    return "border-[#a5d6a7] bg-[#e8f5e9] text-[#2e7d32]";
  }

  return "border-[#bbdefb] bg-[#e3f2fd] text-[#1565c0]";
}

function TabButton({ active, icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 border-b-2 px-4 py-2 text-[12px] font-bold transition-colors ${
        active
          ? "border-[#0070b8] bg-[#e8f1f8] text-[#0070b8]"
          : "border-transparent text-[#607d8b] hover:bg-[#f5f9fc] hover:text-[#1a3557]"
      }`}
    >
      <i className={`fas ${icon} text-[11px]`} />
      {label}
    </button>
  );
}

function SummaryCards({ cards, isLoading }) {
  return (
    <section className="table-card erp-page-main-card-joined">
      <div className="grid gap-3 border-b border-[#d7e3ec] bg-[#fbfdff] px-4 py-3 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="erp-entity-card-panel">
            <div className="text-[10px] font-bold uppercase tracking-[0.4px] text-[#607d8b]">{card.label}</div>
            <div className="mt-1 text-[18px] font-bold text-[#1a3557]">
              {isLoading ? <Skeleton className="h-5 w-24" /> : card.value}
            </div>
            <div className="mt-1 text-[10px] text-[#607d8b]">{card.helper}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionTable({ title, subtitle, columns, rows, isLoading, emptyMessage, pagination }) {
  return (
    <section className="table-card erp-page-main-card-joined">
      <div className="border-b border-[#d7e3ec] bg-[#fbfdff] px-4 py-3">
        <div className="text-[12px] font-bold text-[#1a3557]">{title}</div>
        <div className="mt-1 text-[11px] text-[#607d8b]">{subtitle}</div>
      </div>
      <div className="overflow-x-auto">
        <table className="erp-table w-full min-w-[780px]">
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
                  <tr key={`${title}-loading-${index}`}>
                    {columns.map((column) => (
                      <td key={`${column.key}-${index}`}>
                        <Skeleton className={`h-3 ${column.skeletonClass ?? "w-20"}`} />
                      </td>
                    ))}
                  </tr>
                )}
              </TableSkeleton>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <div className="erp-empty-state">{emptyMessage}</div>
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

function ErrorState({ message }) {
  return (
    <section className="table-card erp-page-main-card-joined">
      <div className="px-4 py-10 text-[11px] text-[#c62828]">{message}</div>
    </section>
  );
}

function BucketPills({ buckets = {}, activeBucket, onChange }) {
  const pillConfig = [
    { key: "all", label: "All", value: Object.values(buckets).reduce((sum, count) => sum + Number(count ?? 0), 0) },
    { key: "current", label: "Current", value: buckets.current ?? 0 },
    { key: "1_30", label: "1-30", value: buckets["1_30"] ?? 0 },
    { key: "31_60", label: "31-60", value: buckets["31_60"] ?? 0 },
    { key: "61_90", label: "61-90", value: buckets["61_90"] ?? 0 },
    { key: "over_90", label: "90+", value: buckets.over_90 ?? 0 }
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {pillConfig.map((pill) => (
        <button
          key={pill.key}
          type="button"
          onClick={() => onChange(pill.key)}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.3px] transition-colors ${
            activeBucket === pill.key
              ? "border-[#0070b8] bg-[#e8f1f8] text-[#0070b8]"
              : "border-[#d7e3ec] bg-white text-[#607d8b] hover:border-[#90caf9] hover:text-[#1a3557]"
          }`}
        >
          <span>{pill.label}</span>
          <span className="rounded-full bg-black/5 px-1.5 py-0.5 font-mono text-[10px]">{pill.value}</span>
        </button>
      ))}
    </div>
  );
}

export function AgentPerformancePage() {
  const navigate = useNavigate();
  const now = new Date();

  const [activeTab, setActiveTab] = useState("queue");
  const [performanceTab, setPerformanceTab] = useState("sales");

  const [period, setPeriod] = useState("month");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [compareWith, setCompareWith] = useState("previous");
  const [performanceSearch, setPerformanceSearch] = useState("");

  const [queuePage, setQueuePage] = useState(1);
  const [queueBucket, setQueueBucket] = useState("all");
  const [queueSearch, setQueueSearch] = useState("");

  const [remittancePage, setRemittancePage] = useState(1);
  const [remittanceSearch, setRemittanceSearch] = useState("");

  const deferredPerformanceSearch = useDeferredValue(performanceSearch.trim());
  const deferredQueueSearch = useDeferredValue(queueSearch.trim());
  const deferredRemittanceSearch = useDeferredValue(remittanceSearch.trim());

  const performanceParams = {
    period,
    year,
    compareWith,
    ...(deferredPerformanceSearch ? { search: deferredPerformanceSearch } : {}),
    ...(period === "month" ? { month } : {}),
    ...(period === "quarter" ? { quarter } : {})
  };

  const queueQuery = useAgentCollectionQueue({
    page: queuePage,
    limit: 10,
    bucket: queueBucket,
    ...(deferredQueueSearch ? { search: deferredQueueSearch } : {})
  });
  const remittanceQuery = useAgentRemittanceReview({
    page: remittancePage,
    limit: 10,
    ...(deferredRemittanceSearch ? { search: deferredRemittanceSearch } : {})
  });
  const salesQuery = useAgentSalesPerformance(performanceParams);
  const salesTrendQuery = useAgentSalesTrend(performanceParams);
  const collectionsQuery = useAgentCollectionPerformance(performanceParams);
  const collectionsTrendQuery = useAgentCollectionTrend(performanceParams);

  const queue = queueQuery.data?.data;
  const remittance = remittanceQuery.data?.data;
  const sales = salesQuery.data?.data;
  const salesTrend = salesTrendQuery.data?.data;
  const collections = collectionsQuery.data?.data;
  const collectionsTrend = collectionsTrendQuery.data?.data;

  const availableYears = Array.from({ length: 6 }, (_, index) => now.getFullYear() - index);

  const performanceLoading = performanceTab === "sales"
    ? salesQuery.isLoading || salesTrendQuery.isLoading
    : collectionsQuery.isLoading || collectionsTrendQuery.isLoading;
  const performanceError = performanceTab === "sales"
    ? salesQuery.error ?? salesTrendQuery.error
    : collectionsQuery.error ?? collectionsTrendQuery.error;

  const salesSummary = sales?.summary ?? {};
  const collectionSummary = collections?.summary ?? {};
  const queueSummary = queue?.summary ?? {};
  const remittanceSummary = remittance?.summary ?? {};

  function renderCollectionQueue() {
    if (queueQuery.isError) {
      return <ErrorState message={`Failed to load collection queue${queueQuery.error?.message ? `: ${queueQuery.error.message}` : "."}`} />;
    }

    return (
      <>
        <SummaryCards
          isLoading={queueQuery.isLoading}
          cards={[
            {
              label: "Outstanding Balance",
              value: formatCurrency(queueSummary.totalOutstanding),
              helper: `${queueSummary.overdueAccounts ?? 0} overdue accounts`
            },
            {
              label: "Due Today / Current",
              value: String(queueSummary.accountsDueToday ?? 0),
              helper: "Accounts still inside current bucket"
            },
            {
              label: "High Priority",
              value: String(queueSummary.highPriorityAccounts ?? 0),
              helper: "Large or heavily overdue balances"
            },
            {
              label: "Active Agents",
              value: String(queueSummary.activeAgents ?? 0),
              helper: "Agents with accounts in queue"
            }
          ]}
        />

        <section className="table-card erp-page-main-card-joined">
          <div className="border-b border-[#d7e3ec] bg-white px-4 py-3">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="erp-page-filters border-b border-[#d7e3ec]">
                <div className="relative min-w-[400px] flex-1 md:max-w-[520px]">
                  <i className="fas fa-search pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
                  <input
                    type="text"
                    value={queueSearch}
                    onChange={(event) => {
                      setQueueSearch(event.target.value);
                      setQueuePage(1);
                    }}
                    placeholder="Search agent, customer, invoice, or sales order"
                    className="erp-input pl-7"
                  />
                </div>
              </div>
              <BucketPills
                buckets={queue?.buckets}
                activeBucket={queueBucket}
                onChange={(value) => {
                  setQueueBucket(value);
                  setQueuePage(1);
                }}
              />
            </div>
          </div>
        </section>

        <SectionTable
          title="Accounts to Follow Up"
          subtitle="Sorted by priority, days overdue, then remaining balance."
          isLoading={queueQuery.isLoading}
          rows={(queue?.rows ?? []).map((item) => ({ ...item, key: `queue-${item.id}` }))}
          emptyMessage="No receivables matched the current queue filters."
          pagination={queue?.pagination ? {
            ...queue.pagination,
            itemLabel: "accounts",
            loading: queueQuery.isFetching,
            onPrevious: () => setQueuePage((page) => Math.max(page - 1, 1)),
            onNext: () => setQueuePage((page) => Math.min(page + 1, queue.pagination.lastPage)),
            onGoto: (page) => setQueuePage(page)
          } : null}
          columns={[
            {
              key: "agent",
              label: "Agent",
              render: (row) => (
                <div>
                  <div className="font-bold text-[#1a3557]">{row.agentName}</div>
                  <div className="text-[11px] text-[#607d8b]">{row.agentCode}</div>
                </div>
              ),
              skeletonClass: "w-24"
            },
            {
              key: "customer",
              label: "Customer / Ref",
              render: (row) => (
                <div>
                  <div className="font-bold text-[#1a3557]">{row.customerName}</div>
                  <div className="text-[11px] text-[#607d8b]">
                    {row.invoiceNumber}
                    {row.salesOrderNumber ? ` · ${row.salesOrderNumber}` : ""}
                  </div>
                </div>
              ),
              skeletonClass: "w-28"
            },
            {
              key: "dates",
              label: "Due Status",
              render: (row) => (
                <div>
                  <div className="font-medium text-[#1a3557]">{formatDate(row.dueDate)}</div>
                  <div className="text-[11px] text-[#607d8b]">{row.daysOverdue > 0 ? `${row.daysOverdue} days overdue` : "Current / due today"}</div>
                </div>
              ),
              skeletonClass: "w-24"
            },
            {
              key: "outstanding",
              label: "Outstanding",
              className: "text-right",
              render: (row) => <span className="font-mono text-[#c62828]">{formatCurrency(row.outstandingAmount)}</span>,
              skeletonClass: "ml-auto w-20"
            },
            {
              key: "priority",
              label: "Priority",
              className: "text-center",
              render: (row) => (
                <div className="space-y-1">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${getBadgeClasses(row.priority)}`}>
                    {humanizeLabel(row.priority)}
                  </span>
                  <div className="text-[10px] text-[#607d8b]">{humanizeLabel(row.agingBucket)}</div>
                </div>
              ),
              skeletonClass: "mx-auto w-16"
            },
            {
              key: "latest",
              label: "Last Payment",
              render: (row) => (
                <div>
                  <div className="font-medium text-[#1a3557]">{formatDate(row.lastPaymentDate)}</div>
                  <div className="text-[10px] text-[#607d8b]">{row.recommendedAction}</div>
                </div>
              ),
              skeletonClass: "w-20"
            },
            {
              key: "action",
              label: "Action",
              className: "text-center",
              render: (row) => (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/agent-operations/agents/${row.agentId}/history`)}
                    className="rounded-sm border border-[#b0bec5] bg-white px-2 py-1 text-[10px] font-bold text-[#546e7a] transition-colors hover:border-[#0070b8] hover:bg-[#e8f1f8] hover:text-[#0070b8]"
                  >
                    LEDGER
                  </button>
                  {row.salesOrderId ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/sales-orders/${row.salesOrderId}`)}
                      className="rounded-sm border border-[#b0bec5] bg-white px-2 py-1 text-[10px] font-bold text-[#546e7a] transition-colors hover:border-[#0070b8] hover:bg-[#e8f1f8] hover:text-[#0070b8]"
                    >
                      ORDER
                    </button>
                  ) : null}
                </div>
              ),
              skeletonClass: "mx-auto w-20"
            }
          ]}
        />
      </>
    );
  }

  function renderRemittanceReview() {
    if (remittanceQuery.isError) {
      return <ErrorState message={`Failed to load remittance review${remittanceQuery.error?.message ? `: ${remittanceQuery.error.message}` : "."}`} />;
    }

    return (
      <>
        <SummaryCards
          isLoading={remittanceQuery.isLoading}
          cards={[
            {
              label: "Collected Total",
              value: formatCurrency(remittanceSummary.totalCollected),
              helper: `${remittanceSummary.agentsInScope ?? 0} agents in scope`
            },
            {
              label: "Non-Cash Recorded",
              value: formatCurrency(remittanceSummary.nonCashRecorded),
              helper: "Cheque, transfer, and card allocations"
            },
            {
              label: "Cash Pending",
              value: formatCurrency(remittanceSummary.cashPendingRemittance),
              helper: "Derived from payment method"
            },
            {
              label: "Review Gap",
              value: formatCurrency(remittanceSummary.remittanceGap),
              helper: "Same as cash pending until a real remittance workflow exists"
            }
          ]}
        />

        <section className="table-card erp-page-main-card-joined">
          <div className="border-b border-[#d7e3ec] bg-white px-4 py-3">
            <div className="text-[12px] font-bold text-[#1a3557]">Remittance Review</div>
            <div className="mt-1 text-[11px] text-[#607d8b]">Admin review only. These figures are still derived from collection allocations and payment methods, not from a dedicated deposit-verification table.</div>
          </div>

          <div className="erp-page-filters border-b border-[#d7e3ec]">
            <div className="erp-filter-label">
              <i className="fas fa-money-bill-transfer mr-1" />
              Review Filters
            </div>

            <div className="relative min-w-[260px] flex-1">
              <i className="fas fa-search pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
              <input
                type="text"
                value={remittanceSearch}
                onChange={(event) => {
                  setRemittanceSearch(event.target.value);
                  setRemittancePage(1);
                }}
                placeholder="Search agent, customer, payment reference, or invoice"
                className="erp-input pl-7"
              />
            </div>
          </div>
        </section>

        <SectionTable
          title="Agent Remittance Exposure"
          subtitle="Use this to review where cash still needs formal turnover or a future deposit-verification workflow."
          isLoading={remittanceQuery.isLoading}
          rows={(remittance?.rows ?? []).map((item) => ({ ...item, key: `remittance-${item.agentId}` }))}
          emptyMessage="No remittance review records matched the current filters."
          pagination={remittance?.pagination ? {
            ...remittance.pagination,
            itemLabel: "agents",
            loading: remittanceQuery.isFetching,
            onPrevious: () => setRemittancePage((page) => Math.max(page - 1, 1)),
            onNext: () => setRemittancePage((page) => Math.min(page + 1, remittance.pagination.lastPage)),
            onGoto: (page) => setRemittancePage(page)
          } : null}
          columns={[
            {
              key: "agent",
              label: "Agent",
              render: (row) => (
                <div>
                  <div className="font-bold text-[#1a3557]">{row.agentName}</div>
                  <div className="text-[11px] text-[#607d8b]">{row.agentCode}</div>
                </div>
              ),
              skeletonClass: "w-24"
            },
            {
              key: "collected",
              label: "Collected",
              className: "text-right",
              render: (row) => <span className="font-mono">{formatCurrency(row.totalCollected)}</span>,
              skeletonClass: "ml-auto w-20"
            },
            {
              key: "non-cash",
              label: "Non-Cash",
              className: "text-right",
              render: (row) => <span className="font-mono text-[#1565c0]">{formatCurrency(row.nonCashRecorded)}</span>,
              skeletonClass: "ml-auto w-20"
            },
            {
              key: "cash",
              label: "Cash Pending",
              className: "text-right",
              render: (row) => <span className="font-mono text-[#e65100]">{formatCurrency(row.cashPendingRemittance)}</span>,
              skeletonClass: "ml-auto w-20"
            },
            {
              key: "gap",
              label: "Review Gap",
              className: "text-right",
              render: (row) => <span className="font-mono text-[#c62828]">{formatCurrency(row.remittanceGap)}</span>,
              skeletonClass: "ml-auto w-20"
            },
            {
              key: "counts",
              label: "Coverage",
              render: (row) => (
                <div className="text-[11px] text-[#607d8b]">
                  <div>{row.paymentCount} payments</div>
                  <div>{row.customerCount} customers</div>
                  <div>{row.allocationCount} allocations</div>
                </div>
              ),
              skeletonClass: "w-20"
            },
            {
              key: "status",
              label: "Status",
              className: "text-center",
              render: (row) => (
                <div className="space-y-1">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${getBadgeClasses(row.status)}`}>
                    {humanizeLabel(row.status)}
                  </span>
                  <div className="text-[10px] text-[#607d8b]">{formatDate(row.latestPaymentDate)}</div>
                </div>
              ),
              skeletonClass: "mx-auto w-16"
            },
            {
              key: "action",
              label: "Action",
              className: "text-center",
              render: (row) => (
                <button
                  type="button"
                  onClick={() => navigate(`/admin/agent-operations/agents/${row.agentId}/history`)}
                  className="rounded-sm border border-[#b0bec5] bg-white px-2 py-1 text-[10px] font-bold text-[#546e7a] transition-colors hover:border-[#0070b8] hover:bg-[#e8f1f8] hover:text-[#0070b8]"
                >
                  LEDGER
                </button>
              ),
              skeletonClass: "mx-auto w-14"
            }
          ]}
        />
      </>
    );
  }

  function renderPerformance() {
    if ((performanceTab === "sales" && (salesQuery.isError || salesTrendQuery.isError))
      || (performanceTab === "collection" && (collectionsQuery.isError || collectionsTrendQuery.isError))) {
      return <ErrorState message={`Failed to load performance data${performanceError?.message ? `: ${performanceError.message}` : "."}`} />;
    }

    return (
      <>
        <section className="table-card erp-page-main-card-joined">
          <div className="border-b border-[#d7e3ec] bg-white px-4 pt-3">
            <div className="flex flex-wrap gap-2">
              <TabButton active={performanceTab === "sales"} icon="fa-shopping-cart" label="Sales Performance" onClick={() => setPerformanceTab("sales")} />
              <TabButton active={performanceTab === "collection"} icon="fa-hand-holding-dollar" label="Collection Performance" onClick={() => setPerformanceTab("collection")} />
            </div>
          </div>

          <div className="erp-page-filters">
            <div className="erp-filter-label">
              <i className="fas fa-filter mr-1" />
              Performance Filters
            </div>

            <div className="relative min-w-[150px]">
              <i className="fas fa-layer-group pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
              <select value={period} onChange={(event) => setPeriod(event.target.value)} className="erp-select pl-7">
                <option value="month">Monthly View</option>
                <option value="quarter">Quarterly View</option>
                <option value="year">Yearly View</option>
              </select>
            </div>

            {period === "month" ? (
              <div className="relative min-w-[170px]">
                <i className="fas fa-calendar-alt pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
                <select value={month} onChange={(event) => setMonth(Number(event.target.value))} className="erp-select pl-7">
                  {MONTH_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            ) : null}

            {period === "quarter" ? (
              <div className="relative min-w-[170px]">
                <i className="fas fa-calendar-alt pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
                <select value={quarter} onChange={(event) => setQuarter(Number(event.target.value))} className="erp-select pl-7">
                  {QUARTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="relative min-w-[120px]">
              <i className="fas fa-calendar pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
              <select value={year} onChange={(event) => setYear(Number(event.target.value))} className="erp-select pl-7">
                {availableYears.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            {performanceTab === "sales" ? (
              <div className="relative min-w-[190px]">
                <i className="fas fa-scale-balanced pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
                <select value={compareWith} onChange={(event) => setCompareWith(event.target.value)} className="erp-select pl-7">
                  <option value="previous">vs Previous Period</option>
                  <option value="year_ago">vs Last Year</option>
                  <option value="none">No Comparison</option>
                </select>
              </div>
            ) : null}

            <div className="relative min-w-[220px] flex-1">
              <i className="fas fa-search pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
              <input
                type="text"
                value={performanceSearch}
                onChange={(event) => setPerformanceSearch(event.target.value)}
                placeholder="Search agent name"
                className="erp-input pl-7"
              />
            </div>
          </div>
        </section>

        {performanceTab === "sales" ? (
          <>
            <SummaryCards
              isLoading={performanceLoading}
              cards={[
                {
                  label: "Total Revenue",
                  value: formatCurrency(salesSummary.totalRevenue),
                  helper: `${salesSummary.totalOrders ?? 0} invoices in period`
                },
                {
                  label: "Previous Revenue",
                  value: formatCurrency(salesSummary.previousRevenue),
                  helper: "Comparison baseline"
                },
                {
                  label: "Revenue Change",
                  value: formatPercentage(salesSummary.revenueChange),
                  helper: `${salesSummary.activeAgents ?? 0} active agents`
                },
                {
                  label: "Top Performer",
                  value: salesSummary.topPerformerName ?? "N/A",
                  helper: formatCurrency(salesSummary.topPerformerRevenue)
                }
              ]}
            />

            <div className="grid gap-4 xl:grid-cols-2">
              <TrendLineChart
                title="Revenue Trend"
                description="Current period revenue versus the selected comparison baseline."
                points={salesTrend?.points ?? []}
                series={[
                  { key: "currentRevenue", label: "Current Revenue", color: "#0070b8" },
                  { key: "previousRevenue", label: "Comparison Revenue", color: "#90a4ae" }
                ]}
              />

              <AgentMetricBars
                title="Top Agents by Revenue"
                description="Highest revenue agents in the selected period, with baseline context alongside each row."
                rows={sales?.ranking ?? []}
                series={[
                  { key: "totalRevenue", label: "Current Revenue", color: "#0070b8" },
                  { key: "previousRevenue", label: "Comparison Revenue", color: "#90a4ae" }
                ]}
                metaRenderer={(row) => (
                  <>
                    <div>{row.orderCount} invoices</div>
                    <div>{row.customerCount} customers</div>
                  </>
                )}
              />
            </div>

            <SectionTable
              title="Sales Ranking"
              subtitle="Revenue, invoice count, and customer reach by agent."
              isLoading={performanceLoading}
              rows={(sales?.ranking ?? []).map((item) => ({ ...item, key: `sales-${item.agentId}` }))}
              emptyMessage="No sales performance records found for the current filters."
              columns={[
                { key: "agent", label: "Agent", render: (row) => <div><div className="font-bold text-[#1a3557]">{row.agentName}</div><div className="text-[11px] text-[#607d8b]">{row.agentCode}</div></div>, skeletonClass: "w-28" },
                { key: "revenue", label: "Revenue", className: "text-right", render: (row) => <span className="font-mono">{formatCurrency(row.totalRevenue)}</span>, skeletonClass: "ml-auto w-20" },
                { key: "previous", label: "Previous", className: "text-right", render: (row) => <span className="font-mono text-[#607d8b]">{formatCurrency(row.previousRevenue)}</span>, skeletonClass: "ml-auto w-20" },
                { key: "growth", label: "Growth", className: "text-right", render: (row) => <span className={row.growth >= 0 ? "text-[#2e7d32]" : "text-[#c62828]"}>{formatPercentage(row.growth)}</span>, skeletonClass: "ml-auto w-12" },
                { key: "orders", label: "Invoices", className: "text-right", render: (row) => <span className="font-mono">{row.orderCount}</span>, skeletonClass: "ml-auto w-10" },
                { key: "customers", label: "Customers", className: "text-right", render: (row) => <span className="font-mono">{row.customerCount}</span>, skeletonClass: "ml-auto w-10" },
                { key: "action", label: "Action", className: "text-center", render: (row) => <button type="button" onClick={() => navigate(`/admin/agent-operations/agents/${row.agentId}/history`)} className="rounded-sm border border-[#b0bec5] bg-white px-2 py-1 text-[10px] font-bold text-[#546e7a] transition-colors hover:border-[#0070b8] hover:bg-[#e8f1f8] hover:text-[#0070b8]">LEDGER</button>, skeletonClass: "mx-auto w-14" }
              ]}
            />
          </>
        ) : (
          <>
            <SummaryCards
              isLoading={performanceLoading}
              cards={[
                {
                  label: "Total Collected",
                  value: formatCurrency(collectionSummary.totalCollected),
                  helper: `${collectionSummary.totalTransactions ?? 0} receivable records`
                },
                {
                  label: "Outstanding",
                  value: formatCurrency(collectionSummary.totalOutstanding),
                  helper: formatCurrency(collectionSummary.totalSales)
                },
                {
                  label: "Collection Rate",
                  value: formatPercentage(collectionSummary.collectionRate),
                  helper: `${collectionSummary.agentsWithCollections ?? 0} agents with collections`
                },
                {
                  label: "Sales Base",
                  value: formatCurrency(collectionSummary.totalSales),
                  helper: "Receivable amount in scope"
                }
              ]}
            />

            <div className="grid gap-4 xl:grid-cols-2">
              <TrendLineChart
                title="Collection Trend"
                description="Sales, collected amount, and outstanding balance across the selected timeline."
                points={collectionsTrend?.points ?? []}
                series={[
                  { key: "totalSales", label: "Sales Base", color: "#1565c0" },
                  { key: "totalCollected", label: "Collected", color: "#2e7d32" },
                  { key: "totalOutstanding", label: "Outstanding", color: "#c62828" }
                ]}
              />

              <AgentMetricBars
                title="Collection Efficiency by Agent"
                description="Side-by-side sales base and collected amount, with outstanding and rate kept in view."
                rows={collections?.ranking ?? []}
                series={[
                  { key: "totalSales", label: "Sales Base", color: "#1565c0" },
                  { key: "totalCollected", label: "Collected", color: "#2e7d32" }
                ]}
                metaRenderer={(row) => (
                  <>
                    <div>{formatPercentage(row.collectionRate)} rate</div>
                    <div>{formatCurrency(row.totalOutstanding)} outstanding</div>
                  </>
                )}
              />
            </div>

            <SectionTable
              title="Collection Ranking"
              subtitle="Collected amount, outstanding balance, and collection rate by agent."
              isLoading={performanceLoading}
              rows={(collections?.ranking ?? []).map((item) => ({ ...item, key: `collection-${item.agentId}` }))}
              emptyMessage="No collection performance records found for the current filters."
              columns={[
                { key: "agent", label: "Agent", render: (row) => <div><div className="font-bold text-[#1a3557]">{row.agentName}</div><div className="text-[11px] text-[#607d8b]">{row.agentCode}</div></div>, skeletonClass: "w-28" },
                { key: "sales", label: "Sales Base", className: "text-right", render: (row) => <span className="font-mono">{formatCurrency(row.totalSales)}</span>, skeletonClass: "ml-auto w-20" },
                { key: "collected", label: "Collected", className: "text-right", render: (row) => <span className="font-mono text-[#2e7d32]">{formatCurrency(row.totalCollected)}</span>, skeletonClass: "ml-auto w-20" },
                { key: "outstanding", label: "Outstanding", className: "text-right", render: (row) => <span className="font-mono text-[#c62828]">{formatCurrency(row.totalOutstanding)}</span>, skeletonClass: "ml-auto w-20" },
                { key: "rate", label: "Rate", className: "text-right", render: (row) => <span>{formatPercentage(row.collectionRate)}</span>, skeletonClass: "ml-auto w-12" },
                { key: "transactions", label: "Records", className: "text-right", render: (row) => <span className="font-mono">{row.transactionCount}</span>, skeletonClass: "ml-auto w-10" },
                { key: "action", label: "Action", className: "text-center", render: (row) => <button type="button" onClick={() => navigate(`/admin/agent-operations/agents/${row.agentId}/history`)} className="rounded-sm border border-[#b0bec5] bg-white px-2 py-1 text-[10px] font-bold text-[#546e7a] transition-colors hover:border-[#0070b8] hover:bg-[#e8f1f8] hover:text-[#0070b8]">LEDGER</button>, skeletonClass: "mx-auto w-14" }
              ]}
            />
          </>
        )}
      </>
    );
  }

  return (
    <div className="space-y-4">
      <section className="erp-page-section erp-page-section-joined">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <i className="fas fa-clipboard-check text-[18px] text-[#90caf9]" />
            <div>
              <div className="erp-page-title">Agent Operations</div>
              <div className="erp-page-description">Admin-only review for collection queue, remittance exposure, and performance. No separate agent-facing access is exposed in the current system.</div>
            </div>
          </div>
        </div>

        <div className="border-b border-[#d7e3ec] bg-white px-4 pt-3">
          <div className="flex flex-wrap gap-2">
            <TabButton active={activeTab === "queue"} icon="fa-list-check" label="Collection Queue" onClick={() => setActiveTab("queue")} />
            <TabButton active={activeTab === "remittance"} icon="fa-money-bill-transfer" label="Remittance Review" onClick={() => setActiveTab("remittance")} />
            <TabButton active={activeTab === "performance"} icon="fa-chart-bar" label="Performance" onClick={() => setActiveTab("performance")} />
          </div>
        </div>
      </section>

      {activeTab === "queue" ? renderCollectionQueue() : null}
      {activeTab === "remittance" ? renderRemittanceReview() : null}
      {activeTab === "performance" ? renderPerformance() : null}
    </div>
  );
}
