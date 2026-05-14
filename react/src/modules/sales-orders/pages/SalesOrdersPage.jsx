import { useDeferredValue, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Pagination } from "@/shared/components/common/Pagination";
import { Skeleton, TableSkeleton } from "@/shared/components/common/Skeleton";
import { StatusUpdateModal } from "@/shared/components/common/StatusUpdateModal";
import { useNotification } from "@/shared/hooks/useNotification";
import { getSalesOrders, updateSalesOrderStatus } from "@/modules/sales-orders/api/sales-orders.api";
import { canEditSalesOrder, getAllowedSalesOrderStatuses } from "@/modules/sales-orders/utils/status";

const statusOptions = [
  { value: "", label: "All Status" },
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "for_delivery", label: "For Delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" }
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

function statusLabel(status) {
  return status
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusBadgeClass(status) {
  switch (status) {
    case "pending":
      return "border-[#efd79a] bg-[#fff9ec] text-[#9a6a00]";
    case "processing":
      return "border-[#b8d4ea] bg-[#f4f9fd] text-[#1d6fa5]";
    case "for_delivery":
      return "border-[#d7c1e4] bg-[#faf5fc] text-[#7c4aa5]";
    case "delivered":
      return "border-[#b7ddd8] bg-[#f2fbf8] text-[#1c7e73]";
    case "completed":
      return "border-[#c2ddbe] bg-[#f3faf1] text-[#356b37]";
    case "cancelled":
      return "border-[#e6b8b8] bg-[#fff7f7] text-[#a44d4d]";
    default:
      return "border-[#b0bec5] bg-[#f3f6f9] text-[#607d8b]";
  }
}

function statusChangeHint(status) {
  switch (status) {
    case "processing":
      return {
        tone: "info",
        message: "Use when fulfillment has started. Available stock after processing reservations will be checked before this status is saved."
      };
    case "for_delivery":
      return {
        tone: "info",
        message: "This will open Delivery creation and assign the sales order there."
      };
    case "delivered":
      return {
        tone: "success",
        message: "Use after the goods have been received by the customer."
      };
    case "completed":
      return {
        tone: "success",
        message: "This finalizes the order and locks further workflow changes."
      };
    case "cancelled":
      return {
        tone: "error",
        message: "Use only when the order should no longer proceed. This is treated as a terminal state."
      };
    default:
      return {
        tone: "info",
        message: "Select the next valid workflow state for this sales order."
      };
  }
}

export function SalesOrdersPage() {
  const navigate = useNavigate();
  const notify = useNotification();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [statusModal, setStatusModal] = useState(null);
  const deferredSearch = useDeferredValue(searchInput.trim());

  const { data: salesOrdersResponse, isLoading: isSalesOrdersLoading, isError, error, isFetching } = useQuery({
    queryKey: ["sales-orders", page, deferredSearch, statusFilter],
    queryFn: () =>
      getSalesOrders({
        page,
        perPage: 10,
        ...(deferredSearch ? { search: deferredSearch } : {}),
        ...(statusFilter ? { status: statusFilter } : {})
      }),
    placeholderData: keepPreviousData
  });

  const salesOrders = salesOrdersResponse?.data ?? [];
  const meta = salesOrdersResponse?.meta;
  const statusModalOptions = statusModal
    ? statusOptions.filter((option) => option.value && getAllowedSalesOrderStatuses(statusModal.currentStatus).includes(option.value))
    : [];
  const selectedStatusHint = statusModal ? statusChangeHint(statusModal.nextStatus) : statusChangeHint();

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => updateSalesOrderStatus(id, status),
    onSuccess: async (_response, variables) => {
      notify.success(`Sales order marked as ${statusLabel(variables.status).toLowerCase()}.`);
      setStatusModal(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sales-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["sales-order", Number(variables.id)] }),
        queryClient.invalidateQueries({ queryKey: ["sales-order", String(variables.id)] })
      ]);
    },
    onError: (mutationError) => {
      notify.error(mutationError?.response?.data?.message ?? "Failed to update sales order status.");
    }
  });

  function clearFilters() {
    setPage(1);
    setSearchInput("");
    setStatusFilter("");
  }

  return (
    <div className="space-y-4">
      <section className="erp-page-section">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <i className="fas fa-file-invoice text-[18px] text-[#90caf9]" />
            <div>
              <div className="erp-page-title">Sales Orders</div>
              <div className="erp-page-description">Order register and sales order creation workflow</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/sales-orders/create")}
            className="erp-header-primary-button"
          >
            <i className="fas fa-plus mr-1.5" />
            Create Sales Order
          </button>
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
              placeholder="Search sales orders..."
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
              {statusOptions.map((status) => (
                <option key={status.value || "all"} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={clearFilters}
            className="erp-filter-clear-button"
          >
            <i className="fas fa-times mr-1" />
            Clear
          </button>
        </div>
      </section>

      <section className="table-card">
        {isError ? (
          <div className="px-4 py-10 text-[11px] text-[#c62828]">
            Failed to load sales orders{error?.message ? `: ${error.message}` : "."}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className={`erp-table w-full min-w-[1060px] ${isSalesOrdersLoading ? "opacity-70" : ""}`}>
                <thead>
                  <tr>
                    <th>SO Number</th>
                    <th>Customer</th>
                    <th>Order Date</th>
                    <th>Agent</th>
                    <th>Total Amount</th>
                    <th className="!text-center">Status</th>
                    <th>Updated</th>
                    <th className="!text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isSalesOrdersLoading ? (
                    <TableSkeleton rows={8}>
                      {(index) => (
                        <tr key={`so-sk-${index}`}>
                          <td><Skeleton className="h-3 w-24" /></td>
                          <td><Skeleton className="h-3 w-28" /></td>
                          <td><Skeleton className="h-3 w-20" /></td>
                          <td><Skeleton className="h-3 w-24" /></td>
                          <td><Skeleton className="h-3 w-20" /></td>
                          <td><Skeleton className="mx-auto h-4 w-16" /></td>
                          <td><Skeleton className="h-3 w-20" /></td>
                          <td><Skeleton className="ml-auto h-7 w-20" /></td>
                        </tr>
                      )}
                    </TableSkeleton>
                  ) : salesOrders.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-0 text-center text-[11px] italic text-[#90a4ae]">
                        <div className="flex min-h-[220px] items-center justify-center">
                          No sales orders found for the current filters.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    salesOrders.map((salesOrder) => (
                      <tr key={salesOrder.id}>
                        <td className="font-mono text-[#1a3557]">{salesOrder.salesOrderNumber}</td>
                        <td>{salesOrder.customer?.name || "N/A"}</td>
                        <td>{formatDate(salesOrder.orderDate)}</td>
                        <td>{salesOrder.agent ? `${salesOrder.agent.firstName} ${salesOrder.agent.lastName}` : "No agent"}</td>
                        <td className="font-bold text-[#1a3557]">{formatMoney(salesOrder.totalAmount)}</td>
                        <td className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`erp-status-badge ${statusBadgeClass(salesOrder.status)}`}>
                              <span className="erp-status-badge-dot" />
                              {statusLabel(salesOrder.status)}
                            </span>
                            {salesOrder.hasStockShortage ? (
                              <span className="inline-flex items-center gap-1 rounded-sm border border-[#ef9a9a] bg-[#fff5f5] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.4px] text-[#c62828]">
                                <i className="fas fa-triangle-exclamation text-[8px]" />
                                Stock Alert
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="text-muted">{formatDate(salesOrder.updatedAt)}</td>
                        <td className="text-right">
                          <div className="flex justify-end gap-1.5">
                            {getAllowedSalesOrderStatuses(salesOrder.status).some((status) => status !== salesOrder.status) ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setStatusModal({
                                    id: salesOrder.id,
                                    referenceValue: salesOrder.salesOrderNumber,
                                    currentStatus: salesOrder.status,
                                    nextStatus: salesOrder.status
                                  })
                                }
                                className="erp-icon-button-violet"
                                title="Update status"
                              >
                                <i className="fas fa-arrows-rotate text-[11px]" />
                              </button>
                            ) : null}
                            {canEditSalesOrder(salesOrder.status) ? (
                              <button
                                type="button"
                                onClick={() => navigate(`/sales-orders/${salesOrder.id}/edit`)}
                                className="erp-icon-button-warning"
                                title="Edit Sales Order"
                              >
                                <i className="fas fa-pen text-[11px]" />
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => navigate(`/sales-orders/${salesOrder.id}`)}
                              className="erp-icon-button"
                              title="View Sales Order Receipt"
                            >
                              <i className="fas fa-eye text-[11px]" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {!isSalesOrdersLoading ? (
              <Pagination
                currentPage={meta?.currentPage ?? 1}
                lastPage={meta?.lastPage ?? 1}
                perPage={meta?.perPage ?? 10}
                total={meta?.total ?? 0}
                itemLabel="sales orders"
                loading={isFetching}
                onPrevious={() => setPage((current) => Math.max(1, current - 1))}
                onNext={() => setPage((current) => (meta?.lastPage ? Math.min(meta.lastPage, current + 1) : current + 1))}
                onGoto={(targetPage) => setPage(targetPage)}
              />
            ) : null}
          </>
        )}
      </section>

      <StatusUpdateModal
        show={Boolean(statusModal)}
        title="Update Sales Order Status"
        referenceLabel="Sales Order"
        referenceValue={statusModal?.referenceValue}
        currentStatus={statusModal?.currentStatus}
        currentStatusLabel={statusLabel(statusModal?.currentStatus ?? "")}
        selectedStatus={statusModal?.nextStatus ?? ""}
        selectedStatusLabel={statusLabel(statusModal?.nextStatus ?? "")}
        options={statusModalOptions}
        getStatusClassName={statusBadgeClass}
        helperText={selectedStatusHint.message}
        helperTone={selectedStatusHint.tone}
        isSubmitting={updateStatusMutation.isPending}
        disableSubmit={!statusModal || statusModal.nextStatus === statusModal.currentStatus}
        onSelectStatus={(nextStatus) =>
          setStatusModal((current) => (current ? { ...current, nextStatus } : current))
        }
        onClose={() => setStatusModal(null)}
        onConfirm={async () => {
          if (!statusModal || statusModal.nextStatus === statusModal.currentStatus) {
            return;
          }

          if (statusModal.nextStatus === "for_delivery") {
            setStatusModal(null);
            navigate(`/deliveries/create?salesOrderId=${statusModal.id}`);
            return;
          }

          await updateStatusMutation.mutateAsync({
            id: statusModal.id,
            status: statusModal.nextStatus
          });
        }}
      />
    </div>
  );
}
