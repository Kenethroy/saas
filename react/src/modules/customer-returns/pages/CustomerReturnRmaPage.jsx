import { useDeferredValue, useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Pagination } from "@/shared/components/common/Pagination";
import { Skeleton, TableSkeleton } from "@/shared/components/common/Skeleton";
import { useNotification } from "@/shared/hooks/useNotification";
import { getCustomerReturns } from "../api/customer-returns.api";

const statusOptions = [
  { value: "", label: "All Status" },
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending Review" },
  { value: "approved", label: "Approved" },
  { value: "completed", label: "Completed" },
  { value: "rejected", label: "Rejected" }
];

const reasonOptions = [
  { value: "", label: "All Reasons" },
  { value: "Damaged", label: "Damaged" },
  { value: "Defective", label: "Defective" },
  { value: "Wrong Item", label: "Wrong Item" },
  { value: "Over Shipment", label: "Over Shipment" },
  { value: "Quality Issue", label: "Quality Issue" },
  { value: "Customer Changed Mind", label: "Customer Changed Mind" }
];

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

function statusBadgeClass(status) {
  switch (status) {
    case "draft":
      return "border-[#b0bec5] bg-[#f3f6f9] text-[#607d8b]";
    case "pending":
      return "border-[#ffe082] bg-[#fff8e1] text-[#f57f17]";
    case "approved":
      return "border-[#90caf9] bg-[#eef5fa] text-[#0070b8]";
    case "completed":
      return "border-[#a5d6a7] bg-[#e8f5e9] text-[#2e7d32]";
    case "rejected":
      return "border-[#ef9a9a] bg-[#fff5f5] text-[#c62828]";
    default:
      return "border-[#b0bec5] bg-[#f3f6f9] text-[#607d8b]";
  }
}

