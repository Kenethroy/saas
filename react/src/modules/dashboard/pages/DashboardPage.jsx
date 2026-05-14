import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Skeleton, TableSkeleton } from "@/shared/components/common/Skeleton";
import { DashboardAgentChart } from "../components/DashboardAgentChart";
import { DashboardReceivablesCalendar } from "../components/DashboardReceivablesCalendar";
import { DashboardTrendChart } from "../components/DashboardTrendChart";
import { useDashboardOverview, useDashboardReceivablesCalendar } from "../hooks/useDashboard";

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

const SHORTCUT_ITEMS = [
  {
    label: "Accounts Receivable",
    note: "Review balances and invoice exposure.",
    icon: "fa-money-bill-wave",
    route: "/accounts-receivable",
    iconClass: "bg-[#dff2ea] text-[#0f766e]"
  },
  {
    label: "Agent Operations",
    note: "Open the collection and remittance queue.",
    icon: "fa-clipboard-check",
    route: "/admin/agent-operations",
    iconClass: "bg-[#e6eefc] text-[#1d4ed8]"
  },
  {
    label: "Inventory Overview",
    note: "Follow up low and out-of-stock variants.",
    icon: "fa-warehouse",
    route: "/inventory",
    iconClass: "bg-[#fff1dd] text-[#b45309]"
  },
  {
    label: "Profit and Loss",
    note: "Open the detailed financial result.",
    icon: "fa-chart-pie",
    route: "/reports/profit-and-loss",
    iconClass: "bg-[#f2e9ff] text-[#7c3aed]"
  }
];

function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP"
  }).format(Number(value ?? 0));
}

function formatCompactCurrency(value) {
  const numeric = Number(value ?? 0);

  if (Math.abs(numeric) >= 1000000) {
    return `₱${(numeric / 1000000).toFixed(1)}M`;
  }

  if (Math.abs(numeric) >= 1000) {
    return `₱${(numeric / 1000).toFixed(0)}K`;
  }

  return formatCurrency(numeric);
}

function formatCompactCurrencyPrecise(value) {
  const numeric = Number(value ?? 0);
  const symbol = "\u20b1";

  if (Math.abs(numeric) >= 1000000) {
    const formatted = (numeric / 1000000).toFixed(1).replace(/\.0$/, "");
    return `${symbol}${formatted}M`;
  }

  if (Math.abs(numeric) >= 1000) {
    const formatted = (numeric / 1000).toFixed(1).replace(/\.0$/, "");
    return `${symbol}${formatted}K`;
  }

  return formatCurrency(numeric);
}

function formatWholeNumber(value) {
  return new Intl.NumberFormat("en-PH").format(Number(value ?? 0));
}

function formatPercent(value) {
  if (value == null || Number.isNaN(value)) {
    return "0%";
  }

  return `${Math.round(value)}%`;
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

  if (["high", "out_of_stock"].includes(normalized)) {
    return "border-[#ef9a9a] bg-[#fff5f5] text-[#c62828]";
  }

  if (["medium", "low_stock"].includes(normalized)) {
    return "border-[#ffe082] bg-[#fff8e1] text-[#f57f17]";
  }

  return "border-[#a5d6a7] bg-[#e8f5e9] text-[#2e7d32]";
}

function PanelHeader({ eyebrow, title, subtitle, meta }) {
  return (
    <div className="flex flex-col gap-3 border-b border-[#deebf2] bg-[linear-gradient(180deg,#fcfeff_0%,#f4f8fb_100%)] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#6c88a1]">{eyebrow}</div>
        ) : null}
        <div className="mt-1 text-[15px] font-bold tracking-[0.01em] text-[#17324d]">{title}</div>
        {subtitle ? <div className="mt-1 text-[12px] text-[#5f7488]">{subtitle}</div> : null}
      </div>

      {meta ? (
        <div className="inline-flex items-center rounded-full border border-[#d7e4ec] bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#60798e]">
          {meta}
        </div>
      ) : null}
    </div>
  );
}

