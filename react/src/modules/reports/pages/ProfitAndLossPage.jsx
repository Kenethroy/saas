import { useState } from "react";
import { ReportPeriodSelect } from "@/shared/components/common/ReportPeriodSelect";
import { Skeleton, TableSkeleton } from "@/shared/components/common/Skeleton";
import { useProfitLossReport } from "../hooks/useReports";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP"
  }).format(Number(value ?? 0));
}

function formatDelta(current, previous) {
  if (!previous) {
    return current > 0 ? 100 : 0;
  }

  return Math.round((((current - previous) / previous) * 100 + Number.EPSILON) * 10) / 10;
}

function deltaClass(value, inverse = false) {
  const positive = inverse ? value <= 0 : value >= 0;
  return positive ? "text-[#2f6b37]" : "text-[#b3261e]";
}

function currentMonthDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function periodLabel(period, startDate, endDate) {
  const now = new Date();
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  if (period === "month") return `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  if (period === "quarter") {
    const quarter = Math.ceil((now.getMonth() + 1) / 3);
    return `Q${quarter} ${now.getFullYear()}`;
  }
  if (period === "year") return `Year ${now.getFullYear()}`;
  if (period === "custom" && startDate && endDate) return `${startDate} to ${endDate}`;
  return "Reporting period";
}

export function ProfitAndLossPage() {
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

  const { data, isLoading, isError, error, isFetching } = useProfitLossReport(params);
  const report = data?.data;
  const summary = report?.summary ?? {};
  const revenueItems = report?.revenue ?? [];
  const cogsItems = report?.cogs ?? [];
  const losses = report?.losses ?? [];
  const expenses = report?.expenses ?? [];

  const grossProfit = Number(summary.gross_profit ?? 0);
  const compareGrossProfit = Number(summary.compare_gross_profit ?? 0);
  const totalLosses = Number(summary.total_losses ?? 0);
  const compareTotalLosses = Number(summary.compare_total_losses ?? 0);
  const totalExpenses = Number(summary.total_expenses ?? 0);
  const compareTotalExpenses = Number(summary.compare_total_expenses ?? 0);
  const netIncome = Number(summary.net_income ?? 0);
  const compareNetIncome = Number(summary.compare_net_income ?? 0);
  const totalRevenue = revenueItems.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const compareTotalRevenue = revenueItems.reduce((sum, item) => sum + Number(item.compareAmount ?? 0), 0);
  const totalCogs = cogsItems.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const compareTotalCogs = cogsItems.reduce((sum, item) => sum + Number(item.compareAmount ?? 0), 0);
  const reportPeriodText = periodLabel(period, startDate, endDate);
  const comparisonLabel = compareWith === "previous" ? "Previous" : "Last Year";

  return (
    <div className="space-y-4">
      <section className="erp-page-section erp-page-section-joined overflow-visible">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <i className="fas fa-chart-pie text-[18px] text-[#90caf9]" />
            <div>
              <div className="erp-page-title">Profit and Loss</div>
              <div className="erp-page-description">Revenue, cost, loss, and expense visibility for the selected reporting period.</div>
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

      {isError ? (
        <section className="table-card erp-page-main-card-joined">
          <div className="px-4 py-10 text-[11px] text-[#c62828]">
            Failed to load profit and loss report{error?.message ? `: ${error.message}` : "."}
          </div>
        </section>
      ) : (
        <>
          <section className="table-card erp-page-main-card-joined">
            <div className="grid gap-3 border-b border-[#d7e3ec] bg-[#fbfdff] px-4 py-3 md:grid-cols-5">
              {[
                { label: "Revenue", current: totalRevenue, compare: compareTotalRevenue, inverse: false },
                { label: "COGS", current: totalCogs, compare: compareTotalCogs, inverse: true },
                { label: "Inventory Loss", current: totalLosses, compare: compareTotalLosses, inverse: true },
                { label: "Expenses", current: totalExpenses, compare: compareTotalExpenses, inverse: true },
                { label: "Net Income", current: netIncome, compare: compareNetIncome, inverse: false }
              ].map((card) => {
                const delta = formatDelta(card.current, card.compare);
                return (
                  <div key={card.label} className="erp-entity-card-panel">
                    <div className="text-[10px] font-bold uppercase tracking-[0.4px] text-[#607d8b]">{card.label}</div>
                    <div className="mt-1 text-[18px] font-bold text-[#1a3557]">
                      {isLoading ? <Skeleton className="h-5 w-24" /> : formatCurrency(card.current)}
                    </div>
                    <div className={`mt-1 text-[10px] font-bold ${deltaClass(delta, card.inverse)}`}>
                      {compareWith === "none" ? "Current period only" : `${delta >= 0 ? "+" : ""}${delta}% vs comparison`}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="table-card erp-page-main-card-joined">
            <div className={`overflow-x-auto ${isFetching ? "opacity-80" : ""}`}>
              <div className="min-w-[880px] overflow-hidden rounded-md border border-[#e2e8f0] bg-white shadow-sm">
                <div className="bg-[#1e293b] px-5 py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <i className="fas fa-file-invoice-dollar text-[#94a3b8] text-[13px]" />
                    <span className="text-[12px] font-bold text-white uppercase tracking-[1px]">Income Statement</span>
                  </div>
                  <span className="text-[10px] text-[#94a3b8] font-bold tracking-widest uppercase">{reportPeriodText}</span>
                </div>

                <div className="flex items-center justify-end px-6 py-2.5 border-b border-[#f1f5f9] bg-[#f8fafc]">
                  <span className="text-[9px] font-bold text-[#475569] uppercase tracking-[1.5px] w-40 text-right">Current Period</span>
                  {compareWith !== "none" ? (
                    <span className="text-[9px] font-bold text-[#94a3b8] uppercase tracking-[1.5px] w-40 text-right">{comparisonLabel}</span>
                  ) : null}
                </div>

                {isLoading ? (
                  <div className="px-6 py-6">
                    <div className="space-y-3">
                      {Array.from({ length: 8 }).map((_, index) => (
                        <div key={`pl-report-sk-${index}`} className="flex items-center justify-between gap-6 border-b border-[#f1f5f9] py-2.5">
                          <Skeleton className="h-3 w-56" />
                          <div className="flex">
                            <Skeleton className="ml-auto h-3 w-20" />
                            {compareWith !== "none" ? <Skeleton className="ml-6 h-3 w-20" /> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col pb-2">
                    <div className="mt-4">
                      <div className="px-6 py-2.5 border-y border-[#f1f5f9] bg-slate-50/50">
                        <span className="text-[10px] font-bold text-[#1e293b] uppercase tracking-wider">Revenue</span>
                      </div>

                      {revenueItems.map((item) => (
                        <div key={`rev-${item.id}`} className="flex items-center justify-between px-6 py-2.5 border-b border-[#f1f5f9] hover:bg-slate-50 transition-colors">
                          <span className="text-[12px] text-[#334155] pl-4">{item.name}</span>
                          <div className="flex">
                            <span className="font-mono text-[12px] text-[#0f172a] w-40 text-right">{formatCurrency(item.amount)}</span>
                            {compareWith !== "none" ? (
                              <span className="font-mono text-[11px] text-[#94a3b8] w-40 text-right">{formatCurrency(item.compareAmount)}</span>
                            ) : null}
                          </div>
                        </div>
                      ))}

                      <div className="flex items-center justify-between px-6 py-3 bg-white">
                        <span className="text-[12px] font-bold text-[#1e293b]">Total Revenue</span>
                        <div className="flex">
                          <span className="font-mono font-bold text-[13px] text-[#0f172a] w-40 text-right border-t border-[#1e293b] pt-1">{formatCurrency(totalRevenue)}</span>
                          {compareWith !== "none" ? (
                            <span className="font-mono font-bold text-[12px] text-[#94a3b8] w-40 text-right border-t border-[#94a3b8]/30 pt-1">{formatCurrency(compareTotalRevenue)}</span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6">
                      <div className="px-6 py-2.5 border-y border-[#f1f5f9] bg-slate-50/50">
                        <span className="text-[10px] font-bold text-[#1e293b] uppercase tracking-wider">Cost of Goods Sold</span>
                      </div>

                      {cogsItems.map((item) => (
                        <div key={`cogs-${item.id}`} className="flex items-center justify-between px-6 py-2.5 border-b border-[#f1f5f9] hover:bg-slate-50 transition-colors">
                          <span className="text-[12px] text-[#334155] pl-4">{item.name}</span>
                          <div className="flex">
                            <span className="font-mono text-[12px] text-[#0f172a] w-40 text-right">{formatCurrency(item.amount)}</span>
                            {compareWith !== "none" ? (
                              <span className="font-mono text-[11px] text-[#94a3b8] w-40 text-right">{formatCurrency(item.compareAmount)}</span>
                            ) : null}
                          </div>
                        </div>
                      ))}

                      <div className="flex items-center justify-between px-6 py-3 bg-white">
                        <span className="text-[12px] font-bold text-[#1e293b]">Total COGS</span>
                        <div className="flex">
                          <span className="font-mono font-bold text-[13px] text-[#0f172a] w-40 text-right border-t border-[#1e293b] pt-1">{formatCurrency(totalCogs)}</span>
                          {compareWith !== "none" ? (
                            <span className="font-mono font-bold text-[12px] text-[#94a3b8] w-40 text-right border-t border-[#94a3b8]/30 pt-1">{formatCurrency(compareTotalCogs)}</span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {losses.length ? (
                      <div className="mt-6">
                        <div className="px-6 py-2.5 border-y border-[#f1f5f9] bg-slate-50/50">
                          <span className="text-[10px] font-bold text-[#1e293b] uppercase tracking-wider">Inventory Losses</span>
                        </div>

                        {losses.map((item) => (
                          <div key={`loss-${item.id ?? item.name}`} className="flex items-center justify-between px-6 py-2.5 border-b border-[#f1f5f9] hover:bg-slate-50 transition-colors">
                            <span className="text-[12px] text-[#334155] pl-4">{item.name}</span>
                            <div className="flex">
                              <span className="font-mono text-[12px] text-[#0f172a] w-40 text-right">{formatCurrency(item.amount)}</span>
                              {compareWith !== "none" ? (
                                <span className="font-mono text-[11px] text-[#94a3b8] w-40 text-right">{formatCurrency(item.compareAmount)}</span>
                              ) : null}
                            </div>
                          </div>
                        ))}

                        <div className="flex items-center justify-between px-6 py-3 bg-white">
                          <span className="text-[12px] font-bold text-[#1e293b]">Total Inventory Losses</span>
                          <div className="flex">
                            <span className="font-mono font-bold text-[13px] text-[#0f172a] w-40 text-right border-t border-[#1e293b] pt-1">{formatCurrency(totalLosses)}</span>
                            {compareWith !== "none" ? (
                              <span className="font-mono font-bold text-[12px] text-[#94a3b8] w-40 text-right border-t border-[#94a3b8]/30 pt-1">{formatCurrency(compareTotalLosses)}</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between px-6 py-5 mt-4 border-y border-[#e2e8f0] bg-slate-50/50">
                      <div>
                        <div className="text-[14px] font-bold text-[#1e293b] uppercase tracking-wider">Gross Profit</div>
                        <div className="text-[10px] mt-0.5 text-[#64748b]">Revenue minus COGS and losses</div>
                      </div>
                      <div className="flex">
                        <span className="font-mono font-bold text-[18px] text-[#1e293b] w-40 text-right">{formatCurrency(grossProfit)}</span>
                        {compareWith !== "none" ? (
                          <span className="font-mono font-bold text-[14px] text-[#94a3b8] w-40 text-right">{formatCurrency(compareGrossProfit)}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-6">
                      <div className="px-6 py-2.5 border-y border-[#f1f5f9] bg-slate-50/50">
                        <span className="text-[10px] font-bold text-[#1e293b] uppercase tracking-wider">Operating Expenses</span>
                      </div>

                      {expenses.map((item) => (
                        <div key={`expense-${item.id ?? item.name}`} className="flex items-center justify-between px-6 py-2.5 border-b border-[#f1f5f9] hover:bg-slate-50 transition-colors">
                          <span className="text-[12px] text-[#334155] pl-4">{item.name}</span>
                          <div className="flex">
                            <span className="font-mono text-[12px] text-[#0f172a] w-40 text-right">{formatCurrency(item.amount)}</span>
                            {compareWith !== "none" ? (
                              <span className="font-mono text-[11px] text-[#94a3b8] w-40 text-right">{formatCurrency(item.compareAmount)}</span>
                            ) : null}
                          </div>
                        </div>
                      ))}

                      <div className="flex items-center justify-between px-6 py-3 bg-white">
                        <span className="text-[12px] font-bold text-[#1e293b]">Total Operating Expenses</span>
                        <div className="flex">
                          <span className="font-mono font-bold text-[13px] text-[#0f172a] w-40 text-right border-t border-[#1e293b] pt-1">{formatCurrency(totalExpenses)}</span>
                          {compareWith !== "none" ? (
                            <span className="font-mono font-bold text-[12px] text-[#94a3b8] w-40 text-right border-t border-[#94a3b8]/30 pt-1">{formatCurrency(compareTotalExpenses)}</span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className={`flex items-center justify-between px-6 py-6 border-t-2 border-b-4 border-[#1e293b] ${netIncome >= 0 ? "bg-[#f0fdf4]" : "bg-[#fef2f2]"}`}>
                      <div>
                        <div className={`text-[15px] font-bold uppercase tracking-widest ${netIncome >= 0 ? "text-[#166534]" : "text-[#991b1b]"}`}>Net Income</div>
                        <div className="text-[10px] mt-0.5 text-[#64748b] tracking-wider font-bold">
                          {compareWith === "none" ? "CURRENT PERIOD" : `VS ${comparisonLabel.toUpperCase()}`}
                        </div>
                      </div>
                      <div className="flex items-center">
                        <span className={`font-mono font-bold text-[24px] w-40 text-right ${netIncome >= 0 ? "text-[#166534]" : "text-[#991b1b]"}`}>{formatCurrency(netIncome)}</span>
                        {compareWith !== "none" ? (
                          <span className="font-mono font-bold text-[16px] text-[#94a3b8] w-40 text-right">{formatCurrency(compareNetIncome)}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