function statusLabel(status) {
  if (!status) {
    return "Unknown";
  }

  if (status === "pending") {
    return "Pending Review";
  }

  return status
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function CustomerReturnRmaPage() {
  const navigate = useNavigate();
  const notify = useNotification();
  const [searchParams] = useSearchParams();
  const externalSearch = (searchParams.get("search") ?? "").trim();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState(externalSearch);
  const [statusFilter, setStatusFilter] = useState("");
  const [reasonFilter, setReasonFilter] = useState("");
  const deferredSearch = useDeferredValue(searchInput.trim());

  const {
    data: customerReturnsResponse,
    isLoading,
    isError,
    error,
    isFetching
  } = useQuery({
    queryKey: ["customer-returns", page, deferredSearch, statusFilter, reasonFilter],
    queryFn: () =>
      getCustomerReturns({
        page,
        perPage: 10,
        ...(deferredSearch ? { search: deferredSearch } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(reasonFilter ? { reason: reasonFilter } : {})
      }),
    placeholderData: keepPreviousData
  });

  const data = customerReturnsResponse?.data ?? { items: [], total: 0, lastPage: 1 };

  useEffect(() => {
    setPage(1);
    setSearchInput(externalSearch);
  }, [externalSearch]);

  function clearFilters() {
    setPage(1);
    setSearchInput("");
    setStatusFilter("");
    setReasonFilter("");
  }

  return (
    <div className="space-y-4">
      <section className="erp-page-section">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <i className="fas fa-rotate-left text-[18px] text-[#90caf9]" />
            <div>
              <div className="erp-page-title">Customer Returns</div>
              <div className="erp-page-description">
                Customer RMA requests, invoice matching, and credit or replacement disposition tracking.
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => notify.info("Customer return export is not wired yet in React.")}
              className="erp-header-secondary-button"
            >
              <i className="fas fa-download mr-1.5" />
              Export
            </button>
            <button
              type="button"
              className="erp-header-primary-button"
              onClick={() => navigate("/admin/customer-returns/create")}
            >
              <i className="fas fa-plus mr-1.5" />
              New RMA Request
            </button>
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
              onChange={(event) => {
                setPage(1);
                setSearchInput(event.target.value);
              }}
              placeholder="Search RMA no., invoice, or customer..."
              className="erp-input pl-7"
            />
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
              {statusOptions.map((option) => (
                <option key={option.value || "all-status"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="relative min-w-[180px]">
            <i className="fas fa-triangle-exclamation pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
            <select
              value={reasonFilter}
              onChange={(event) => {
                setPage(1);
                setReasonFilter(event.target.value);
              }}
              className="erp-select pl-7"
            >
              {reasonOptions.map((option) => (
                <option key={option.value || "all-reasons"} value={option.value}>
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

      {isError ? (
        <section className="rounded-sm border border-[#ef9a9a] bg-[#fff5f5] px-4 py-3 text-[11px] text-[#c62828]">
          Failed to load customer returns{error?.message ? `: ${error.message}` : "."}
        </section>
      ) : null}

      <section className="table-card">
        <div className="overflow-x-auto">
          <table className={`erp-table w-full min-w-[1080px] ${isLoading ? "opacity-70" : ""}`}>
            <thead>
              <tr>
                <th>RMA No.</th>
                <th>Customer</th>
                <th>Sales Invoice</th>
                <th>Request Date</th>
                <th>Reason</th>
                <th>Items</th>
                <th>Total Value</th>
                <th>Disposition</th>
                <th className="!text-center">Status</th>
                <th className="!text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <TableSkeleton rows={8}>
                  {(index) => (
                    <tr key={`customer-return-sk-${index}`}>
                      <td><Skeleton className="h-3 w-24" /></td>
                      <td><Skeleton className="h-3 w-28" /></td>
                      <td><Skeleton className="h-3 w-24" /></td>
                      <td><Skeleton className="h-3 w-20" /></td>
                      <td><Skeleton className="h-3 w-20" /></td>
                      <td><Skeleton className="h-3 w-10" /></td>
                      <td><Skeleton className="h-3 w-24" /></td>
                      <td><Skeleton className="h-3 w-20" /></td>
                      <td><Skeleton className="mx-auto h-4 w-20" /></td>
                      <td><Skeleton className="ml-auto h-8 w-20" /></td>
                    </tr>
                  )}
                </TableSkeleton>
              ) : data.items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-0">
                    <div className="erp-empty-state">No customer return requests found for the current filters.</div>
                  </td>
                </tr>
              ) : (
                data.items.map((record) => (
                  <tr key={record.id}>
                    <td className="font-mono font-bold text-[#0070b8]">{record.rmaNumber}</td>
                    <td>{record.customerName}</td>
                    <td className="font-mono text-muted">{record.salesInvoice}</td>
                    <td>{formatDate(record.requestDate)}</td>
                    <td>{record.reason}</td>
                    <td>{record.itemCount}</td>
                    <td className="font-bold text-[#1a3557]">{formatMoney(record.totalAmount)}</td>
                    <td>{record.disposition}</td>
                    <td className="text-center">
                      <span className={`erp-status-badge ${statusBadgeClass(record.status)}`}>
                        <span className="erp-status-badge-dot" />
                        {statusLabel(record.status)}
                      </span>
                    </td>
                    <td>
                      <div className="erp-row-actions">
                        <button
                          type="button"
                          className="erp-icon-button-md"
                          title="View RMA"
                          onClick={() => notify.info("Customer return detail view is not wired yet in React.")}
                        >
                          <i className="fas fa-eye text-[11px]" />
                        </button>
                        <button
                          type="button"
                          className="erp-icon-button-warning-md"
                          title="Edit RMA"
                          onClick={() => notify.info("Customer return editing is not wired yet in React.")}
                        >
                          <i className="fas fa-pen text-[11px]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={page}
          lastPage={data.lastPage}
          perPage={10}
          total={data.total}
          itemLabel="rma records"
          loading={isFetching}
          onPrevious={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => Math.min(data.lastPage, current + 1))}
          onGoto={(targetPage) => setPage(targetPage)}
        />
      </section>
    </div>
  );
}
