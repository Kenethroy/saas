import { useDeferredValue, useEffect, useState } from "react";
import { Pagination } from "@/shared/components/common/Pagination";
import { Skeleton, TableSkeleton } from "@/shared/components/common/Skeleton";
import { useInventoryVelocityReport } from "../hooks/useReports";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP"
  }).format(Number(value ?? 0));
}

function velocityBadgeClass(value) {
  const normalized = String(value ?? "").toLowerCase();

  if (normalized.includes("fast")) {
    return "border-[#c2ddbe] bg-[#f3faf1] text-[#356b37]";
  }

  if (normalized.includes("dead")) {
    return "border-[#e6b8b8] bg-[#fff7f7] text-[#a44d4d]";
  }

  return "border-[#efd79a] bg-[#fff9ec] text-[#9a6a00]";
}

export function InventoryMovementAnalysisPage() {
  const [page, setPage] = useState(1);
  const [days, setDays] = useState(30);
  const [searchInput, setSearchInput] = useState("");
  const [velocityFilter, setVelocityFilter] = useState("");
  const deferredSearch = useDeferredValue(searchInput.trim());

  const { data, isLoading, isError, error, isFetching } = useInventoryVelocityReport({
    page,
    limit: 12,
    days,
    ...(deferredSearch ? { search: deferredSearch } : {}),
    ...(velocityFilter ? { velocity: velocityFilter } : {})
  });

  const rows = data?.data ?? [];
  const pagination = data?.pagination ?? {};
  const summary = data?.summary ?? {
    total_products: 0,
    fast_moving: 0,
    slow_moving: 0,
    dead_stock: 0,
    fast_moving_percentage: 0,
    slow_moving_percentage: 0,
    dead_stock_percentage: 0
  };

  useEffect(() => {
    setPage(1);
  }, [days, deferredSearch, velocityFilter]);

  if (isError) {
    return (
      <section className="table-card erp-page-main-card-joined">
        <div className="px-4 py-10 text-[11px] text-[#c62828]">
          Failed to load inventory movement analysis{error?.message ? `: ${error.message}` : "."}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="erp-page-section erp-page-section-joined">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <i className="fas fa-boxes-stacked text-[18px] text-[#90caf9]" />
            <div>
              <div className="erp-page-title">Inventory Movement Analysis</div>
              <div className="erp-page-description">Fast, slow, and dead-stock classification based on actual completed sales history.</div>
            </div>
          </div>
        </div>

        <div className="erp-page-filters">
          <div className="erp-filter-label">
            <i className="fas fa-filter mr-1" />
            Filters
          </div>

          <div className="relative min-w-[220px] flex-1 md:max-w-[320px]">
            <i className="fas fa-search pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search product or category..."
              className="erp-input pl-7"
            />
          </div>

          <div className="relative min-w-[160px]">
            <i className="fas fa-clock pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
            <select value={String(days)} onChange={(event) => setDays(Number(event.target.value))} className="erp-select pl-7">
              <option value="7">Last 7 Days</option>
              <option value="15">Last 15 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="60">Last 60 Days</option>
              <option value="90">Last 90 Days</option>
              <option value="180">Last 180 Days</option>
              <option value="365">Last 365 Days</option>
            </select>
          </div>

          <div className="relative min-w-[170px]">
            <i className="fas fa-signal pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
            <select value={velocityFilter} onChange={(event) => setVelocityFilter(event.target.value)} className="erp-select pl-7">
              <option value="">All Velocity</option>
              <option value="Fast">Fast Moving</option>
              <option value="Slow">Slow Moving</option>
              <option value="Dead">Dead Stock</option>
            </select>
          </div>
        </div>
      </section>

      <section className="table-card erp-page-main-card-joined">
        <div className="grid gap-3 border-b border-[#d7e3ec] bg-[#fbfdff] px-4 py-3 md:grid-cols-4">
          {[
            { label: "Products", value: summary.total_products, helper: "Visible after filters" },
            { label: "Fast Moving", value: summary.fast_moving, helper: `${summary.fast_moving_percentage}% of total` },
            { label: "Slow Moving", value: summary.slow_moving, helper: `${summary.slow_moving_percentage}% of total` },
            { label: "Dead Stock", value: summary.dead_stock, helper: `${summary.dead_stock_percentage}% of total` }
          ].map((card) => (
            <div key={card.label} className="erp-entity-card-panel">
              <div className="text-[10px] font-bold uppercase tracking-[0.4px] text-[#607d8b]">{card.label}</div>
              <div className="mt-1 text-[18px] font-bold text-[#1a3557]">
                {isLoading ? <Skeleton className="h-5 w-20" /> : card.value}
              </div>
              <div className="mt-1 text-[10px] text-[#607d8b]">{card.helper}</div>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className={`erp-table w-full min-w-[900px] ${isFetching ? "opacity-80" : ""}`}>
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th className="text-right">Current Stock</th>
                <th className="text-right">Units Sold</th>
                <th className="text-right">Revenue</th>
                <th className="text-center">Velocity</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <TableSkeleton rows={8}>
                  {(index) => (
                    <tr key={`velocity-sk-${index}`}>
                      <td><Skeleton className="h-3 w-32" /></td>
                      <td><Skeleton className="h-3 w-24" /></td>
                      <td><Skeleton className="ml-auto h-3 w-12" /></td>
                      <td><Skeleton className="ml-auto h-3 w-12" /></td>
                      <td><Skeleton className="ml-auto h-3 w-20" /></td>
                      <td><Skeleton className="mx-auto h-5 w-20" /></td>
                    </tr>
                  )}
                </TableSkeleton>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="erp-empty-state">No inventory movement rows found for the current filters.</div>
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id}>
                    <td className="font-bold text-[#1a3557]">{row.name}</td>
                    <td>{row.category || "Uncategorized"}</td>
                    <td className="text-right font-mono">{row.current_stock}</td>
                    <td className="text-right font-mono">{row.units_sold_period}</td>
                    <td className="text-right font-mono">{formatCurrency(row.revenue_period)}</td>
                    <td className="text-center">
                      <span className={`erp-status-badge ${velocityBadgeClass(row.velocity)}`}>
                        <span className="erp-status-badge-dot" />
                        {row.velocity}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={Number(pagination.page ?? 1)}
          lastPage={Number(pagination.pages ?? 1)}
          perPage={Number(pagination.limit ?? 12)}
          total={Number(pagination.total ?? 0)}
          itemLabel="products"
          loading={isFetching}
          onPrevious={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => current + 1)}
          onGoto={(target) => setPage(target)}
        />
      </section>
    </div>
  );
}
