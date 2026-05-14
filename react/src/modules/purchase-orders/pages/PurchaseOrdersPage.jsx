import { useDeferredValue, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Pagination } from "@/shared/components/common/Pagination";
import { Skeleton, TableSkeleton } from "@/shared/components/common/Skeleton";
import { StatusUpdateModal } from "@/shared/components/common/StatusUpdateModal";
import { useNotification } from "@/shared/hooks/useNotification";
import { getPurchaseOrders, getPurchaseOrderById, updatePurchaseOrderStatus, receivePurchaseOrder } from "@/modules/purchase-orders/api/purchase-orders.api";
import { canEditPurchaseOrder, getAllowedPurchaseOrderStatuses } from "@/modules/purchase-orders/utils/status";
import { GoodsReceiptModal } from "@/modules/purchase-orders/components/GoodsReceiptModal";

const statusOptions = [
  { value: "", label: "All Status" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "received", label: "Received" },
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
    case "approved":
      return "border-[#b8d4ea] bg-[#f4f9fd] text-[#1d6fa5]";
    case "received":
      return "border-[#c2ddbe] bg-[#f3faf1] text-[#356b37]";
    case "cancelled":
      return "border-[#e6b8b8] bg-[#fff7f7] text-[#a44d4d]";
    default:
      return "border-[#b0bec5] bg-[#f3f6f9] text-[#607d8b]";
  }
}

function statusChangeHint(status) {
  switch (status) {
    case "approved":
      return {
        tone: "info",
        message: "Use when the order is approved internally and sent to supplier."
      };
    case "received":
      return {
        tone: "success",
        message: "This records the stock in inventory and finalizes the order."
      };
    case "cancelled":
      return {
        tone: "error",
        message: "Use only when the order should no longer proceed. This is treated as a terminal state."
      };
    default:
      return {
        tone: "info",
        message: "Select the next valid workflow state for this purchase order."
      };
  }
}

