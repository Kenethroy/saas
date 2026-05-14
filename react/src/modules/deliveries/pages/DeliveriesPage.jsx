import { useDeferredValue, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import { Pagination } from "@/shared/components/common/Pagination";
import { Skeleton, TableSkeleton } from "@/shared/components/common/Skeleton";
import { DateField } from "@/shared/components/common/DateField";
import { StatusUpdateModal } from "@/shared/components/common/StatusUpdateModal";
import { useNotification } from "@/shared/hooks/useNotification";
import { getDeliveries, getDeliveryReceiptPdf, updateDeliveryStatus } from "@/modules/deliveries/api/deliveries.api";
import { canEditDelivery, getAllowedDeliveryStatuses } from "@/modules/deliveries/utils/status";
import { extractBlobErrorMessage, openPdfViewer } from "@/shared/utils/pdf";

const statusOptions = [
  { value: "", label: "All Status" },
  { value: "pending", label: "Pending" },
  { value: "in_transit", label: "In Transit" },
  { value: "delivered", label: "Delivered" },
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
  if (!value) return "N/A";
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function statusLabel(status) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusBadgeClass(status) {
  switch (status) {
    case "pending":
      return "border-[#efd79a] bg-[#fff9ec] text-[#9a6a00]";
    case "in_transit":
      return "border-[#b8d4ea] bg-[#f4f9fd] text-[#1d6fa5]";
    case "delivered":
      return "border-[#c2ddbe] bg-[#f3faf1] text-[#356b37]";
    case "cancelled":
      return "border-[#e6b8b8] bg-[#fff7f7] text-[#a44d4d]";
    default:
      return "border-[#b0bec5] bg-[#f3f6f9] text-[#607d8b]";
  }
}

function statusChangeHint(status) {
  switch (status) {
    case "in_transit":
      return {
        tone: "info",
        message: "Use when the delivery has left the warehouse and is actively on the road."
      };
    case "delivered":
      return {
        tone: "success",
        message: "Complete this from the delivery detail page so you can confirm the batch and create invoices from one final handoff step."
      };
    case "cancelled":
      return {
        tone: "error",
        message: "Use only when this dispatch should no longer proceed. This is a terminal state."
      };
    default:
      return {
        tone: "info",
        message: "Select the next valid dispatch state for this delivery."
      };
  }
}

export function DeliveriesPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const notify = useNotification();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusModal, setStatusModal] = useState(null);
  const [openingDeliveryId, setOpeningDeliveryId] = useState(null);
  const deferredSearch = useDeferredValue(searchInput.trim());

  const { data: deliveriesResponse, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["deliveries", page, deferredSearch, statusFilter, dateFrom, dateTo],
    queryFn: () =>
      getDeliveries({
        page,
        perPage: 10,
        ...(deferredSearch ? { search: deferredSearch } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {})
      }),
    placeholderData: keepPreviousData
  });

  const deliveries = deliveriesResponse?.data ?? [];
  const meta = deliveriesResponse?.meta;
  const statusModalOptions = statusModal
    ? statusOptions.filter((option) => option.value && getAllowedDeliveryStatuses(statusModal.currentStatus).includes(option.value))
    : [];
  const selectedStatusHint = statusModal ? statusChangeHint(statusModal.nextStatus) : statusChangeHint();

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => updateDeliveryStatus(id, status),
    onSuccess: async (_response, variables) => {
      notify.success(`Delivery marked as ${statusLabel(variables.status).toLowerCase()}.`);
      setStatusModal(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["deliveries"] }),
        queryClient.invalidateQueries({ queryKey: ["delivery", Number(variables.id)] }),
        queryClient.invalidateQueries({ queryKey: ["delivery", String(variables.id)] }),
        queryClient.invalidateQueries({ queryKey: ["delivery-selection-options"] })
      ]);
    },
    onError: (mutationError) => {
      notify.error(mutationError?.response?.data?.message ?? "Failed to update delivery status.");
    }
  });

  function clearFilters() {
    setPage(1);
    setSearchInput("");
    setStatusFilter("");
    setDateFrom("");
    setDateTo("");
  }

  async function handleOpenReceiptPdf(delivery) {
    setOpeningDeliveryId(delivery.id);
    try {
      const pdfBlob = await getDeliveryReceiptPdf(delivery.id);
      const normalizedBlob = pdfBlob instanceof Blob ? pdfBlob : new Blob([pdfBlob], { type: "application/pdf" });

      openPdfViewer(navigate, {
        pdfData: normalizedBlob,
        title: "Delivery Receipt PDF",
        subtitle: delivery.deliveryNumber,
        documentName: `${delivery.deliveryNumber}.pdf`,
        fromPath: `${location.pathname}${location.search}`
      });
    } catch (printError) {
      notify.error(await extractBlobErrorMessage(printError, "Failed to load delivery receipt PDF."));
    } finally {
      setOpeningDeliveryId(null);
    }
  }

  return (
    <div className="space-y-4">
      <section className="erp-page-section">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <i className="fas fa-truck text-[18px] text-[#90caf9]" />
            <div>
              <div className="erp-page-title">Deliveries</div>
              <div className="erp-page-description">Delivery scheduling, truck assignment, and dispatch tracking</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/deliveries/create")}
            className="erp-header-primary-button"
          >
            <i className="fas fa-plus mr-1.5" />
            Create Delivery
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
              placeholder="Search delivery, driver, or truck..."
              className="erp-input pl-7"
            />
          </div>

          <div className="min-w-[180px]">
            <select
              value={statusFilter}
              onChange={(event) => {
                setPage(1);
                setStatusFilter(event.target.value);
              }}
              className="erp-select"
            >
              {statusOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[180px]">
            <DateField value={dateFrom} onChange={(value) => { setPage(1); setDateFrom(value); }} placeholder="From date" />
          </div>

          <div className="min-w-[180px]">
            <DateField value={dateTo} onChange={(value) => { setPage(1); setDateTo(value); }} placeholder="To date" />
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
            Failed to load deliveries{error?.message ? `: ${error.message}` : "."}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className={`erp-table w-full min-w-[1040px] ${isLoading ? "opacity-70" : ""}`}>
                <thead>
                  <tr>
                    <th>Delivery #</th>
                    <th>Orders</th>
                    <th>Driver</th>
                    <th>Truck</th>
                    <th>Delivery Date</th>
                    <th>Total Amount</th>
                    <th className="!text-center">Status</th>
                    <th>Updated</th>
                    <th className="!text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <TableSkeleton rows={8}>
                      {(index) => (
                        <tr key={`delivery-sk-${index}`}>
                          <td><Skeleton className="h-3 w-24" /></td>
                          <td><Skeleton className="h-3 w-10" /></td>
                          <td><Skeleton className="h-3 w-28" /></td>
                          <td><Skeleton className="h-3 w-20" /></td>
                          <td><Skeleton className="h-3 w-24" /></td>
                          <td><Skeleton className="h-3 w-20" /></td>
                          <td><Skeleton className="mx-auto h-4 w-24" /></td>
                          <td><Skeleton className="h-3 w-24" /></td>
                          <td><Skeleton className="ml-auto h-7 w-24" /></td>
                        </tr>
                      )}
                    </TableSkeleton>
                  ) : deliveries.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-0 text-center text-[11px] italic text-[#90a4ae]">
                        <div className="flex min-h-[220px] items-center justify-center">
                          No deliveries found for the current filters.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    deliveries.map((delivery) => (
                      <tr key={delivery.id}>
                        <td className="font-mono text-[#1a3557]">{delivery.deliveryNumber}</td>
                        <td className="text-center font-bold text-[#0070b8]">{delivery.totalOrders}</td>
                        <td>{delivery.driverName || "Unassigned"}</td>
                        <td>{delivery.truckPlate || "Unassigned"}</td>
                        <td>{formatDate(delivery.deliveryDate)}</td>
                        <td className="font-bold text-[#1a3557]">{formatMoney(delivery.totalAmount)}</td>
                        <td className="text-center">
                          <span className={`erp-status-badge ${statusBadgeClass(delivery.status)}`}>
                            <span className="erp-status-badge-dot" />
                            {statusLabel(delivery.status)}
                          </span>
                        </td>
                        <td className="text-muted">{formatDate(delivery.updatedAt)}</td>
                        <td className="text-right">
                          <div className="flex justify-end gap-1.5">
                            {getAllowedDeliveryStatuses(delivery.status).some((status) => status !== delivery.status) ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setStatusModal({
                                    id: delivery.id,
                                    referenceValue: delivery.deliveryNumber,
                                    currentStatus: delivery.status,
                                    nextStatus: delivery.status
                                  })
                                }
                                className="erp-icon-button-violet"
                                title="Update status"
                              >
                                <i className="fas fa-arrows-rotate text-[11px]" />
                              </button>
                            ) : null}
                            {canEditDelivery(delivery.status) ? (
                              <button
                                type="button"
                                onClick={() => navigate(`/deliveries/${delivery.id}/edit`)}
                                className="erp-icon-button-warning"
                                title="Edit delivery"
                              >
                                <i className="fas fa-pen text-[11px]" />
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => navigate(`/deliveries/${delivery.id}`)}
                              className="erp-icon-button"
                              title="View delivery"
                            >
                              <i className="fas fa-eye text-[11px]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenReceiptPdf(delivery)}
                              disabled={openingDeliveryId === delivery.id}
                              className="erp-icon-button disabled:cursor-not-allowed disabled:opacity-60"
                              title="View delivery receipt PDF"
                            >
                              <i className={`fas ${openingDeliveryId === delivery.id ? "fa-spinner fa-spin" : "fa-file-pdf"} text-[11px]`} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {!isLoading ? (
              <Pagination
                currentPage={meta?.currentPage ?? 1}
                lastPage={meta?.lastPage ?? 1}
                perPage={meta?.perPage ?? 10}
                total={meta?.total ?? 0}
                itemLabel="deliveries"
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
        title="Update Delivery Status"
        referenceLabel="Delivery"
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

          if (statusModal.nextStatus === "delivered") {
            setStatusModal(null);
            navigate(`/deliveries/${statusModal.id}?confirmDelivered=1`);
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
