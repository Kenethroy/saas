import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pagination } from "@/shared/components/common/Pagination";
import { Skeleton, TableSkeleton } from "@/shared/components/common/Skeleton";
import { getInventoryTransactions } from "@/modules/inventory/api/inventory.api";

export function StockMovementLogsPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const deferredSearch = useDeferredValue(searchInput.trim());
  const [transactionType, setTransactionType] = useState("");
  const [referenceType, setReferenceType] = useState("");

  const filters = useMemo(() => {
    const next = {
      page,
      perPage: 25,
      sortOrder: "desc"
    };

    if (deferredSearch) {
      next.search = deferredSearch;
    }

    if (transactionType) {
      next.transactionType = Number(transactionType);
    }

    if (referenceType.trim()) {
      next.referenceType = referenceType.trim();
    }

    return next;
  }, [deferredSearch, page, referenceType, transactionType]);

  const {
    data: response,
    isLoading,
    isError,
    error,
    isFetching,
    refetch
  } = useQuery({
    queryKey: ["inventory-transactions", filters],
    queryFn: () => getInventoryTransactions(filters)
  });

  const rows = response?.data ?? [];
  const meta = response?.meta ?? {};
  const total = Number(meta.total ?? 0);
  const currentPage = Number(meta.currentPage ?? page);
  const lastPage = Number(meta.lastPage ?? 1);
  const activeFilters = Boolean(deferredSearch || transactionType || referenceType.trim());

  useEffect(() => {
    if (page !== currentPage) {
      setPage(currentPage);
    }
  }, [currentPage, page]);

  function clearFilters() {
    setPage(1);
    setSearchInput("");
    setTransactionType("");
    setReferenceType("");
  }

  function handleRefresh() {
    refetch();
  }

  function formatDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function resolveTypeLabel(type) {
    switch (Number(type)) {
      case 1:
        return "Purchase";
      case 2:
        return "Sale";
      case 3:
        return "Adjustment";
      case 4:
        return "Return";
      default:
        return `Type ${type}`;
    }
  }

  function changePill(change) {
    const numeric = Number(change ?? 0);
    const isPositive = numeric > 0;
    const isNegative = numeric < 0;

    const base = "inline-flex items-center rounded-sm border px-2 py-0.5 text-[10px] font-bold font-mono";
    if (isPositive) return `${base} border-[#c2ddbe] bg-[#f3faf1] text-[#356b37]`;
    if (isNegative) return `${base} border-[#e6b8b8] bg-[#fff7f7] text-[#a44d4d]`;
    return `${base} border-[#b0bec5] bg-[#f3f6f9] text-[#607d8b]`;
  }

  return (
    <div className="space-y-4">
      <section className="erp-page-section erp-page-section-joined">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <i className="fas fa-right-left text-[18px] text-[#90caf9]" />
            <div>
              <div className="erp-page-title">Stock Movement Logs</div>
              <div className="erp-page-description">Inbound, outbound, and adjustment history for stock traceability</div>
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

          <div className="relative min-w-[220px] flex-1 md:max-w-[360px]">
            <i className="fas fa-search pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
            <input
              value={searchInput}
              onChange={(event) => {
                setPage(1);
                setSearchInput(event.target.value);
              }}
              placeholder="Search product, variant, reference, or reason..."
              className="erp-input pl-7"
            />
          </div>

          <div className="relative min-w-[170px]">
            <i className="fas fa-arrow-right-arrow-left pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-[#90a4ae]" />
            <select
              value={transactionType}
              onChange={(event) => {
                setPage(1);
                setTransactionType(event.target.value);
              }}
              className="erp-select pl-7"
            >
              <option value="">All Types</option>
              <option value="1">Purchase</option>
              <option value="2">Sale</option>
              <option value="3">Adjustment</option>
              <option value="4">Return</option>
            </select>
          </div>

          <div className="relative min-w-[180px]">
            <i className="fas fa-file-lines pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-[#90a4ae]" />
            <input
              value={referenceType}
              onChange={(event) => {
                setPage(1);
                setReferenceType(event.target.value);
              }}
              placeholder="Reference type..."
              className="erp-input pl-7"
            />
          </div>

          {activeFilters ? (
            <button type="button" onClick={clearFilters} className="erp-button-secondary">
              Clear
            </button>
          ) : null}
        </div>

        <section className="erp-page-main-card">
          {isError ? (
            <div className="rounded-sm border border-[#ef9a9a] bg-[#fff5f5] px-4 py-3 text-[11px] text-[#c62828]">
              Failed to load movement logs{error?.response?.data?.message ? `: ${error.response.data.message}` : "."}
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between gap-2 border-b border-[#e3ebf1] pb-2.5">
                <div className="flex items-center gap-2">
                  <i className="fas fa-list text-[13px] text-[#0070b8]" />
                  <p className="text-[13px] font-bold text-[#1a3557]">Transactions</p>
                </div>
                <p className="text-[10px] text-[#90a4ae]">
                  {isFetching && !isLoading ? "Updating…" : `${total} total`}
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className={`erp-table w-full min-w-[1100px] ${isLoading ? "opacity-70" : ""}`}>
                  <thead>
                    <tr>
                      <th className="w-[190px]">Date</th>
                      <th>Product</th>
                      <th className="w-[120px]">Type</th>
                      <th className="w-[190px]">Reference</th>
                      <th className="!text-right w-[110px]">Before</th>
                      <th className="!text-right w-[120px]">Change</th>
                      <th className="!text-right w-[110px]">After</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <TableSkeleton rows={10}>
                        {(index) => (
                          <tr key={`txn-sk-${index}`}>
                            <td><Skeleton className="h-3 w-32" /></td>
                            <td><Skeleton className="h-3 w-56" /></td>
                            <td><Skeleton className="h-3 w-20" /></td>
                            <td><Skeleton className="h-3 w-40" /></td>
                            <td><Skeleton className="ml-auto h-3 w-12" /></td>
                            <td><Skeleton className="ml-auto h-3 w-14" /></td>
                            <td><Skeleton className="ml-auto h-3 w-12" /></td>
                            <td><Skeleton className="h-3 w-60" /></td>
                          </tr>
                        )}
                      </TableSkeleton>
                    ) : rows.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12">
                          <div className="flex flex-col items-center text-center">
                            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#edf5fb] text-[#90a4ae]">
                              <i className="fas fa-right-left text-[22px]" />
                            </div>
                            <div className="text-[14px] font-bold text-[#546e7a]">No movement logs found</div>
                            <div className="mt-1 text-[12px] text-[#90a4ae]">
                              {activeFilters ? "Adjust your filters to widen the result." : "No inventory transactions have been recorded yet."}
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
                      rows.map((row) => {
                        const label = row.variantName
                          ? `${row.productName ?? "Product"} ${row.variantName}`
                          : row.productName ?? "Product";
                        const change = Number(row.quantityChange ?? 0);

                        return (
                          <tr key={row.id}>
                            <td className="font-mono text-[11px] text-[#90a4ae]">{formatDateTime(row.createdAt)}</td>
                            <td>
                              <div className="font-semibold text-[#1a3557]">{label}</div>
                              <div className="mt-0.5 text-[11px] text-[#78909c]">Variant #{row.productVariantId}</div>
                            </td>
                            <td>
                              <span className="erp-status-badge border-[#b0bec5] bg-[#f3f6f9] text-[#607d8b]">
                                <span className="erp-status-badge-dot" />
                                {resolveTypeLabel(row.transactionType)}
                              </span>
                            </td>
                            <td className="text-[11px] text-[#607d8b]">
                              {row.referenceType ? (
                                <div className="space-y-0.5">
                                  <div className="font-mono">{row.referenceType}</div>
                                  <div className="font-mono text-[#90a4ae]">#{row.referenceId ?? "-"}</div>
                                </div>
                              ) : (
                                <span className="italic text-[#90a4ae]">-</span>
                              )}
                            </td>
                            <td className="text-right font-mono text-[#607d8b]">{row.quantityBefore}</td>
                            <td className="text-right">
                              <span className={changePill(change)}>{change > 0 ? `+${change}` : String(change)}</span>
                            </td>
                            <td className="text-right font-mono font-semibold text-[#1a3557]">{row.quantityAfter}</td>
                            <td className="text-[11px] text-[#546e7a]">{row.reason || <span className="italic text-[#90a4ae]">-</span>}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <Pagination
                currentPage={currentPage}
                lastPage={lastPage}
                perPage={25}
                total={total}
                itemLabel="transactions"
                loading={isFetching}
                onPrevious={() => setPage(Math.max(1, currentPage - 1))}
                onNext={() => setPage(Math.min(lastPage, currentPage + 1))}
                onGoto={(nextPage) => setPage(nextPage)}
              />
            </>
          )}
        </section>
      </section>
    </div>
  );
}