export function PurchaseOrdersPage() {
  const navigate = useNavigate();
  const notify = useNotification();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [statusModal, setStatusModal] = useState(null);
  const [grnModal, setGrnModal] = useState(null);   // { poId, poSummary }
  const deferredSearch = useDeferredValue(searchInput.trim());

  const { data: purchaseOrdersResponse, isLoading: isPoLoading, isError, error, isFetching } = useQuery({
    queryKey: ["purchase-orders", page, deferredSearch, statusFilter],
    queryFn: () =>
      getPurchaseOrders({
        page,
        perPage: 10,
        ...(deferredSearch ? { search: deferredSearch } : {}),
        ...(statusFilter ? { status: statusFilter } : {})
      }),
    placeholderData: keepPreviousData
  });

  const purchaseOrders = purchaseOrdersResponse?.data ?? [];
  const meta = purchaseOrdersResponse?.meta;
  const statusModalOptions = statusModal
    ? statusOptions.filter((option) => option.value && getAllowedPurchaseOrderStatuses(statusModal.currentStatus).includes(option.value))
    : [];
  const selectedStatusHint = statusModal ? statusChangeHint(statusModal.nextStatus) : statusChangeHint();

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => updatePurchaseOrderStatus(id, status),
    onSuccess: async (_response, variables) => {
      notify.success(`Purchase order marked as ${statusLabel(variables.status).toLowerCase()}.`);
      setStatusModal(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["purchase-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["purchase-order", Number(variables.id)] }),
        queryClient.invalidateQueries({ queryKey: ["purchase-order", String(variables.id)] })
      ]);
    },
    onError: (mutationError) => {
      notify.error(mutationError?.response?.data?.message ?? "Failed to update purchase order status.");
    }
  });

  // Fetch the full PO (with items) when user selects "received" in the status modal
  const receiveMutation = useMutation({
    mutationFn: ({ id, grnPayload }) => receivePurchaseOrder(id, grnPayload),
    onSuccess: async (_response, variables) => {
      notify.success("Goods received and inventory updated successfully.");
      setGrnModal(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["purchase-orders"] }),
        queryClient.invalidateQueries({ queryKey: ["purchase-order", Number(variables.id)] }),
        queryClient.invalidateQueries({ queryKey: ["purchase-order", String(variables.id)] })
      ]);
    },
    onError: (mutationError) => {
      notify.error(mutationError?.response?.data?.message ?? "Failed to confirm goods receipt.");
    }
  });

  // Fetch full PO detail for GRN modal (lazy, only when needed)
  const { data: grnPoData, isFetching: isGrnPoFetching } = useQuery({
    queryKey: ["purchase-order-grn", grnModal?.poId],
    queryFn: () => getPurchaseOrderById(grnModal.poId),
    enabled: Boolean(grnModal?.poId),
    staleTime: 0
  });

  function clearFilters() {
    setPage(1);
    setSearchInput("");
    setStatusFilter("");
  }

  // Called when user selects a next-status in the status modal.
  // If the next status is "received", open the GRN modal instead.
  function handleStatusSelect(nextStatus) {
    if (nextStatus === "received") {
      // Intercept: close the generic modal and open GRN modal with the current PO
      const poId = statusModal?.id;
      const poSummary = statusModal;
      setStatusModal(null);
      setGrnModal({ poId, poSummary });
      return;
    }
    setStatusModal((current) => (current ? { ...current, nextStatus } : current));
  }

  return (
    <div className="space-y-4">
      <section className="erp-page-section">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <i className="fas fa-shopping-bag text-[18px] text-[#90caf9]" />
            <div>
              <div className="erp-page-title">Purchase Orders</div>
              <div className="erp-page-description">Purchasing workflow, supplier coordination, and receiving tracking</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/purchase-orders/create")}
            className="erp-header-primary-button"
          >
            <i className="fas fa-plus mr-1.5" />
            Create Purchase Order
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
              placeholder="Search by PO number or supplier..."
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
            Failed to load purchase orders{error?.message ? `: ${error.message}` : "."}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className={`erp-table w-full min-w-[1060px] ${isPoLoading ? "opacity-70" : ""}`}>
                <thead>
                  <tr>
                    <th>PO Number</th>
                    <th>Supplier</th>
                    <th>Order Date</th>
                    <th>Payment Terms</th>
                    <th>Total Amount</th>
                    <th className="!text-center">Status</th>
                    <th className="!text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isPoLoading ? (
                    <TableSkeleton rows={8}>
                      {(index) => (
                        <tr key={`po-sk-${index}`}>
                          <td><Skeleton className="h-3 w-24" /></td>
                          <td><Skeleton className="h-3 w-28" /></td>
                          <td><Skeleton className="h-3 w-20" /></td>
                          <td><Skeleton className="h-3 w-24" /></td>
                          <td><Skeleton className="h-3 w-20" /></td>
                          <td><Skeleton className="mx-auto h-4 w-16" /></td>
                          <td><Skeleton className="ml-auto h-7 w-20" /></td>
                        </tr>
                      )}
                    </TableSkeleton>
                  ) : purchaseOrders.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-0 text-center text-[11px] italic text-[#90a4ae]">
                        <div className="flex min-h-[220px] flex-col items-center justify-center">
                          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#e8f1f8]">
                            <i className="fas fa-shopping-bag text-[24px] text-[#90a4ae]" />
                          </div>
                          <div className="text-[13px] font-bold text-[#546e7a]">No purchase orders found</div>
                          <div className="mt-1 text-[11px] text-[#90a4ae]">Try adjusting your filters or create your first purchase order</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    purchaseOrders.map((po) => (
                      <tr key={po.id}>
                        <td className="font-mono text-[#0070b8] font-bold">{po.poNumber}</td>
                        <td>
                          <div className="font-bold text-[#1a3557]">{po.supplierName || "N/A"}</div>
                        </td>
                        <td>{formatDate(po.orderDate)}</td>
                        <td>{po.paymentTermsName || "N/A"}</td>
                        <td className="font-bold text-[#1a3557]">{formatMoney(po.totalAmount)}</td>
                        <td className="text-center">
                          <span className={`erp-status-badge ${statusBadgeClass(po.status)}`}>
                            <span className="erp-status-badge-dot" />
                            {statusLabel(po.status)}
                          </span>
                        </td>
                        <td className="text-right">
                          <div className="flex justify-end gap-1.5">
                            {getAllowedPurchaseOrderStatuses(po.status).some((status) => status !== po.status) ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setStatusModal({
                                    id: po.id,
                                    referenceValue: po.poNumber,
                                    currentStatus: po.status,
                                    nextStatus: po.status
                                  })
                                }
                                className="erp-icon-button-violet"
                                title="Update status"
                              >
                                <i className="fas fa-arrows-rotate text-[11px]" />
                              </button>
                            ) : null}
                            {canEditPurchaseOrder(po.status) ? (
                              <button
                                type="button"
                                onClick={() => navigate(`/purchase-orders/${po.id}/edit`)}
                                className="erp-icon-button-warning"
                                title="Edit Purchase Order"
                              >
                                <i className="fas fa-pen text-[11px]" />
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => navigate(`/purchase-orders/${po.id}`)}
                              className="erp-icon-button"
                              title="View Details"
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

            {!isPoLoading ? (
              <Pagination
                currentPage={meta?.page ?? 1}
                lastPage={meta?.totalPages ?? 1}
                perPage={meta?.limit ?? 10}
                total={meta?.total ?? 0}
                itemLabel="purchase orders"
                loading={isFetching}
                onPrevious={() => setPage((current) => Math.max(1, current - 1))}
                onNext={() => setPage((current) => (meta?.totalPages ? Math.min(meta.totalPages, current + 1) : current + 1))}
                onGoto={(targetPage) => setPage(targetPage)}
              />
            ) : null}
          </>
        )}
      </section>

      <StatusUpdateModal
        show={Boolean(statusModal)}
        title="Update Purchase Order Status"
        referenceLabel="Purchase Order"
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
        onSelectStatus={handleStatusSelect}
        onClose={() => setStatusModal(null)}
        onConfirm={async () => {
          if (!statusModal || statusModal.nextStatus === statusModal.currentStatus) {
            return;
          }

          await updateStatusMutation.mutateAsync({
            id: statusModal.id,
            status: statusModal.nextStatus
          });
        }}
      />

      {/* GRN Modal — shown when 'received' is chosen for an approved PO */}
      <GoodsReceiptModal
        show={Boolean(grnModal)}
        purchaseOrder={grnPoData ?? null}
        isSubmitting={receiveMutation.isPending || isGrnPoFetching}
        onConfirm={(grnPayload) => {
          if (!grnModal?.poId) return;
          receiveMutation.mutate({ id: grnModal.poId, grnPayload });
        }}
        onClose={() => setGrnModal(null)}
      />
    </div>
  );
}