function ExecutiveHero({
  month,
  setMonth,
  year,
  setYear,
  availableYears,
  summaryCards,
  isLoading,
  isFetching
}) {
  const selectedMonthLabel = MONTH_OPTIONS.find((option) => option.value === month)?.label ?? "";

  return (
    <section className="overflow-hidden rounded-[24px] border border-[#d7e3ec] bg-[radial-gradient(circle_at_top_right,rgba(144,202,249,0.18),transparent_24%),linear-gradient(180deg,#ffffff_0%,#f4f8fb_100%)] shadow-[0_18px_46px_rgba(17,40,63,0.08)]">
      <div className="grid items-start gap-6 px-5 py-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,360px)] lg:px-6 lg:py-6">
        <div className="min-w-0 space-y-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#d8e5ee] bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#5f7b93]">
              <i className="fas fa-chart-line text-[11px] text-[#0070b8]" />
              Executive Dashboard
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="text-[26px] font-bold tracking-[-0.02em] text-[#17324d] sm:text-[32px]">
                {selectedMonthLabel} {year} snapshot
              </div>
              <div className="inline-flex items-center rounded-full border border-[#d8e5ee] bg-[#eef6fb] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#44657e]">
                {isFetching ? "Refreshing" : "Live Overview"}
              </div>
            </div>

            <div className="mt-2 max-w-[720px] text-[13px] text-[#607d8b] sm:text-[14px]">
              Sales, cash movement, receivable pressure, and stock risk in one business view.
            </div>
          </div>

          <div>
            <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#6c88a1]">Key Performance Indicators</div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {summaryCards.map((card) => (
                <article
                  key={card.label}
                  className="overflow-hidden rounded-[18px] border border-[#dce7ee] bg-white px-4 py-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#6f869b]">{card.label}</div>
                      <div className="mt-1 text-[11px] text-[#607d8b]">{card.helper}</div>
                    </div>
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-[#dde8f0] bg-[#eef6fb] text-[#0070b8]">
                      <i className={`fas ${card.icon} text-[14px]`} />
                    </span>
                  </div>

                  <div className="mt-5 text-[24px] font-bold tracking-[-0.03em] text-[#17324d]">
                    {isLoading ? <Skeleton className="h-7 w-28" /> : card.value}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 rounded-[14px] border border-[#e3ebf1] bg-[#f8fbfd] px-3 py-2 text-[11px]">
                    <span className="text-[#607d8b]">{card.secondaryLabel}</span>
                    <span className="font-bold text-[#17324d]">
                      {isLoading ? <Skeleton className="h-3 w-16" /> : card.secondaryValue}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[22px] border border-[#dce7ee] bg-white p-4 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#6c88a1]">Reporting Scope</div>
          <div className="mt-2 text-[18px] font-bold text-[#17324d]">Set the month and year</div>
          <div className="mt-1 text-[12px] text-[#607d8b]">Cards and rankings follow this scope. Trend keeps the full selected year.</div>

          <div className="mt-4 grid gap-3">
            <div className="relative">
              <i className="fas fa-calendar-alt pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-[#7192aa]" />
              <select value={month} onChange={(event) => setMonth(Number(event.target.value))} className="erp-select h-11 rounded-[14px] border-0 bg-white pl-9 text-[13px] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                {MONTH_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div className="relative">
              <i className="fas fa-calendar pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-[#7192aa]" />
              <select value={year} onChange={(event) => setYear(Number(event.target.value))} className="erp-select h-11 rounded-[14px] border-0 bg-white pl-9 text-[13px] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                {availableYears.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            {[
              { icon: "fa-chart-area", label: "Trend", note: "Full-year sales and collections line." },
              { icon: "fa-calendar-days", label: "Calendar", note: "Receivable due dates stay on their own month navigator." }
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3 rounded-[16px] border border-[#e3ebf1] bg-[#f8fbfd] px-3 py-3 text-[#607d8b]">
                <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#e8f1f8] text-[12px] text-[#0070b8]">
                  <i className={`fas ${item.icon}`} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-[#17324d]">{item.label}</span>
                  <span className="mt-1 block text-[11px] text-[#607d8b]">{item.note}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function AlertPanel({ title, subtitle, rows, isLoading, emptyMessage, renderRow, footer, meta }) {
  return (
    <section className="table-card self-start overflow-hidden rounded-[22px] border-[#d7e3ec] shadow-[0_12px_36px_rgba(26,53,87,0.07)]">
      <PanelHeader eyebrow="Priority List" title={title} subtitle={subtitle} meta={meta} />

      {isLoading ? (
        <div className="space-y-3 px-5 py-5">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={`alert-sk-${index}`} className="rounded-[18px] border border-[#dce5ec] bg-white px-4 py-4">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="mt-3 h-3 w-48" />
              <Skeleton className="mt-3 h-3 w-24" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="erp-empty-state">{emptyMessage}</div>
      ) : (
        <div className="space-y-3 px-5 py-5">
          {rows.map(renderRow)}
        </div>
      )}

      {footer ? (
        <div className="border-t border-[#e7eff4] bg-[#f8fbfd] px-5 py-3 text-[11px] font-medium text-[#607d8b]">
          {footer}
        </div>
      ) : null}
    </section>
  );
}

function RankingTable({ title, subtitle, rows, columns, isLoading, emptyMessage, meta }) {
  return (
    <section className="table-card self-start overflow-hidden rounded-[22px] border-[#d7e3ec] shadow-[0_12px_36px_rgba(26,53,87,0.07)]">
      <PanelHeader eyebrow="Ranking" title={title} subtitle={subtitle} meta={meta} />

      <div className="overflow-x-auto">
        <table className="erp-table w-full min-w-[420px]">
          <thead>
            <tr>
              <th className="w-[64px]">Rank</th>
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
                    <td>
                      <Skeleton className="h-6 w-8" />
                    </td>
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
                <td colSpan={columns.length + 1}>
                  <div className="erp-empty-state">{emptyMessage}</div>
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.key}>
                  <td>
                    <span className="inline-flex min-w-[34px] items-center justify-center rounded-full border border-[#cfdbe4] bg-white px-2 py-1 text-[10px] font-bold text-[#17324d]">
                      #{index + 1}
                    </span>
                  </td>
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
    </section>
  );
}

function OperationalShortcuts({ navigate, isFetching }) {
  return (
    <section className="table-card self-start overflow-hidden rounded-[22px] border-[#d7e3ec] shadow-[0_12px_36px_rgba(26,53,87,0.07)]">
      <PanelHeader
        eyebrow="Workflow"
        title="Operational Shortcuts"
        subtitle="Jump directly into the modules most likely to need action."
        meta={isFetching ? "Refreshing" : "Ready"}
      />

      <div className="grid gap-3 px-5 py-5 md:grid-cols-2 xl:grid-cols-1">
        {SHORTCUT_ITEMS.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => navigate(item.route)}
            className="group flex items-start gap-4 rounded-[18px] border border-[#dce5ec] bg-[linear-gradient(180deg,#ffffff_0%,#f8fbfd_100%)] px-4 py-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.05)] transition-all hover:-translate-y-0.5 hover:border-[#9ec0d8] hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]"
          >
            <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] ${item.iconClass}`}>
              <i className={`fas ${item.icon} text-[15px]`} />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-bold text-[#17324d]">{item.label}</span>
              <span className="mt-1 block text-[11px] text-[#607d8b]">{item.note}</span>
              <span className="mt-3 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#315b7b]">
                Open module
                <i className="fas fa-arrow-right text-[10px] transition-transform group-hover:translate-x-0.5" />
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [calendarYear, setCalendarYear] = useState(now.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth() + 1);

  const availableYears = Array.from({ length: 6 }, (_, index) => now.getFullYear() - index);

  const { data, isLoading, isError, error, isFetching } = useDashboardOverview({ year, month });
  const {
    data: calendarData,
    isLoading: isCalendarLoading,
    isFetching: isCalendarFetching,
    isError: isCalendarError,
    error: calendarError
  } = useDashboardReceivablesCalendar({ year: calendarYear, month: calendarMonth });
  const dashboard = data?.data;
  const summary = dashboard?.summary ?? {};
  const trends = dashboard?.trends?.monthly ?? [];
  const collectionAlert = dashboard?.alerts?.collections ?? { rows: [] };
  const inventoryAlert = dashboard?.alerts?.inventory ?? { rows: [] };
  const receivablesCalendar = calendarData?.data?.receivables ?? null;
  const receivablesCalendarPeriod = calendarData?.data?.period ?? null;
  const rankings = dashboard?.rankings ?? {};

  const moveCalendarMonth = (direction) => {
    const nextDate = new Date(calendarYear, calendarMonth - 1 + direction, 1);
    setCalendarYear(nextDate.getFullYear());
    setCalendarMonth(nextDate.getMonth() + 1);
  };

  if (isError) {
    return (
      <section className="table-card rounded-[22px] border border-[#efc2c2] bg-white shadow-[0_12px_36px_rgba(26,53,87,0.07)]">
        <div className="px-5 py-10 text-[12px] text-[#c62828]">
          Failed to load dashboard overview{error?.message ? `: ${error.message}` : "."}
        </div>
      </section>
    );
  }

  const selectedMonthLabel = MONTH_OPTIONS.find((option) => option.value === month)?.label ?? "";
  const collectionCoverage = Number(summary.salesRevenue) > 0
    ? (Number(summary.collections ?? 0) / Number(summary.salesRevenue ?? 0)) * 100
    : 0;
  const expenseShare = Number(summary.purchaseSpend) > 0
    ? (Number(summary.expenses ?? 0) / Number(summary.purchaseSpend ?? 0)) * 100
    : 0;

  const summaryCards = [
    {
      label: "Sales Revenue",
      value: formatCurrency(summary.salesRevenue),
      helper: "Booked sales",
      secondaryLabel: "Period",
      secondaryValue: `${selectedMonthLabel} ${year}`,
      icon: "fa-sack-dollar"
    },
    {
      label: "Collections",
      value: formatCurrency(summary.collections),
      helper: "Cash received",
      secondaryLabel: "Coverage",
      secondaryValue: formatPercent(collectionCoverage),
      icon: "fa-wallet"
    },
    {
      label: "Outstanding AR",
      value: formatCurrency(summary.outstandingReceivables),
      helper: "Open receivables",
      secondaryLabel: "Overdue",
      secondaryValue: formatWholeNumber(collectionAlert.overdueCount),
      icon: "fa-file-invoice-dollar"
    },
    {
      label: "Purchase Spend",
      value: formatCurrency(summary.purchaseSpend),
      helper: "Supplier outflow",
      secondaryLabel: "Expenses",
      secondaryValue: formatCompactCurrencyPrecise(summary.expenses),
      icon: "fa-truck-ramp-box"
    },
    {
      label: "Expenses",
      value: formatCurrency(summary.expenses),
      helper: "Operating cost",
      secondaryLabel: "Vs spend",
      secondaryValue: formatPercent(expenseShare),
      icon: "fa-receipt"
    },
    {
      label: "Low Stock Variants",
      value: formatWholeNumber(summary.lowStockVariants),
      helper: "Replenishment watch",
      secondaryLabel: "Out / Low",
      secondaryValue: `${inventoryAlert.outOfStock ?? 0} / ${inventoryAlert.lowStock ?? 0}`,
      icon: "fa-box-open"
    }
  ];

  return (
    <div className="space-y-5">
      <ExecutiveHero
        month={month}
        setMonth={setMonth}
        year={year}
        setYear={setYear}
        availableYears={availableYears}
        summaryCards={summaryCards}
        isLoading={isLoading}
        isFetching={isFetching}
      />

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <DashboardTrendChart
          title="Sales vs Collections Trend"
          description={`Monthly sales booked against collections for ${year}.`}
          points={trends}
          emptyMessage="No dashboard trend data found for the selected year."
        />

        <DashboardAgentChart
          title="Top Agent Coverage"
          description="Top five agents by sales and collected cash."
          rows={rankings.topAgents ?? []}
        />
      </div>

      <DashboardReceivablesCalendar
        title="Collection Due-Date Calendar"
        description="Open receivables grouped by due date."
        calendar={receivablesCalendar}
        monthLabel={receivablesCalendarPeriod?.monthLabel ?? MONTH_OPTIONS.find((option) => option.value === calendarMonth)?.label ?? ""}
        month={calendarMonth}
        year={calendarYear}
        isLoading={isCalendarLoading}
        isMonthChanging={isCalendarFetching && !isCalendarLoading}
        onPreviousMonth={() => moveCalendarMonth(-1)}
        onNextMonth={() => moveCalendarMonth(1)}
        errorMessage={isCalendarError ? `Failed to load receivables calendar${calendarError?.message ? `: ${calendarError.message}` : "."}` : ""}
      />

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <div className="space-y-5">
          <AlertPanel
            title="Collection Pressure"
            subtitle="Accounts that need follow-up first."
            meta={`${collectionAlert.highPriorityCount ?? 0} high priority`}
            rows={collectionAlert.rows ?? []}
            isLoading={isLoading}
            emptyMessage="No high-priority receivable alerts found."
            footer={`${collectionAlert.highPriorityCount ?? 0} high-priority accounts · ${collectionAlert.overdueCount ?? 0} overdue accounts · ${formatCurrency(collectionAlert.totalOutstanding)}`}
            renderRow={(row) => (
              <div key={`collection-alert-${row.id}`} className="rounded-[18px] border border-[#dce5ec] bg-[linear-gradient(180deg,#ffffff_0%,#f9fbfd_100%)] px-4 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-[#17324d]">{row.customerName}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#6a8396]">
                      {row.invoiceNumber}
                      {row.salesOrderNumber ? ` · ${row.salesOrderNumber}` : ""}
                    </div>
                  </div>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${getBadgeClasses(row.priority)}`}>
                    {humanizeLabel(row.priority)}
                  </span>
                </div>

                <div className="mt-4 grid gap-2 text-[11px] text-[#607d8b] sm:grid-cols-3">
                  <div className="rounded-[14px] bg-white px-3 py-2">
                    <div className="font-bold text-[#17324d]">{formatCurrency(row.outstandingAmount)}</div>
                    <div className="mt-1">Outstanding</div>
                  </div>
                  <div className="rounded-[14px] bg-white px-3 py-2">
                    <div className="font-bold text-[#17324d]">{row.daysOverdue > 0 ? `${row.daysOverdue} days` : "Current"}</div>
                    <div className="mt-1">{humanizeLabel(row.agingBucket)}</div>
                  </div>
                  <div className="rounded-[14px] bg-white px-3 py-2">
                    <div className="font-bold text-[#17324d]">{row.agentName}</div>
                    <div className="mt-1">{row.agentCode}</div>
                  </div>
                </div>
              </div>
            )}
          />

          <RankingTable
            title="Top Products"
            subtitle="Best-selling product lines this month."
            meta={selectedMonthLabel}
            isLoading={isLoading}
            rows={(rankings.topProducts ?? []).map((row) => ({ ...row, key: `product-${row.productId}` }))}
            emptyMessage="No product ranking found for this month."
            columns={[
              {
                key: "name",
                label: "Product",
                render: (row) => (
                  <div>
                    <div className="font-bold text-[#17324d]">{row.productName}</div>
                    <div className="text-[10px] uppercase tracking-[0.1em] text-[#607d8b]">{row.quantity} units</div>
                  </div>
                ),
                skeletonClass: "w-28"
              },
              {
                key: "sales",
                label: "Sales",
                className: "text-right",
                render: (row) => <span className="font-mono font-bold text-[#17324d]">{formatCurrency(row.totalSales)}</span>,
                skeletonClass: "ml-auto w-20"
              }
            ]}
          />

          <RankingTable
            title="Top Customers"
            subtitle="Largest billed customers this month."
            meta={selectedMonthLabel}
            isLoading={isLoading}
            rows={(rankings.topCustomers ?? []).map((row) => ({ ...row, key: `customer-${row.customerId}` }))}
            emptyMessage="No customer sales ranking found for this month."
            columns={[
              {
                key: "name",
                label: "Customer",
                render: (row) => (
                  <div>
                    <div className="font-bold text-[#17324d]">{row.customerName}</div>
                    <div className="text-[10px] uppercase tracking-[0.1em] text-[#607d8b]">{row.orderCount} orders</div>
                  </div>
                ),
                skeletonClass: "w-28"
              },
              {
                key: "sales",
                label: "Sales",
                className: "text-right",
                render: (row) => <span className="font-mono font-bold text-[#17324d]">{formatCurrency(row.totalSales)}</span>,
                skeletonClass: "ml-auto w-20"
              }
            ]}
          />
        </div>

        <div className="space-y-5">
          <OperationalShortcuts navigate={navigate} isFetching={isFetching} />

          <AlertPanel
            title="Inventory Pressure"
            subtitle="Variants below safe stock levels."
            meta={`${inventoryAlert.outOfStock ?? 0} out of stock`}
            rows={inventoryAlert.rows ?? []}
            isLoading={isLoading}
            emptyMessage="No low-stock alerts found."
            footer={`${inventoryAlert.outOfStock ?? 0} out of stock · ${inventoryAlert.lowStock ?? 0} low stock`}
            renderRow={(row) => (
              <div key={`inventory-alert-${row.id}`} className="rounded-[16px] border border-[#dce5ec] bg-[linear-gradient(180deg,#ffffff_0%,#f9fbfd_100%)] px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-[#17324d]">{row.label}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-[#6a8396]">Product #{row.productId}</div>
                  </div>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${getBadgeClasses(row.stockStatus)}`}>
                    {humanizeLabel(row.stockStatus)}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 text-[11px] text-[#607d8b] sm:grid-cols-2">
                  <div className="rounded-[12px] bg-white px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.1em] text-[#6a8396]">On hand</div>
                    <div className="mt-1 font-bold text-[#17324d]">{row.onHand}</div>
                  </div>
                  <div className="rounded-[12px] bg-white px-3 py-2">
                    <div className="text-[10px] uppercase tracking-[0.1em] text-[#6a8396]">Reorder level</div>
                    <div className="mt-1 font-bold text-[#17324d]">{row.reorderLevel}</div>
                  </div>
                </div>
              </div>
            )}
          />
        </div>
      </div>
    </div>
  );
}
