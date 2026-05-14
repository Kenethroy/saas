import { useDeferredValue, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Pagination } from "@/shared/components/common/Pagination";
import { Skeleton, TableSkeleton } from "@/shared/components/common/Skeleton";
import { getAccountsPayable } from "@/modules/accounts-payable/api/accounts-payable.api";
import { RecordSupplierPaymentModal } from "@/modules/accounts-payable/components/RecordSupplierPaymentModal";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(value ?? 0));
}

function formatDate(value) {
  if (!value) return "N/A";
  return new Intl.DateTimeFormat("en-PH", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

function isOverdue(record) {
  if (!record.dueDate || record.status === "paid") return false;
  return new Date(record.dueDate) < new Date();
}

export function AccountsPayablePage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState(null);
  const deferredSearch = useDeferredValue(searchInput.trim());

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["accounts-payable", page, deferredSearch, statusFilter, overdueOnly],
    queryFn: () =>
      getAccountsPayable({
        page,
        perPage: 15,
        search: deferredSearch,
        status: statusFilter,
        overdue: overdueOnly ? "true" : undefined
      }),
    placeholderData: keepPreviousData,
    staleTime: 30_000
  });

  const records = data?.data ?? [];
  const meta = data?.meta;

  function clearFilters() {
    setPage(1);
    setSearchInput("");
    setStatusFilter("");
    setOverdueOnly(false);
  }

  return (
    <div className="space-y-4">
      {/* Header + Filters */}
      <section className="erp-page-section erp-page-section-joined">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <i className="fas fa-wallet text-[18px] text-[#90caf9]" />
            <div>
              <div className="erp-page-title">Accounts Payable</div>
              <div className="erp-page-description">
                Supplier payables generated from received Purchase Orders.
              </div>
            </div>
          </div>
        </div>

        <div className="erp-page-filters">
          <div className="erp-filter-label">
            <i className="fas fa-filter mr-1" />
            Filters
          </div>

          {/* Search */}
          <div className="relative min-w-[220px] flex-1 md:max-w-[320px]">
            <i className="fas fa-search pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
            <input
              id="ap-search"
              value={searchInput}
              onChange={(e) => { setPage(1); setSearchInput(e.target.value); }}
              placeholder="Search supplier or PO number…"
              className="erp-input pl-7 text-[11px]"
            />
          </div>

          {/* Status */}
          <div className="relative min-w-[140px]">
            <i className="fas fa-signal pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
            <select
              id="ap-status-filter"
              value={statusFilter}
              onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
              className="erp-select pl-7"
            >
              <option value="">All Status</option>
              <option value="unpaid">Unpaid</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
            </select>
          </div>

          {/* Overdue toggle */}
          <label htmlFor="ap-overdue" className="flex cursor-pointer items-center gap-1.5 select-none text-[11px] font-bold text-[#546e7a]">
            <input
              id="ap-overdue"
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => { setPage(1); setOverdueOnly(e.target.checked); }}
              className="h-[14px] w-[14px] accent-[#0070b8]"
            />
            Overdue Only
          </label>

          <button type="button" onClick={clearFilters} className="erp-filter-clear-button">
            <i className="fas fa-times mr-1" />
            Clear
          </button>

          {isFetching && !isLoading && (
            <span className="text-[10px] text-[#90a4ae]">
              <i className="fas fa-spinner fa-spin mr-1" />Refreshing…
            </span>
          )}
        </div>
      </section>

      {/* Table */}
      <section className="table-card erp-page-main-card-joined">
        {isError ? (
          <div className="px-4 py-10 text-[11px] text-[#c62828]">
            Failed to load payable records{error?.message ? `: ${error.message}` : "."}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className={`erp-table w-full ${isLoading ? "opacity-70" : ""}`}>
                <thead>
                  <tr>
                    <th className="w-[60px] text-center">Ref ID</th>
                    <th className="min-w-[120px]">PO Number</th>
                    <th className="min-w-[180px]">Supplier</th>
                    <th className="w-[110px]">Receipt Date</th>
                    <th className="w-[110px]">Due Date</th>
                    <th className="w-[120px] text-right">Amount</th>
                    <th className="w-[120px] text-right">Outstanding</th>
                    <th className="w-[90px] text-center">Status</th>
                    <th className="w-[110px] text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <TableSkeleton rows={8}>
                      {(index) => (
                        <tr key={`ap-sk-${index}`}>
                          <td><Skeleton className="mx-auto h-3 w-8" /></td>
                          <td><Skeleton className="h-3 w-24" /></td>
                          <td>
                            <div className="space-y-1.5">
                              <Skeleton className="h-3 w-32" />
                              <Skeleton className="h-2.5 w-20" />
                            </div>
                          </td>
                          <td><Skeleton className="h-3 w-20" /></td>
                          <td><Skeleton className="h-3 w-20" /></td>
                          <td><Skeleton className="ml-auto h-3 w-20" /></td>
                          <td><Skeleton className="ml-auto h-3 w-20" /></td>
                          <td><Skeleton className="mx-auto h-4 w-14" /></td>
                          <td><Skeleton className="mx-auto h-8 w-20" /></td>
                        </tr>
                      )}
                    </TableSkeleton>
                  ) : records.length === 0 ? (
                    <tr>
                      <td colSpan={9}>
                        <div className="erp-empty-state">
                          {deferredSearch || statusFilter || overdueOnly
                            ? "No matching payable records found."
                            : "No accounts payable records yet. They are auto-created when a Purchase Order is marked as Received."}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    records.map((record) => {
                      const overdue = isOverdue(record);
                      return (
                        <tr key={record.id} className={overdue ? "bg-[#fff5f5]" : undefined}>
                          <td className="text-center font-mono text-[11px] text-muted">{record.id}</td>
                          <td>
                            <span className="font-mono font-bold text-ink">{record.poNumber}</span>
                          </td>
                          <td>
                            <p className="font-bold text-ink">{record.supplierName}</p>
                            {record.supplierCompany && (
                              <p className="mt-0.5 truncate text-[11px] italic text-muted" title={record.supplierCompany}>
                                {record.supplierCompany}
                              </p>
                            )}
                          </td>
                          <td className="text-[11px] text-muted">{formatDate(record.receiptDate)}</td>
                          <td>
                            {record.dueDate ? (
                              <span className={`text-[11px] font-bold ${overdue ? "text-[#c62828]" : "text-muted"}`}>
                                {overdue && <i className="fas fa-triangle-exclamation mr-1" />}
                                {formatDate(record.dueDate)}
                                {overdue && <div className="text-[9px] font-bold text-[#c62828]">OVERDUE</div>}
                              </span>
                            ) : (
                              <span className="text-[11px] text-muted">—</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap text-right font-mono font-bold text-ink">
                            {formatCurrency(record.amount)}
                          </td>
                          <td className="whitespace-nowrap text-right font-mono font-bold text-[#c62828]">
                            {formatCurrency(record.outstandingAmount)}
                          </td>
                          <td className="text-center">
                            <span
                              className={`erp-chip ${
                                record.status === "paid"
                                  ? "border-[#a5d6a7] bg-[#e8f5e9] text-[#2e7d32]"
                                  : record.status === "partial"
                                  ? "border-[#fff59d] bg-[#fffde7] text-[#f57f17]"
                                  : "border-[#ef9a9a] bg-[#ffebee] text-[#c62828]"
                              }`}
                            >
                              {record.status}
                            </span>
                          </td>
                          <td>
                            <div className="flex items-center justify-center">
                              <button
                                type="button"
                                onClick={() => setPaymentTarget(record)}
                                className="erp-icon-button-md"
                                title="Record supplier payment"
                                disabled={record.status === "paid" || Number(record.outstandingAmount ?? 0) <= 0}
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

            {!isLoading && meta?.total > 0 && (
              <Pagination
                currentPage={meta.currentPage}
                lastPage={meta.lastPage}
                perPage={meta.perPage}
                total={meta.total}
                itemLabel="payables"
                loading={isFetching}
                onPrevious={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => Math.min(meta.lastPage, p + 1))}
                onGoto={(targetPage) => setPage(targetPage)}
              />
            )}
          </>
        )}
      </section>

      <RecordSupplierPaymentModal
        show={Boolean(paymentTarget)}
        record={paymentTarget}
        onClose={() => setPaymentTarget(null)}
      />
    </div>
  );
}
