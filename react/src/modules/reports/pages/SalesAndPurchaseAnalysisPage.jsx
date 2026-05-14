import { useState } from "react";
import { ReportPeriodSelect } from "@/shared/components/common/ReportPeriodSelect";
import { Skeleton } from "@/shared/components/common/Skeleton";
import { usePurchaseSummaryReport, useSalesSummaryReport } from "../hooks/useReports";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP"
  }).format(Number(value ?? 0));
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-PH").format(Number(value ?? 0));
}

function currentMonthDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPeriodLabel(period) {
  const labels = {
    month: "This Month",
    quarter: "This Quarter",
    year: "This Year",
    custom: "Custom Range"
  };

  return labels[period] ?? "Selected Period";
}

function getCompareLabel(compareWith) {
  const labels = {
    previous: "Vs Previous Period",
    year_ago: "Vs Last Year",
    none: "No Comparison"
  };

  return labels[compareWith] ?? "Comparison";
}

function formatPercent(value) {
  const numeric = Number(value ?? 0);
  return `${Math.round((numeric + Number.EPSILON) * 10) / 10}%`;
}

function periodText(period, startDate, endDate) {
  if (period === "custom" && startDate && endDate) return `${startDate} to ${endDate}`;
  return getPeriodLabel(period);
}

function GrowthBadge({ value }) {
  const numeric = Number(value ?? 0);
  const positive = numeric >= 0;
  const classes = positive ? "bg-[#e8f5e9] text-[#2e7d32]" : "bg-[#fce4e4] text-[#c62828]";
  const icon = positive ? "fa-arrow-up" : "fa-arrow-down";
  return (
    <span className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-bold ${classes}`}>
      <i className={`fas ${icon} text-[8px]`} />
      {formatPercent(Math.abs(numeric))}
    </span>
  );
}

function ReportTable({ title, subtitle, columns, rows, emptyMessage, loading, compareWith }) {
  return (
    <section className="table-card overflow-hidden rounded-[18px] border border-[#d7e3ec] bg-white shadow-[0_14px_36px_rgba(26,53,87,0.07)]">
      <div className="border-b border-[#e3ebf1] bg-[#fbfdff] px-5 py-4">
        <div className="text-[13px] font-bold text-[#1e293b]">{title}</div>
        <div className="mt-1 text-[11px] text-[#607d8b]">{subtitle}</div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] border-collapse">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`bg-[#f1f5f9] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.35px] text-[#334155] ${column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : "text-left"} ${column.borderRight ? "border-r border-[#e2e8f0]" : ""}`}
                >
                  {column.label}
                </th>
              ))}
              {compareWith !== "none" ? (
                <th className="bg-[#f1f5f9] px-3 py-2 text-center text-[10px] font-bold uppercase tracking-[0.35px] text-[#334155]">
                  Change
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <tr key={`${title}-sk-${index}`} className={index % 2 === 0 ? "bg-white" : "bg-[#f3f6f9]"}>
                  {columns.map((column) => (
                    <td key={`${title}-sk-${index}-${column.key}`} className="border-b border-[#dde3e8] px-3 py-2">
                      <Skeleton className="h-3 w-24" />
                    </td>
                  ))}
                  {compareWith !== "none" ? (
                    <td className="border-b border-[#dde3e8] px-3 py-2 text-center">
                      <Skeleton className="mx-auto h-4 w-12" />
                    </td>
                  ) : null}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (compareWith !== "none" ? 1 : 0)}
                  className="bg-white px-6 py-10 text-center text-[12px] italic text-[#90a4ae]"
                >
                  <i className="fas fa-info-circle mr-1.5" /> {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.key} className={`${index % 2 === 0 ? "bg-white" : "bg-[#f3f6f9]"} hover:bg-[#dce8f2] transition-colors duration-100`}>
                  {columns.map((column) => (
                    <td
                      key={`${row.key}-${column.key}`}
                      className={`border-b border-[#dde3e8] px-3 py-2 align-middle ${column.borderRight ? "border-r border-[#e8ecef]" : ""} ${column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : "text-left"}`}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                  {compareWith !== "none" ? (
                    <td className="border-b border-[#dde3e8] px-3 py-2 text-center align-middle">
                      <GrowthBadge value={row.growth ?? row.change ?? 0} />
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SnapshotCard({ title, icon, tone = "blue", metrics, highlights, loading }) {
  const toneClasses = {
    blue: {
      shell: "border-[#d7e7f4] bg-[#fbfdff]",
      icon: "bg-[#e8f1f8] text-[#0070b8]",
      stat: "bg-white/90 border-[#dde7ef]"
    },
    amber: {
      shell: "border-[#efe1ba] bg-[#fffdf7]",
      icon: "bg-[#fff2cc] text-[#9a6a00]",
      stat: "bg-white/90 border-[#eadfbf]"
    }
  };

  const palette = toneClasses[tone] ?? toneClasses.blue;

  return (
    <section className={`table-card overflow-hidden rounded-[20px] border shadow-[0_14px_36px_rgba(26,53,87,0.07)] ${palette.shell}`}>
      <div className="flex items-start justify-between gap-4 border-b border-[#e3ebf1] px-5 py-4">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] text-[15px] ${palette.icon}`}>
            <i className={`fas ${icon}`} />
          </div>
          <div>
            <div className="text-[14px] font-bold text-[#1a3557]">{title}</div>
            <div className="mt-1 text-[11px] text-[#607d8b]">Operational highlights for the selected reporting window.</div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 px-5 py-4 md:grid-cols-2">
        {metrics.map((metric) => (
          <div key={metric.label} className={`rounded-[14px] border px-4 py-3 ${palette.stat}`}>
            <div className="text-[10px] font-bold uppercase tracking-[0.4px] text-[#78909c]">{metric.label}</div>
            <div className="mt-1 text-[18px] font-bold text-[#1a3557]">
              {loading ? <Skeleton className="h-5 w-24" /> : metric.value}
            </div>
            <div className="mt-1 text-[10px] text-[#607d8b]">{metric.helper}</div>
          </div>
        ))}
      </div>

      <div className="border-t border-[#e3ebf1] px-5 py-4">
        <div className="text-[10px] font-bold uppercase tracking-[0.45px] text-[#607d8b]">Focus Areas</div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {highlights.map((item) => (
            <div key={item.label} className="rounded-[14px] border border-[#e3ebf1] bg-white/90 px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.4px] text-[#90a4ae]">{item.label}</div>
              <div className="mt-1 text-[13px] font-bold text-[#1a3557]">
                {loading ? <Skeleton className="h-4 w-28" /> : item.value}
              </div>
              <div className="mt-1 text-[10px] text-[#607d8b]">{item.helper}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RankingListCard({ title, subtitle, rows, isLoading, emptyMessage, renderMeta }) {
  return (
    <section className="table-card overflow-hidden rounded-[20px] border border-[#d7e3ec] bg-white shadow-[0_14px_36px_rgba(26,53,87,0.07)]">
      <div className="flex items-start justify-between gap-4 border-b border-[#e3ebf1] bg-[#fbfdff] px-5 py-4">
        <div>
          <div className="text-[14px] font-bold text-[#1a3557]">{title}</div>
          <div className="mt-1 text-[11px] text-[#607d8b]">{subtitle}</div>
        </div>
        <div className="rounded-full border border-[#d7e3ec] bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.35px] text-[#607d8b]">
          Ranking
        </div>
      </div>

      <div className="space-y-3 px-5 py-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, index) => (
            <div key={`${title}-sk-${index}`} className="flex items-center gap-3 rounded-[16px] border border-[#e3ebf1] bg-[#fbfdff] px-4 py-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-2 h-3 w-28" />
              </div>
              <div className="grid min-w-[180px] gap-2 text-right md:grid-cols-2">
                <Skeleton className="ml-auto h-4 w-16" />
                <Skeleton className="ml-auto h-4 w-20" />
              </div>
            </div>
          ))
        ) : rows.length === 0 ? (
          <div className="erp-empty-state">{emptyMessage}</div>
        ) : (
          rows.map((row, index) => (
            <article key={row.key} className="flex flex-col gap-3 rounded-[16px] border border-[#e3ebf1] bg-[#fbfdff] px-4 py-3 md:flex-row md:items-center">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#d7e3ec] bg-white text-[10px] font-bold text-[#1a3557]">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-bold text-[#1a3557]">{row.primary}</div>
                  <div className="mt-1 text-[10px] text-[#607d8b]">{row.secondary}</div>
                </div>
              </div>

              <div className="grid flex-1 gap-2 md:grid-cols-2">
                {renderMeta(row).map((meta) => (
                  <div key={meta.label} className="rounded-[12px] border border-[#e3ebf1] bg-white px-3 py-2">
                    <div className="text-[9px] font-bold uppercase tracking-[0.35px] text-[#90a4ae]">{meta.label}</div>
                    <div className="mt-1 text-[12px] font-bold text-[#1a3557]">{meta.value}</div>
                  </div>
                ))}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

export function SalesAndPurchaseAnalysisPage() {
  const [activeTab, setActiveTab] = useState("sales");
  const [period, setPeriod] = useState("month");
  const [compareWith, setCompareWith] = useState("previous");
  const [startDate, setStartDate] = useState(currentMonthDate().slice(0, 8) + "01");
  const [endDate, setEndDate] = useState(currentMonthDate());

  const clearFilters = () => {
    setPeriod("month");
    setCompareWith("previous");
    setStartDate(currentMonthDate().slice(0, 8) + "01");
    setEndDate(currentMonthDate());
  };

  const params = {
    period,
    compareWith,
    ...(period === "custom" ? { startDate, endDate } : {})
  };

  const salesQuery = useSalesSummaryReport(params);
  const purchaseQuery = usePurchaseSummaryReport(params);

  const sales = salesQuery.data?.data;
  const purchase = purchaseQuery.data?.data;
  const salesSummary = sales?.summary ?? {};
  const purchaseSummary = purchase?.summary ?? {};
  const salesLoading = salesQuery.isLoading;
  const purchaseLoading = purchaseQuery.isLoading;
  const loading = salesLoading || purchaseLoading;
  const error = salesQuery.error ?? purchaseQuery.error;

  const topCustomer = sales?.topCustomers?.[0];
  const topSupplier = purchase?.topSuppliers?.[0];
  const topSellingProduct = sales?.topProducts?.[0];
  const topPurchasedProduct = purchase?.topPurchasedProducts?.[0];
  const topSalesCategory = sales?.salesByCategory?.[0];
  const topPurchaseCategory = purchase?.purchaseByCategory?.[0];

  if (salesQuery.isError || purchaseQuery.isError) {
    return (
      <section className="table-card erp-page-main-card-joined">
        <div className="px-4 py-10 text-[11px] text-[#c62828]">
          Failed to load sales and purchase reports{error?.message ? `: ${error.message}` : "."}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="erp-page-section erp-page-section-joined overflow-visible">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <i className="fas fa-chart-column text-[18px] text-[#90caf9]" />
            <div>
              <div className="erp-page-title">Sales and Purchase Analysis</div>
              <div className="erp-page-description">Business-facing revenue and purchasing view with customer, supplier, product, and category concentration.</div>
            </div>
          </div>
        </div>

        <div className="erp-page-filters">
          <div className="erp-filter-label">
            <i className="fas fa-filter mr-1" />
            Filters
          </div>

          <ReportPeriodSelect
            value={period}
            startValue={startDate}
            endValue={endDate}
            onChange={({ period: nextPeriod, start, end }) => {
              setPeriod(nextPeriod);
              setStartDate(start);
              setEndDate(end);
            }}
          />

          <div className="relative min-w-[190px]">
            <i className="fas fa-scale-balanced pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
            <select value={compareWith} onChange={(event) => setCompareWith(event.target.value)} className="erp-select pl-7">
              <option value="previous">Compare to Previous</option>
              <option value="year_ago">Compare to Last Year</option>
              <option value="none">No Comparison</option>
            </select>
          </div>

          <button type="button" onClick={clearFilters} className="erp-button-secondary">
            <i className="fas fa-eraser mr-2 text-[11px]" />
            Clear Filters
          </button>

        </div>
      </section>

      <section className="table-card erp-page-main-card-joined overflow-hidden rounded-[18px] border border-[#b0bec5] bg-white shadow-[0_14px_36px_rgba(26,53,87,0.07)]">
        <div className="bg-[#f8fafc] px-5 py-3 flex items-center justify-between border-b border-[#e2e8f0]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-[12px] border border-[#e2e8f0] bg-white text-[#0284c7]">
              <i className="fas fa-chart-bar text-[14px]" />
            </div>
            <div>
              <div className="text-[10px] text-[#64748b] mt-0.5 font-bold uppercase tracking-[0.6px]">
                Management-ready report view · {periodText(period, startDate, endDate)}
              </div>
            </div>
          </div>
          <div className="rounded-full border border-[#e2e8f0] bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.6px] text-[#475569]">
            {getCompareLabel(compareWith)}
          </div>
        </div>

        <div className="bg-white border-b border-[#b0bec5] px-2 flex">
          {[
            { key: "sales", label: "Sales Analysis", icon: "fa-chart-line" },
            { key: "purchase", label: "Purchase Analysis", icon: "fa-shopping-bag" }
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-5 py-3 text-[12px] font-bold border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.key ? "border-[#0070b8] text-[#0070b8] bg-[#f3f6f9]" : "border-transparent text-[#607d8b] hover:text-[#1a3557]"
              }`}
            >
              <i className={`fas ${tab.icon} text-[11px]`} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-4">
          {activeTab === "sales" ? (
            <>
              <ReportTable
                title="Top Customers"
                subtitle="Customers generating the most revenue for the selected period."
                loading={salesLoading}
                compareWith={compareWith}
                emptyMessage="No customer sales records found for this period."
                columns={[
                  { key: "name", label: "Customer", align: "left", borderRight: true, render: (row) => <span className="text-[12px] font-bold text-[#0f172a]">{row.name}</span> },
                  { key: "orders", label: "Orders", align: "center", borderRight: true, render: (row) => <span className="font-mono text-[12px] text-[#546e7a]">{formatNumber(row.orders)}</span> },
                  { key: "units", label: "Units", align: "center", borderRight: true, render: (row) => <span className="font-mono text-[12px] text-[#546e7a]">{formatNumber(row.units_sold ?? row.units ?? 0)}</span> },
                  { key: "revenue", label: "Total Revenue", align: "right", borderRight: true, render: (row) => <span className="font-mono font-bold text-[12px] text-[#2e7d32]">{formatCurrency(row.revenue)}</span> },
                  { key: "percentage", label: "% of Total", align: "right", borderRight: true, render: (row) => <span className="font-mono text-[12px] text-[#546e7a]">{formatPercent(row.percentage)}</span> }
                ]}
                rows={(sales?.topCustomers ?? []).map((item) => ({ ...item, key: `sales-customer-${item.id ?? item.name}` }))}
              />

              <ReportTable
                title="Top Selling Products"
                subtitle="Products contributing the highest sales revenue."
                loading={salesLoading}
                compareWith={compareWith}
                emptyMessage="No sales product lines found for this period."
                columns={[
                  {
                    key: "product",
                    label: "Product",
                    align: "left",
                    borderRight: true,
                    render: (row) => (
                      <div>
                        <div className="text-[12px] font-bold text-[#0f172a]">{row.name}</div>
                        <div className="text-[10px] text-[#607d8b]">{row.category || "Uncategorized"}</div>
                      </div>
                    )
                  },
                  { key: "orders", label: "Orders", align: "center", borderRight: true, render: (row) => <span className="font-mono text-[12px] text-[#546e7a]">{formatNumber(row.orders ?? 0)}</span> },
                  { key: "units", label: "Units Sold", align: "center", borderRight: true, render: (row) => <span className="font-mono text-[12px] text-[#546e7a]">{formatNumber(row.units_sold ?? 0)}</span> },
                  { key: "revenue", label: "Total Revenue", align: "right", borderRight: true, render: (row) => <span className="font-mono font-bold text-[12px] text-[#2e7d32]">{formatCurrency(row.revenue)}</span> },
                  { key: "percentage", label: "% of Total", align: "right", borderRight: true, render: (row) => <span className="font-mono text-[12px] text-[#546e7a]">{formatPercent(row.percentage)}</span> }
                ]}
                rows={(sales?.topProducts ?? []).map((item) => ({ ...item, key: `sales-product-${item.id ?? item.name}` }))}
              />

              <ReportTable
                title="Sales by Category"
                subtitle="Where the sales mix is concentrated by category."
                loading={salesLoading}
                compareWith={compareWith}
                emptyMessage="No sales categories found for this period."
                columns={[
                  { key: "category", label: "Category", align: "left", borderRight: true, render: (row) => <span className="text-[12px] font-bold text-[#0f172a]">{row.name}</span> },
                  { key: "orders", label: "Orders", align: "center", borderRight: true, render: (row) => <span className="font-mono text-[12px] text-[#546e7a]">{formatNumber(row.orders)}</span> },
                  { key: "units", label: "Units", align: "center", borderRight: true, render: (row) => <span className="font-mono text-[12px] text-[#546e7a]">{formatNumber(row.units_sold ?? row.units ?? 0)}</span> },
                  { key: "revenue", label: "Total Revenue", align: "right", borderRight: true, render: (row) => <span className="font-mono font-bold text-[12px] text-[#2e7d32]">{formatCurrency(row.revenue)}</span> },
                  { key: "percentage", label: "% of Total", align: "right", borderRight: true, render: (row) => <span className="font-mono text-[12px] text-[#546e7a]">{formatPercent(row.percentage)}</span> }
                ]}
                rows={(sales?.salesByCategory ?? []).map((item) => ({ ...item, key: `sales-category-${item.name}` }))}
              />
            </>
          ) : (
            <>
              <ReportTable
                title="Top Suppliers"
                subtitle="Suppliers receiving the highest purchasing spend."
                loading={purchaseLoading}
                compareWith={compareWith}
                emptyMessage="No purchase supplier records found for this period."
                columns={[
                  { key: "name", label: "Supplier", align: "left", borderRight: true, render: (row) => <span className="text-[12px] font-bold text-[#0f172a]">{row.name}</span> },
                  { key: "pos", label: "POs", align: "center", borderRight: true, render: (row) => <span className="font-mono text-[12px] text-[#546e7a]">{formatNumber(row.pos)}</span> },
                  { key: "units", label: "Units", align: "center", borderRight: true, render: (row) => <span className="font-mono text-[12px] text-[#546e7a]">{formatNumber(row.units_purchased ?? row.units ?? 0)}</span> },
                  { key: "spending", label: "Total Cost", align: "right", borderRight: true, render: (row) => <span className="font-mono font-bold text-[12px] text-[#e65100]">{formatCurrency(row.spending ?? row.cost ?? 0)}</span> },
                  { key: "percentage", label: "% of Total", align: "right", borderRight: true, render: (row) => <span className="font-mono text-[12px] text-[#546e7a]">{formatPercent(row.percentage)}</span> }
                ]}
                rows={(purchase?.topSuppliers ?? []).map((item) => ({ ...item, key: `purchase-supplier-${item.id ?? item.name}` }))}
              />

              <ReportTable
                title="Top Purchased Products"
                subtitle="Products using the most purchase budget."
                loading={purchaseLoading}
                compareWith={compareWith}
                emptyMessage="No purchase product lines found for this period."
                columns={[
                  {
                    key: "product",
                    label: "Product",
                    align: "left",
                    borderRight: true,
                    render: (row) => (
                      <div>
                        <div className="text-[12px] font-bold text-[#0f172a]">{row.name}</div>
                        <div className="text-[10px] text-[#607d8b]">{row.category || "Uncategorized"}</div>
                      </div>
                    )
                  },
                  { key: "pos", label: "POs", align: "center", borderRight: true, render: (row) => <span className="font-mono text-[12px] text-[#546e7a]">{formatNumber(row.pos ?? 0)}</span> },
                  { key: "units", label: "Units Purchased", align: "center", borderRight: true, render: (row) => <span className="font-mono text-[12px] text-[#546e7a]">{formatNumber(row.units_purchased ?? 0)}</span> },
                  { key: "cost", label: "Total Cost", align: "right", borderRight: true, render: (row) => <span className="font-mono font-bold text-[12px] text-[#e65100]">{formatCurrency(row.cost)}</span> },
                  { key: "percentage", label: "% of Total", align: "right", borderRight: true, render: (row) => <span className="font-mono text-[12px] text-[#546e7a]">{formatPercent(row.percentage)}</span> }
                ]}
                rows={(purchase?.topPurchasedProducts ?? []).map((item) => ({ ...item, key: `purchase-product-${item.id ?? item.name}` }))}
              />

              <ReportTable
                title="Purchases by Category"
                subtitle="Where procurement spending is concentrated by category."
                loading={purchaseLoading}
                compareWith={compareWith}
                emptyMessage="No purchase categories found for this period."
                columns={[
                  { key: "category", label: "Category", align: "left", borderRight: true, render: (row) => <span className="text-[12px] font-bold text-[#0f172a]">{row.name}</span> },
                  { key: "pos", label: "POs", align: "center", borderRight: true, render: (row) => <span className="font-mono text-[12px] text-[#546e7a]">{formatNumber(row.pos)}</span> },
                  { key: "units", label: "Units", align: "center", borderRight: true, render: (row) => <span className="font-mono text-[12px] text-[#546e7a]">{formatNumber(row.units_purchased ?? row.units ?? 0)}</span> },
                  { key: "cost", label: "Total Cost", align: "right", borderRight: true, render: (row) => <span className="font-mono font-bold text-[12px] text-[#e65100]">{formatCurrency(row.cost)}</span> },
                  { key: "percentage", label: "% of Total", align: "right", borderRight: true, render: (row) => <span className="font-mono text-[12px] text-[#546e7a]">{formatPercent(row.percentage)}</span> }
                ]}
                rows={(purchase?.purchaseByCategory ?? []).map((item) => ({ ...item, key: `purchase-category-${item.name}` }))}
              />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
