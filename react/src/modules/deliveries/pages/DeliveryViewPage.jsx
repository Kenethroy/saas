import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { FormModal } from "@/shared/components/common/FormModal";
import { Skeleton } from "@/shared/components/common/Skeleton";
import { useNotification } from "@/shared/hooks/useNotification";
import {
  getDeliveryById,
  getDeliveryReceiptPdf,
  updateDeliveryStatus
} from "@/modules/deliveries/api/deliveries.api";
import { canEditDelivery, getAllowedDeliveryStatuses } from "@/modules/deliveries/utils/status";
import { extractBlobErrorMessage, openPdfViewer } from "@/shared/utils/pdf";

const statusOptions = [
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
    ?.split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") ?? "N/A";
}

function getLinkedSalesOrderId(salesOrder) {
  return Number(salesOrder?.salesOrderId ?? salesOrder?.id);
}

function buildCompletionDetails(salesOrders = []) {
  return salesOrders.map((salesOrder) => ({
    salesOrderId: getLinkedSalesOrderId(salesOrder),
    recipientName: salesOrder.deliveryInfo?.recipientName ?? salesOrder.recipientName ?? salesOrder.recipient_name ?? "",
    deliveryNotes: salesOrder.deliveryInfo?.deliveryNotes ?? salesOrder.deliveryNotes ?? salesOrder.delivery_notes ?? ""
  }));
}

