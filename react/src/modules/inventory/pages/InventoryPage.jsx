import { useDeferredValue, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pagination } from "@/shared/components/common/Pagination";
import { Skeleton, TableSkeleton } from "@/shared/components/common/Skeleton";
import { useCategoryOptions } from "@/modules/categories/hooks/useCategoryOptions";
import { getInventoryOverview } from "@/modules/inventory/api/inventory.api";

const STOCK_STATUS_OPTIONS = [
  { value: "", label: "All Status" },
  { value: "in_stock", label: "In Stock" },
  { value: "low_stock", label: "Low Stock" },
  { value: "out_of_stock", label: "Out of Stock" }
];

const ROWS_PER_PAGE = 12;

function formatStatusLabel(status) {
  return status
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusBadgeClass(status) {
  switch (status) {
    case "in_stock":
      return "border-[#c2ddbe] bg-[#f3faf1] text-[#356b37]";
    case "low_stock":
      return "border-[#efd79a] bg-[#fff9ec] text-[#9a6a00]";
    case "out_of_stock":
      return "border-[#e6b8b8] bg-[#fff7f7] text-[#a44d4d]";
    default:
      return "border-[#b0bec5] bg-[#f3f6f9] text-[#607d8b]";
  }
}

function availableValueClass(available, reorderLevel) {
  if (available <= 0) {
    return "text-[#b3261e]";
  }

  if (available <= reorderLevel) {
    return "text-[#9a6a00]";
  }

  return "text-[#2f5d31]";
}

export function InventoryPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const deferredSearch = useDeferredValue(searchInput.trim().toLowerCase());

  const {
    data: inventoryResponse,
    isLoading,
    isError,
    error,
    isFetching,
    refetch
  } = useQuery({
    queryKey: ["inventory-overview", page, deferredSearch, selectedCategory, statusFilter],
    queryFn: () =>
      getInventoryOverview({
        page,
        perPage: ROWS_PER_PAGE,
        ...(deferredSearch ? { search: deferredSearch } : {}),
        ...(selectedCategory ? { categoryId: Number(selectedCategory) } : {}),
        ...(statusFilter ? { stockStatus: statusFilter } : {})
      })
  });

  const { data: categoriesResponse } = useCategoryOptions();

  const inventoryRows = inventoryResponse?.data ?? [];
  const categories = categoriesResponse?.data ?? [];
  const meta = inventoryResponse?.meta ?? {};
  const summary = meta.summary ?? {
    variantCount: 0,
    onHand: 0,
    reserved: 0,
    available: 0,
    in_stock: 0,
    low_stock: 0,
    out_of_stock: 0
  };
  const total = Number(meta.total ?? 0);
  const currentPage = Number(meta.currentPage ?? page);
  const lastPage = Number(meta.lastPage ?? 1);
  const activeFilters = Boolean(deferredSearch || selectedCategory || statusFilter);

  useEffect(() => {
    if (page !== currentPage) {
      setPage(currentPage);
    }
  }, [currentPage, page]);

  function clearFilters() {
    setPage(1);
    setSearchInput("");
    setSelectedCategory("");
    setStatusFilter("");
  }

  function handleRefresh() {
    refetch();
  }

  return (
    <div className="space-y-4">
      <section className="erp-page-section erp-page-section-joined">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <i className="fas fa-warehouse text-[18px] text-[#90caf9]" />
            <div>
              <div className="erp-page-title">Inventory Overview</div>
              <div className="erp-page-description">Variant-level stock, reservations, availability, and reorder visibility</div>
            </div>
          </div>

          <button type="button" onClick={handleRefresh} className="erp-header-secondary-button" disabled={isFetching}>
            <i className={`fas mr-1.5 ${isFetching ? "fa-spinner fa-spin" : "fa-rotate-right"}`} />
            {isFetching ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="erp-page-filters">
          <div className="erp-filter-label">
            <i className="fas fa-filter mr-1" />
            Filters
          </div>

          <div className="relative min-w-[220px] flex-1 md:max-w-[340px]">
            <i className="fas fa-search pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
            <input
              value={searchInput}
              onChange={(event) => {
                setPage(1);
                setSearchInput(event.target.value);
              }}
              placeholder="Search product or variant..."
              className="erp-input pl-7"
            />
          </div>

          <div className="relative min-w-[180px]">
            <i className="fas fa-tag pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
            <select
              value={selectedCategory}
              onChange={(event) => {
                setPage(1);
                setSelectedCategory(event.target.value);
              }}
              className="erp-select pl-7"
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={String(category.id)}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="relative min-w-[180px]">
            <i className="fas fa-signal pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
            <select
              value={statusFilter}
              onChange={(event) => {
                setPage(1);
                setStatusFilter(event.target.value);
              }}
              className="erp-select pl-7"
            >
              {STOCK_STATUS_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button type="button" onClick={clearFilters} className="erp-filter-clear-button">
            <i className="fas fa-times mr-1" />
            Clear
          </button>
        </div>
      </section>

      <div className="erp-form-stack">
        <section className="table-card erp-page-main-card-joined">
          {isError ? (
            <div className="px-4 py-10 text-[11px] text-[#c62828]">
              Failed to load inventory overview{error?.message ? `: ${error.message}` : "."}
            </div>
          ) : (
            <>
              <div className="grid gap-3 border-b border-[#d7e3ec] bg-[#fbfdff] px-4 py-3 md:grid-cols-5">
                <div className="erp-entity-card-panel">
                  <div className="text-[10px] font-bold uppercase tracking-[0.4px] text-[#607d8b]">Variants</div>
                  <div className="mt-1 text-[18px] font-bold text-[#1a3557]">
                    {isLoading ? <Skeleton className="h-5 w-16" /> : summary.variantCount}
                  </div>
                </div>
                <div className="erp-entity-card-panel">
                  <div className="text-[10px] font-bold uppercase tracking-[0.4px] text-[#607d8b]">On Hand</div>
                  <div className="mt-1 text-[18px] font-bold text-[#1a3557]">
                    {isLoading ? <Skeleton className="h-5 w-20" /> : summary.onHand}
                  </div>
                </div>
                <div className="erp-entity-card-panel">
                  <div className="text-[10px] font-bold uppercase tracking-[0.4px] text-[#607d8b]">Reserved</div>
                  <div className="mt-1 text-[18px] font-bold text-[#5f7486]">
                    {isLoading ? <Skeleton className="h-5 w-20" /> : summary.reserved}
                  </div>
                </div>
                <div className="erp-entity-card-panel">
                  <div className="text-[10px] font-bold uppercase tracking-[0.4px] text-[#607d8b]">Available</div>
                  <div className="mt-1 text-[18px] font-bold text-[#1a3557]">
                    {isLoading ? <Skeleton className="h-5 w-20" /> : summary.available}
                  </div>
                </div>
                <div className="erp-entity-card-panel">
                  <div className="text-[10px] font-bold uppercase tracking-[0.4px] text-[#607d8b]">Risk Items</div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-[#607d8b]">
                    {isLoading ? (
                      <Skeleton className="h-6 w-24" />
                    ) : (
                      <>
                        <span className="erp-status-badge border-[#e6b8b8] bg-[#fff7f7] text-[#a44d4d]">
                          <span className="erp-status-badge-dot" />
                          {summary.out_of_stock}
                        </span>
                        <span className="erp-status-badge border-[#efd79a] bg-[#fff9ec] text-[#9a6a00]">
                          <span className="erp-status-badge-dot" />
                          {summary.low_stock}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className={`erp-table w-full min-w-[960px] ${isLoading ? "opacity-70" : ""}`}>
                  <thead>
                    <tr>
                      <th className="w-[68px]">#</th>
                      <th>Product</th>
                      <th className="!text-right">On Hand</th>
                      <th className="!text-right">Reserved</th>
                      <th className="!text-right">Available</th>
                      <th className="!text-right">Level</th>
                      <th className="!text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <TableSkeleton rows={8}>
                        {(index) => (
                          <tr key={`inventory-sk-${index}`}>
                            <td><Skeleton className="h-3 w-10" /></td>
                            <td><Skeleton className="h-3 w-48" /></td>
                            <td><Skeleton className="ml-auto h-3 w-14" /></td>
                            <td><Skeleton className="ml-auto h-3 w-14" /></td>
                            <td><Skeleton className="ml-auto h-3 w-14" /></td>
                            <td><Skeleton className="ml-auto h-3 w-14" /></td>
                            <td><Skeleton className="mx-auto h-5 w-20" /></td>
                          </tr>
                        )}
                      </TableSkeleton>
                    ) : inventoryRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12">
                          <div className="flex flex-col items-center text-center">
                            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#edf5fb] text-[#90a4ae]">
                              <i className="fas fa-box-open text-[24px]" />
                            </div>
                            <div className="text-[14px] font-bold text-[#546e7a]">No inventory rows found</div>
                            <div className="mt-1 text-[12px] text-[#90a4ae]">
                              {activeFilters ? "Adjust your filters to widen the result." : "No active product variants were found."}
                            </div>
                            {activeFilters ? (
                              <button type="button" onClick={clearFilters} className="erp-button-secondary mt-4">
                                Clear Filters
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ) : (
                      inventoryRows.map((row, index) => (
                        <tr key={row.id}>
                          <td className="font-mono text-[11px] text-[#90a4ae]">
                            {(currentPage - 1) * ROWS_PER_PAGE + index + 1}
                          </td>
                          <td>
                            <div className="font-semibold text-[#1a3557]">{row.label}</div>
                            <div className="mt-0.5 text-[11px] text-[#78909c]">{row.categoryName}</div>
                          </td>
                          <td className="text-right font-mono font-semibold text-[#1a3557]">{row.onHand}</td>
                          <td className="text-right font-mono text-[#607d8b]">{row.reserved}</td>
                          <td className={`text-right font-mono font-semibold ${availableValueClass(row.available, row.reorderLevel)}`}>
                            {row.available}
                          </td>
                          <td className="text-right font-mono text-[#607d8b]">{row.reorderLevel}</td>
                          <td className="text-center">
                            <span className={`erp-status-badge ${statusBadgeClass(row.stockStatus)}`}>
                              <span className="erp-status-badge-dot" />
                              {formatStatusLabel(row.stockStatus)}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <Pagination
                currentPage={currentPage}
                lastPage={lastPage}
                perPage={ROWS_PER_PAGE}
                total={total}
                itemLabel="variants"
                loading={isFetching}
                onPrevious={() => setPage(Math.max(1, currentPage - 1))}
                onNext={() => setPage(Math.min(lastPage, currentPage + 1))}
                onGoto={(nextPage) => setPage(nextPage)}
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
