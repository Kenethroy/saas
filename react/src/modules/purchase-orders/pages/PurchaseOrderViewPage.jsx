import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Skeleton } from "@/shared/components/common/Skeleton";
import { useNotification } from "@/shared/hooks/useNotification";
import {
  getPurchaseOrderById,
  getPurchaseOrderPdf,
  updatePurchaseOrderStatus
} from "@/modules/purchase-orders/api/purchase-orders.api";
import { canEditPurchaseOrder, getAllowedPurchaseOrderStatuses } from "@/modules/purchase-orders/utils/status";
import { extractBlobErrorMessage, openPdfViewer } from "@/shared/utils/pdf";

const statusOptions = [
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
  if (!value) return "N/A";
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function statusLabel(status) {
  if (!status) return "N/A";
  return String(status)
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getSupplierName(supplier) {
  return supplier?.name ?? "N/A";
}

export function PurchaseOrderViewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const notify = useNotification();
  const queryClient = useQueryClient();
  const [nextStatus, setNextStatus] = useState("");
  const [isPdfViewerOpening, setIsPdfViewerOpening] = useState(false);

  const { data: response, isLoading, isError, error } = useQuery({
    queryKey: ["purchase-order", id],
    enabled: Boolean(id),
    queryFn: () => getPurchaseOrderById(id)
  });

  const purchaseOrder = response?.data ?? response ?? null;
  const items = purchaseOrder?.items ?? [];

  const allowedStatuses = useMemo(
    () => getAllowedPurchaseOrderStatuses(purchaseOrder?.status),
    [purchaseOrder?.status]
  );

  const allowedStatusOptions = useMemo(
    () => statusOptions.filter((option) => allowedStatuses.includes(option.value)),
    [allowedStatuses]
  );

  useEffect(() => {
    if (purchaseOrder?.status) {
      setNextStatus(purchaseOrder.status);
    }
  }, [purchaseOrder?.status]);

  const updateStatusMutation = useMutation({
    mutationFn: ({ purchaseOrderId, status }) => updatePurchaseOrderStatus(purchaseOrderId, status),
    onSuccess: async (_result, variables) => {
      notify.success(`Purchase order marked as ${statusLabel(variables.status).toLowerCase()}.`);
      await queryClient.invalidateQueries({ queryKey: ["purchase-order", id] });
      await queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
    onError: (mutationError) => {
      notify.error(mutationError?.response?.data?.message ?? "Failed to update purchase order status.");
    }
  });

  async function openPurchaseOrderPdf() {
    if (!purchaseOrder?.id) return;

    setIsPdfViewerOpening(true);
    try {
      const pdfBlob = await getPurchaseOrderPdf(purchaseOrder.id);
      const normalizedBlob = pdfBlob instanceof Blob ? pdfBlob : new Blob([pdfBlob], { type: "application/pdf" });

      openPdfViewer(navigate, {
        pdfData: normalizedBlob,
        title: "Purchase Order PDF",
        subtitle: purchaseOrder.poNumber,
        documentName: `${purchaseOrder.poNumber}.pdf`,
        fromPath: `${location.pathname}${location.search}`
      });
    } catch (pdfError) {
      notify.error(await extractBlobErrorMessage(pdfError, "Failed to load purchase order PDF."));
    } finally {
      setIsPdfViewerOpening(false);
    }
  }

  return (
    <div className="space-y-3">
      <section className="erp-page-section">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/purchase-orders")}
              className="erp-back-button"
              title="Back to Purchase Orders"
            >
              <i className="fas fa-arrow-left text-[12px]" />
            </button>
            <div>
              <div className="erp-page-title">Purchase Order Receipt</div>
              <div className="erp-page-description">Receipt-style view for purchasing review, status update, and print</div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            {canEditPurchaseOrder(purchaseOrder?.status) ? (
              <button
                type="button"
                onClick={() => navigate(`/purchase-orders/${purchaseOrder.id}/edit`)}
                className="erp-header-secondary-button"
              >
                <i className="fas fa-pen mr-1.5" />
                Edit
              </button>
            ) : null}
            <button
              type="button"
              onClick={openPurchaseOrderPdf}
              disabled={isPdfViewerOpening || !purchaseOrder?.id}
              className="erp-header-secondary-button disabled:cursor-not-allowed disabled:opacity-60"
            >
              <i className={`fas ${isPdfViewerOpening ? "fa-spinner fa-spin" : "fa-file-pdf"} mr-1.5`} />
              {isPdfViewerOpening ? "Opening..." : "PO PDF"}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="erp-header-secondary-button"
            >
              <i className="fas fa-print mr-1.5" />
              Print
            </button>
          </div>
        </div>
      </section>

      {isError ? (
        <section className="rounded-sm border border-[#ef9a9a] bg-[#fff5f5] px-4 py-8 text-[11px] text-[#c62828]">
          Failed to load purchase order{error?.message ? `: ${error.message}` : "."}
        </section>
      ) : (
        <section className="erp-page-main-card p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#607d8b]">JRSPC Hardware Enterprise</div>
              <div className="mt-1 text-[16px] font-extrabold tracking-[0.6px] text-[#1a3557]">Purchase Order</div>
              <div className="mt-1 text-[10px] text-[#90a4ae]">Generated from the purchasing registry</div>
            </div>

            <div className="rounded-sm border border-[#d3dee7] bg-[#f8fbfd] px-3 py-2">
              <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#607d8b]">PO Number</div>
              <div className="mt-1 font-mono text-[14px] font-bold text-[#0070b8]">
                {isLoading ? <Skeleton className="h-4 w-28" /> : purchaseOrder?.poNumber ?? "N/A"}
              </div>
              <div className="mt-2 grid gap-2">
                <div className="text-[10px] text-[#607d8b]">
                  Current: <span className="font-bold text-[#1a3557]">{isLoading ? "..." : statusLabel(purchaseOrder?.status)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={allowedStatuses.includes(nextStatus) ? nextStatus : purchaseOrder?.status ?? ""}
                    onChange={(event) => setNextStatus(event.target.value)}
                    disabled={
                      isLoading ||
                      updateStatusMutation.isPending ||
                      purchaseOrder?.status === "received" ||
                      purchaseOrder?.status === "cancelled"
                    }
                    className="erp-select h-8 min-w-[180px] text-[11px]"
                  >
                    {allowedStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!purchaseOrder?.id) return;
                      await updateStatusMutation.mutateAsync({ purchaseOrderId: purchaseOrder.id, status: nextStatus });
                    }}
                    disabled={
                      isLoading ||
                      updateStatusMutation.isPending ||
                      !purchaseOrder?.id ||
                      !nextStatus ||
                      nextStatus === purchaseOrder?.status
                    }
                    className="inline-flex h-8 items-center justify-center rounded-sm bg-[#0070b8] px-3 text-[11px] font-bold text-white transition hover:bg-[#005a94] disabled:cursor-not-allowed disabled:bg-[#b0bec5]"
                  >
                    {updateStatusMutation.isPending ? "Saving..." : "Update"}
                  </button>
                </div>
                {updateStatusMutation.isError ? (
                  <div className="text-[10px] text-[#c62828]">
                    Failed to update status
                    {updateStatusMutation.error?.response?.data?.message ? `: ${updateStatusMutation.error.response.data.message}` : "."}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 border-t border-[#e3ebf1] pt-4 md:grid-cols-2">
            <div className="rounded-sm border border-[#e3ebf1] bg-white p-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#607d8b]">Supplier</div>
              <div className="mt-1 text-[12px] font-bold text-[#1a3557]">
                {isLoading ? <Skeleton className="h-3 w-40" /> : getSupplierName(purchaseOrder?.supplier)}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#90a4ae]">Order Date</div>
                  <div className="mt-0.5 font-bold text-[#1a3557]">{isLoading ? "..." : formatDate(purchaseOrder?.orderDate)}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#90a4ae]">Expected Date</div>
                  <div className="mt-0.5 font-bold text-[#1a3557]">{isLoading ? "..." : formatDate(purchaseOrder?.expectedDate)}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#90a4ae]">Payment Term</div>
                  <div className="mt-0.5 font-bold text-[#1a3557]">
                    {isLoading
                      ? "..."
                      : purchaseOrder?.paymentTerm
                        ? `${purchaseOrder.paymentTerm.name}${purchaseOrder.paymentTerm.days ? ` (${purchaseOrder.paymentTerm.days}d)` : ""}`
                        : "Cash / None"}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#90a4ae]">Status</div>
                  <div className="mt-0.5 font-bold text-[#1a3557]">{isLoading ? "..." : statusLabel(purchaseOrder?.status)}</div>
                </div>
              </div>
            </div>

            <div className="rounded-sm border border-[#e3ebf1] bg-white p-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#607d8b]">Receiving Details</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#90a4ae]">Received At</div>
                  <div className="mt-0.5 font-bold text-[#1a3557]">{isLoading ? "..." : formatDate(purchaseOrder?.receivedAt)}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#90a4ae]">Received Total</div>
                  <div className="mt-0.5 font-bold text-[#1a3557]">
                    {isLoading ? "..." : purchaseOrder?.receivedTotal != null ? formatMoney(purchaseOrder.receivedTotal) : "N/A"}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#90a4ae]">Received Notes</div>
                  <div className="mt-0.5 text-[#1a3557]">{isLoading ? "..." : purchaseOrder?.receivedNotes ?? "—"}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-sm border border-[#e3ebf1]">
            <table className="w-full min-w-[760px] text-[11px]">
              <thead className="bg-[#f3f6f9]">
                <tr className="text-left text-[10px] font-bold uppercase tracking-[0.6px] text-[#546e7a]">
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Unit Cost</th>
                  <th className="px-3 py-2 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={`po-item-sk-${index}`} className="border-t border-[#e3ebf1]">
                      <td className="px-3 py-2"><Skeleton className="h-3 w-56" /></td>
                      <td className="px-3 py-2 text-right"><Skeleton className="ml-auto h-3 w-10" /></td>
                      <td className="px-3 py-2 text-right"><Skeleton className="ml-auto h-3 w-16" /></td>
                      <td className="px-3 py-2 text-right"><Skeleton className="ml-auto h-3 w-20" /></td>
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr className="border-t border-[#e3ebf1]">
                    <td colSpan={4} className="px-3 py-8 text-center text-[11px] italic text-[#90a4ae]">
                      No line items found.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="border-t border-[#e3ebf1]">
                      <td className="px-3 py-2 font-bold text-[#1a3557]">
                        {item.variantName ? `${item.productName} ${item.variantName}` : item.productName}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-[#1a3557]">{item.quantity}</td>
                      <td className="px-3 py-2 text-right font-mono text-[#1a3557]">{formatMoney(item.unitCost)}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-[#1a3557]">{formatMoney(item.lineTotal)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-sm border border-[#e3ebf1] bg-[#f8fbfd] p-3 text-[11px]">
              <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#607d8b]">Notes</div>
              <div className="mt-1 whitespace-pre-wrap text-[#1a3557]">{purchaseOrder?.notes ? purchaseOrder.notes : "—"}</div>
            </div>

            <div className="rounded-sm border border-[#e3ebf1] bg-white p-3 text-[11px]">
              <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#607d8b]">Totals</div>
              <div className="mt-2 space-y-2 border-t border-[#e3ebf1] pt-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#1a3557]">Items Subtotal</span>
                  <span className="font-mono font-bold text-[#1a3557]">{formatMoney(purchaseOrder?.itemsSubtotal ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-bold text-[#1a3557]">Total Amount</span>
                  <span className="font-mono text-[16px] font-extrabold text-[#0070b8]">
                    {formatMoney(purchaseOrder?.totalAmount ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