export function DeliveryViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const notify = useNotification();
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextStatus, setNextStatus] = useState("");
  const [isReceiptViewerOpening, setIsReceiptViewerOpening] = useState(false);
  const [showDeliveredConfirm, setShowDeliveredConfirm] = useState(false);
  const [completionDetails, setCompletionDetails] = useState([]);

  const { data: response, isLoading, isError, error } = useQuery({
    queryKey: ["delivery", id],
    enabled: Boolean(id),
    queryFn: () => getDeliveryById(id)
  });

  const delivery = response?.data ?? null;
  const salesOrders = delivery?.salesOrders ?? [];
  const currentSalesOrder = salesOrders[currentIndex] ?? null;
  const currentSalesOrderItems = currentSalesOrder?.items ?? currentSalesOrder?.salesOrder?.items ?? [];
  const currentSalesOrderNumber = currentSalesOrder?.salesOrderNumber ?? currentSalesOrder?.salesOrder?.salesOrderNumber ?? "N/A";
  const currentCustomer = currentSalesOrder?.customer ?? currentSalesOrder?.salesOrder?.customer ?? null;
  const currentOrderTotal = currentSalesOrder?.totalAmount ?? currentSalesOrder?.salesOrder?.totalAmount ?? 0;
  const truckPlateLabel = delivery?.truckPlate ?? delivery?.truck?.plateNumber ?? delivery?.truck_plate_number ?? "Unassigned";
  const allowedStatuses = useMemo(() => getAllowedDeliveryStatuses(delivery?.status), [delivery?.status]);

  useEffect(() => {
    if (delivery?.status) {
      setNextStatus(delivery.status);
    }
  }, [delivery?.status]);

  useEffect(() => {
    setCompletionDetails(buildCompletionDetails(salesOrders));
  }, [salesOrders]);

  useEffect(() => {
    if (!delivery || delivery.status !== "in_transit") {
      return;
    }

    if (searchParams.get("confirmDelivered") === "1") {
      setShowDeliveredConfirm(true);
    }
  }, [delivery, searchParams]);

  const updateStatusMutation = useMutation({
    mutationFn: ({ deliveryId, status }) => updateDeliveryStatus(deliveryId, status),
    onSuccess: async () => {
      notify.success("Delivery status updated");
      await queryClient.invalidateQueries({ queryKey: ["delivery", id] });
      await queryClient.invalidateQueries({ queryKey: ["deliveries"] });
      await queryClient.invalidateQueries({ queryKey: ["delivery-selection-options"] });
    },
    onError: (mutationError) => {
      notify.error(mutationError?.response?.data?.message ?? "Failed to update delivery status.");
    }
  });

  function closeDeliveredConfirm() {
    setShowDeliveredConfirm(false);
    if (searchParams.get("confirmDelivered") === "1") {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("confirmDelivered");
      setSearchParams(nextParams, { replace: true });
    }
  }

  function openDeliveredConfirm() {
    setCompletionDetails(buildCompletionDetails(salesOrders));
    setShowDeliveredConfirm(true);
  }

  function updateCompletionDetail(salesOrderId, patch) {
    setCompletionDetails((current) =>
      current.map((detail) =>
        detail.salesOrderId === Number(salesOrderId)
          ? { ...detail, ...patch }
          : detail
      )
    );
  }

  async function handleOpenReceiptPdf() {
    if (!delivery?.id) return;

    setIsReceiptViewerOpening(true);
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
      setIsReceiptViewerOpening(false);
    }
  }

  return (
    <div className="space-y-3">
      <section className="erp-page-section">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/deliveries")}
              className="erp-back-button"
            >
              <i className="fas fa-arrow-left text-[12px]" />
            </button>
            <div>
              <div className="erp-page-title">Delivery Receipt</div>
              <div className="erp-page-description">Receipt-style view for dispatch, print, and status updates</div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {canEditDelivery(delivery?.status) ? (
              <button
                type="button"
                onClick={() => navigate(`/deliveries/${delivery.id}/edit`)}
                className="erp-header-secondary-button"
              >
                <i className="fas fa-pen mr-1.5" />
                Edit
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleOpenReceiptPdf}
              disabled={isReceiptViewerOpening || !delivery?.id}
              className="erp-header-secondary-button disabled:cursor-not-allowed disabled:opacity-60"
            >
              <i className={`fas ${isReceiptViewerOpening ? "fa-spinner fa-spin" : "fa-file-pdf"} mr-1.5`} />
              {isReceiptViewerOpening ? "Opening..." : "Receipt PDF"}
            </button>
          </div>
        </div>
      </section>

      {isError ? (
        <section className="rounded-sm border border-[#ef9a9a] bg-[#fff5f5] px-4 py-8 text-[11px] text-[#c62828]">
          Failed to load delivery{error?.message ? `: ${error.message}` : "."}
        </section>
      ) : (
        <section className="erp-page-main-card p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#607d8b]">JRSPC Hardware Enterprise</div>
              <div className="mt-1 text-[16px] font-extrabold tracking-[0.6px] text-[#1a3557]">Delivery Note</div>
              <div className="mt-1 text-[10px] text-[#90a4ae]">Proof-ready document for delivery batch review</div>
            </div>

            <div className="rounded-sm border border-[#d3dee7] bg-[#f8fbfd] px-3 py-2">
              <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#607d8b]">Delivery Number</div>
              <div className="mt-1 font-mono text-[14px] font-bold text-[#0070b8]">
                {isLoading ? <Skeleton className="h-4 w-28" /> : delivery?.deliveryNumber ?? "N/A"}
              </div>
              <div className="mt-2 grid gap-2">
                <div className="text-[10px] text-[#607d8b]">
                  Current: <span className="font-bold text-[#1a3557]">{isLoading ? "..." : statusLabel(delivery?.status)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={allowedStatuses.includes(nextStatus) ? nextStatus : delivery?.status ?? ""}
                    onChange={(event) => setNextStatus(event.target.value)}
                    disabled={isLoading || updateStatusMutation.isPending || !delivery?.id}
                    className="erp-select h-8 min-w-[180px] text-[11px]"
                  >
                    {statusOptions.filter((option) => allowedStatuses.includes(option.value)).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!delivery?.id || !nextStatus || nextStatus === delivery.status) return;
                      if (nextStatus === "delivered") {
                        openDeliveredConfirm();
                        return;
                      }
                      await updateStatusMutation.mutateAsync({ deliveryId: delivery.id, status: nextStatus });
                    }}
                    disabled={isLoading || updateStatusMutation.isPending || !delivery?.id || nextStatus === delivery?.status}
                    className="inline-flex h-8 items-center justify-center rounded-sm bg-[#0070b8] px-3 text-[11px] font-bold text-white transition hover:bg-[#005a94] disabled:cursor-not-allowed disabled:bg-[#b0bec5]"
                  >
                    {updateStatusMutation.isPending ? "Saving..." : "Update"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {salesOrders.length > 1 ? (
            <div className="mt-4 flex items-center justify-between rounded-sm border border-[#e3ebf1] bg-[#f8fbfd] px-3 py-2 text-[11px]">
              <button
                type="button"
                onClick={() => setCurrentIndex((current) => Math.max(0, current - 1))}
                disabled={currentIndex === 0}
                className="rounded-sm border border-[#d3dee7] bg-white px-3 py-1 font-bold text-[#1a3557] transition hover:border-[#0070b8] hover:text-[#0070b8] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Prev Order
              </button>
              <div className="text-center">
                <div className="font-bold text-[#1a3557]">Sales Order {currentIndex + 1} of {salesOrders.length}</div>
                <div className="font-mono text-[#607d8b]">{currentSalesOrderNumber}</div>
              </div>
              <button
                type="button"
                onClick={() => setCurrentIndex((current) => Math.min(salesOrders.length - 1, current + 1))}
                disabled={currentIndex >= salesOrders.length - 1}
                className="rounded-sm border border-[#d3dee7] bg-white px-3 py-1 font-bold text-[#1a3557] transition hover:border-[#0070b8] hover:text-[#0070b8] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next Order
              </button>
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-sm border border-[#e3ebf1] bg-white p-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#607d8b]">Deliver To</div>
              <div className="mt-1 text-[12px] font-bold text-[#1a3557]">
                {isLoading ? <Skeleton className="h-3 w-40" /> : currentSalesOrder?.customerName ?? currentCustomer?.name ?? "N/A"}
              </div>
              <div className="mt-2 space-y-1 text-[11px] text-[#546e7a]">
                <div>{currentSalesOrder?.customerAddress ?? currentCustomer?.address ?? "No address"}</div>
                <div>{currentSalesOrder?.customerPhone ?? currentCustomer?.phone ?? "No phone"}</div>
                <div>{currentSalesOrder?.customerEmail ?? currentCustomer?.email ?? "No email"}</div>
              </div>
            </div>

            <div className="rounded-sm border border-[#e3ebf1] bg-white p-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#607d8b]">Dispatch Details</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#90a4ae]">Delivery Date</div>
                  <div className="mt-0.5 font-bold text-[#1a3557]">{isLoading ? "..." : formatDate(delivery?.deliveryDate)}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#90a4ae]">Sales Order</div>
                  <div className="mt-0.5 font-mono font-bold text-[#1a3557]">{isLoading ? "..." : currentSalesOrderNumber}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#90a4ae]">Driver</div>
                  <div className="mt-0.5 font-bold text-[#1a3557]">{isLoading ? "..." : delivery?.driverName ?? "Unassigned"}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#90a4ae]">Truck</div>
                  <div className="mt-0.5 font-bold text-[#1a3557]">{isLoading ? "..." : truckPlateLabel}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-sm border border-[#e3ebf1]">
            <table className="w-full min-w-[700px] text-[11px]">
              <thead className="bg-[#f3f6f9]">
                <tr className="text-left text-[10px] font-bold uppercase tracking-[0.6px] text-[#546e7a]">
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Unit Price</th>
                  <th className="px-3 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <tr key={`delivery-item-sk-${index}`} className="border-t border-[#e3ebf1]">
                      <td className="px-3 py-2"><Skeleton className="h-3 w-56" /></td>
                      <td className="px-3 py-2 text-right"><Skeleton className="ml-auto h-3 w-10" /></td>
                      <td className="px-3 py-2 text-right"><Skeleton className="ml-auto h-3 w-16" /></td>
                      <td className="px-3 py-2 text-right"><Skeleton className="ml-auto h-3 w-20" /></td>
                    </tr>
                  ))
                ) : currentSalesOrderItems.length === 0 ? (
                  <tr className="border-t border-[#e3ebf1]">
                    <td colSpan={4} className="px-3 py-8 text-center text-[11px] italic text-[#90a4ae]">
                      No line items found.
                    </td>
                  </tr>
                ) : (
                  currentSalesOrderItems.map((item) => (
                    <tr key={item.id} className="border-t border-[#e3ebf1]">
                      <td className="px-3 py-2 font-bold text-[#1a3557]">
                        {item.variantName ? `${item.productName} ${item.variantName}` : item.productName}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-[#1a3557]">{item.quantity}</td>
                      <td className="px-3 py-2 text-right font-mono text-[#1a3557]">{formatMoney(item.unitPrice)}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-[#1a3557]">{formatMoney(item.subtotal ?? item.lineTotal)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-sm border border-[#e3ebf1] bg-[#f8fbfd] p-3 text-[11px]">
              <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#607d8b]">Notes</div>
              <div className="mt-1 whitespace-pre-wrap text-[#1a3557]">{delivery?.notes ? delivery.notes : "—"}</div>
            </div>

            <div className="rounded-sm border border-[#e3ebf1] bg-white p-3 text-[11px]">
              <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#607d8b]">Totals</div>
              <div className="mt-2 flex items-center justify-between border-t border-[#e3ebf1] pt-2">
                <span className="text-[12px] font-bold text-[#1a3557]">Order Total</span>
                <span className="font-mono text-[16px] font-extrabold text-[#0070b8]">
                  {formatMoney(currentOrderTotal)}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      <FormModal
        show={showDeliveredConfirm}
        title="Confirm Delivery Completion"
        size="3xl"
        closeOnClickOutside={!updateStatusMutation.isPending}
        onClose={() => {
          if (updateStatusMutation.isPending) {
            return;
          }
          closeDeliveredConfirm();
        }}
      >
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (!delivery?.id || completionDetails.some((detail) => !detail.recipientName.trim())) {
              return;
            }

            await updateStatusMutation.mutateAsync({
              deliveryId: delivery.id,
              status: {
                status: "delivered",
                completionDetails: completionDetails.map((detail) => ({
                  salesOrderId: detail.salesOrderId,
                  recipientName: detail.recipientName.trim(),
                  deliveryNotes: detail.deliveryNotes.trim() || null
                }))
              }
            });
            closeDeliveredConfirm();
          }}
          className="space-y-4"
        >
          <div className="rounded-sm border border-[#d3dee7] bg-white p-4">
            <div className="space-y-4">
              <div className="rounded-sm border border-[#ffe082] bg-[#fff8e1] px-3 py-2 text-[11px] text-[#8d6e00]">
                This will mark all linked sales orders as delivered, deduct stock, create invoices, and open receivables. Confirm the recipient and handoff notes per sales order below.
              </div>

              <div className="space-y-3">
                {salesOrders.map((salesOrder, index) => {
                  const linkedSalesOrderId = getLinkedSalesOrderId(salesOrder);
                  const detail = completionDetails.find((entry) => entry.salesOrderId === linkedSalesOrderId) ?? {
                    salesOrderId: linkedSalesOrderId,
                    recipientName: "",
                    deliveryNotes: ""
                  };

                  return (
                    <div key={linkedSalesOrderId || `${salesOrder.salesOrderNumber}-${index}`} className="rounded-sm border border-[#e3ebf1] bg-[#f8fbfd] p-3">
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="font-mono text-[12px] font-bold text-[#1a3557]">{salesOrder.salesOrderNumber}</div>
                              <div className="text-[11px] text-[#607d8b]">{salesOrder.customerName}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-[10px] uppercase tracking-[0.4px] text-[#90a4ae]">Amount</div>
                              <div className="text-[12px] font-bold text-[#0070b8]">{formatMoney(salesOrder.totalAmount)}</div>
                            </div>
                          </div>

                          <div className="mt-3">
                            <label className="erp-label">Recipient Name</label>
                            <input
                              type="text"
                              value={detail.recipientName}
                              onChange={(event) => updateCompletionDetail(linkedSalesOrderId, { recipientName: event.target.value })}
                              className="erp-input"
                              placeholder={`Who received ${salesOrder.salesOrderNumber}?`}
                              disabled={updateStatusMutation.isPending}
                            />
                          </div>
                        </div>

                        <div>
                          <label className="erp-label">Delivery Note</label>
                          <textarea
                            value={detail.deliveryNotes}
                            onChange={(event) => updateCompletionDetail(linkedSalesOrderId, { deliveryNotes: event.target.value })}
                            rows={5}
                            className="erp-input min-h-[118px] resize-y"
                            placeholder="Per-customer handoff note..."
                            disabled={updateStatusMutation.isPending}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeDeliveredConfirm}
              className="erp-button-secondary"
              disabled={updateStatusMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="erp-button-primary"
              disabled={updateStatusMutation.isPending || completionDetails.some((detail) => !detail.recipientName.trim())}
            >
              {updateStatusMutation.isPending ? "Completing..." : "Confirm Delivery"}
            </button>
          </div>
        </form>
      </FormModal>
    </div>
  );
}
