import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Skeleton } from "@/shared/components/common/Skeleton";
import { useNotification } from "@/shared/hooks/useNotification";
import { getSalesOrderById, getSalesOrderInvoicePdf, updateSalesOrderStatus } from "@/modules/sales-orders/api/sales-orders.api";
import { getAllowedSalesOrderStatuses } from "@/modules/sales-orders/utils/status";
import { canEditSalesOrder } from "@/modules/sales-orders/utils/status";
import { extractBlobErrorMessage, openPdfViewer } from "@/shared/utils/pdf";

const statusOptions = [
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
  if (!status) return "N/A";
  return status
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function SalesOrderViewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const notify = useNotification();
  const queryClient = useQueryClient();
  const [nextStatus, setNextStatus] = useState("");
  const [isInvoiceViewerOpening, setIsInvoiceViewerOpening] = useState(false);

  const { data: response, isLoading, isError, error } = useQuery({
    queryKey: ["sales-order", id],
    enabled: Boolean(id),
    queryFn: () => getSalesOrderById(id)
  });

  const salesOrder = response?.data ?? null;
  const items = salesOrder?.items ?? [];

  const allowedStatuses = useMemo(
    () => getAllowedSalesOrderStatuses(salesOrder?.status),
    [salesOrder?.status]
  );

  const allowedStatusOptions = useMemo(
    () => statusOptions.filter((option) => allowedStatuses.includes(option.value)),
    [allowedStatuses]
  );

  useEffect(() => {
    if (salesOrder?.status) {
      setNextStatus(salesOrder.status);
    }
  }, [salesOrder?.status]);

  const updateStatusMutation = useMutation({
    mutationFn: ({ orderId, status }) => updateSalesOrderStatus(orderId, status),
    onSuccess: async () => {
      notify.success("Sales order status updated");
      await queryClient.invalidateQueries({ queryKey: ["sales-order", id] });
      await queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
    }
  });

  const totals = useMemo(() => {
    const grossSubtotal = items.reduce((sum, item) => sum + Number(item.quantity ?? 0) * Number(item.unitPrice ?? 0), 0);
    const itemDiscountTotal = items.reduce((sum, item) => sum + Number(item.lineDiscount ?? 0), 0);
    const netSubtotal = items.reduce((sum, item) => sum + Number(item.lineTotal ?? 0), 0);

    return {
      grossSubtotal,
      itemDiscountTotal,
      netSubtotal
    };
  }, [items]);

  async function openInvoicePdf() {
    if (!salesOrder?.id) return;

    if (!salesOrder?.invoice?.invoiceNumber) {
      notify.error("Invoice not found for this sales order.");
      return;
    }

    setIsInvoiceViewerOpening(true);
    try {
      const pdfBlob = await getSalesOrderInvoicePdf(salesOrder.id);
      const normalizedBlob = pdfBlob instanceof Blob ? pdfBlob : new Blob([pdfBlob], { type: "application/pdf" });

      if (normalizedBlob.size === 0) {
        throw new Error("Invoice PDF is empty.");
      }

      openPdfViewer(navigate, {
        pdfData: normalizedBlob,
        title: "Invoice PDF",
        subtitle: salesOrder.invoice.invoiceNumber,
        documentName: `${salesOrder.invoice.invoiceNumber}.pdf`,
        fromPath: `${location.pathname}${location.search}`
      });
    } catch (fetchError) {
      const message = await extractBlobErrorMessage(fetchError, "Failed to load invoice PDF.");
      notify.error(message);
    } finally {
      setIsInvoiceViewerOpening(false);
    }
  }

  return (
    <div className="space-y-3">
      <section className="erp-page-section">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/sales-orders")}
              className="erp-back-button"
              title="Back to Sales Orders"
            >
              <i className="fas fa-arrow-left text-[12px]" />
            </button>
            <div>
              <div className="erp-page-title">Sales Order Receipt</div>
              <div className="erp-page-description">Receipt-style view for printing and review</div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            {canEditSalesOrder(salesOrder?.status) ? (
              <button
                type="button"
                onClick={() => navigate(`/sales-orders/${salesOrder.id}/edit`)}
                className="erp-header-secondary-button"
              >
                <i className="fas fa-pen mr-1.5" />
                Edit
              </button>
            ) : null}
            <button
              type="button"
              onClick={openInvoicePdf}
              disabled={
                isInvoiceViewerOpening ||
                !salesOrder?.id ||
                !salesOrder?.invoice?.invoiceNumber ||
                !["delivered", "completed"].includes(salesOrder?.status)
              }
              className="erp-header-secondary-button"
              title="Open invoice PDF"
            >
              <i className="fas fa-file-pdf mr-1.5" />
              {isInvoiceViewerOpening ? "Opening..." : "Invoice PDF"}
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
          Failed to load sales order{error?.message ? `: ${error.message}` : "."}
        </section>
      ) : (
        <>
          {salesOrder?.hasStockShortage ? (
            <section className="rounded-sm border border-[#ef9a9a] bg-[#fff5f5] px-4 py-3 text-[11px] text-[#c62828]">
              <div className="font-bold">Stock shortage detected for this sales order.</div>
              <div className="mt-1">
                {salesOrder.stockShortageCount} item{salesOrder.stockShortageCount === 1 ? "" : "s"} exceed the currently available stock after processing reservations.
              </div>
            </section>
          ) : null}

          <section className="erp-page-main-card p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#607d8b]">JRSPC Hardware Enterprise</div>
              <div className="mt-1 text-[16px] font-extrabold tracking-[0.6px] text-[#1a3557]">Sales Order</div>
              <div className="mt-1 text-[10px] text-[#90a4ae]">Generated from the sales order registry</div>
            </div>

          <div className="rounded-sm border border-[#d3dee7] bg-[#f8fbfd] px-3 py-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#607d8b]">SO Number</div>
            <div className="mt-1 font-mono text-[14px] font-bold text-[#0070b8]">
              {isLoading ? <Skeleton className="h-4 w-28" /> : salesOrder?.salesOrderNumber ?? "N/A"}
            </div>
            <div className="mt-2 grid gap-2">
              <div className="text-[10px] text-[#607d8b]">
                Current: <span className="font-bold text-[#1a3557]">{isLoading ? "..." : statusLabel(salesOrder?.status)}</span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={allowedStatuses.includes(nextStatus) ? nextStatus : salesOrder?.status ?? ""}
                  onChange={(event) => setNextStatus(event.target.value)}
                  disabled={
                    isLoading ||
                    updateStatusMutation.isPending ||
                    salesOrder?.status === "cancelled" ||
                    salesOrder?.status === "completed"
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
                    if (!salesOrder?.id) return;

                    if (nextStatus === "for_delivery") {
                      navigate(`/deliveries/create?salesOrderId=${salesOrder.id}`);
                      return;
                    }

                    await updateStatusMutation.mutateAsync({ orderId: salesOrder.id, status: nextStatus });
                  }}
                  disabled={
                    isLoading ||
                    updateStatusMutation.isPending ||
                    !salesOrder?.id ||
                    !nextStatus ||
                    nextStatus === salesOrder?.status
                  }
                  className="inline-flex h-8 items-center justify-center rounded-sm bg-[#0070b8] px-3 text-[11px] font-bold text-white transition hover:bg-[#005a94] disabled:cursor-not-allowed disabled:bg-[#b0bec5]"
                  title="Update status"
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
              {salesOrder?.hasStockShortage ? (
                <div className="text-[10px] font-semibold text-[#c62828]">
                  Resolve the stock shortage before moving this order deeper into fulfillment.
                </div>
              ) : null}
            </div>
          </div>
          </div>

          <div className="mt-4 grid gap-3 border-t border-[#e3ebf1] pt-4 md:grid-cols-2">
            <div className="rounded-sm border border-[#e3ebf1] bg-white p-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#607d8b]">Bill To</div>
              <div className="mt-1 text-[12px] font-bold text-[#1a3557]">
                {isLoading ? <Skeleton className="h-3 w-40" /> : salesOrder?.customer?.name ?? "N/A"}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#90a4ae]">Order Date</div>
                  <div className="mt-0.5 font-bold text-[#1a3557]">{isLoading ? "..." : formatDate(salesOrder?.orderDate)}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#90a4ae]">Payment Term</div>
                  <div className="mt-0.5 font-bold text-[#1a3557]">
                    {isLoading
                      ? "..."
                      : salesOrder?.paymentTerm
                        ? `${salesOrder.paymentTerm.name} (${salesOrder.paymentTerm.days}d)`
                        : "Cash / None"}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-sm border border-[#e3ebf1] bg-white p-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#607d8b]">Sales Agent</div>
              <div className="mt-1 text-[12px] font-bold text-[#1a3557]">
                {isLoading ? <Skeleton className="h-3 w-28" /> : salesOrder?.agent ? `${salesOrder.agent.firstName} ${salesOrder.agent.lastName}` : "N/A"}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#90a4ae]">Created</div>
                  <div className="mt-0.5 font-bold text-[#1a3557]">{isLoading ? "..." : formatDate(salesOrder?.createdAt)}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#90a4ae]">Updated</div>
                  <div className="mt-0.5 font-bold text-[#1a3557]">{isLoading ? "..." : formatDate(salesOrder?.updatedAt)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-sm border border-[#e3ebf1]">
            <table className="w-full min-w-[780px] text-[11px]">
              <thead className="bg-[#f3f6f9]">
                <tr className="text-left text-[10px] font-bold uppercase tracking-[0.6px] text-[#546e7a]">
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Unit Price</th>
                  <th className="px-3 py-2 text-right">Discount</th>
                  <th className="px-3 py-2 text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={`so-item-sk-${index}`} className="border-t border-[#e3ebf1]">
                      <td className="px-3 py-2"><Skeleton className="h-3 w-56" /></td>
                      <td className="px-3 py-2 text-right"><Skeleton className="ml-auto h-3 w-10" /></td>
                      <td className="px-3 py-2 text-right"><Skeleton className="ml-auto h-3 w-16" /></td>
                      <td className="px-3 py-2 text-right"><Skeleton className="ml-auto h-3 w-12" /></td>
                      <td className="px-3 py-2 text-right"><Skeleton className="ml-auto h-3 w-20" /></td>
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr className="border-t border-[#e3ebf1]">
                    <td colSpan={5} className="px-3 py-8 text-center text-[11px] italic text-[#90a4ae]">
                      No line items found.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const discountAmount = Number(item.lineDiscount ?? 0);

                    return (
                      <tr key={item.id} className="border-t border-[#e3ebf1]">
                        <td className="px-3 py-2">
                          <div className="truncate font-bold text-[#1a3557]">{item.productName}</div>
                          <div className="truncate text-[10px] text-[#607d8b]">{item.variantName}</div>
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-[#1a3557]">{item.quantity}</td>
                        <td className="px-3 py-2 text-right font-mono text-[#1a3557]">{formatMoney(item.unitPrice)}</td>
                        <td className="px-3 py-2 text-right font-mono text-[#c62828]">
                          {discountAmount > 0 ? `- ${formatMoney(discountAmount)}` : "-"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-[#1a3557]">{formatMoney(item.lineTotal)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-sm border border-[#e3ebf1] bg-[#f8fbfd] p-3 text-[11px]">
              <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#607d8b]">Notes</div>
              <div className="mt-1 whitespace-pre-wrap text-[#1a3557]">{salesOrder?.notes ? salesOrder.notes : "—"}</div>
            </div>

            <div className="rounded-sm border border-[#e3ebf1] bg-white p-3 text-[11px]">
              <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#607d8b]">Totals</div>

              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[#607d8b]">Gross Subtotal</span>
                  <span className="font-mono font-bold text-[#1a3557]">{formatMoney(totals.grossSubtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#607d8b]">Item Discounts</span>
                  <span className="font-mono font-bold text-[#c62828]">- {formatMoney(totals.itemDiscountTotal)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-[#e3ebf1] pt-2">
                  <span className="text-[#607d8b]">Net Subtotal</span>
                  <span className="font-mono font-bold text-[#1a3557]">{formatMoney(totals.netSubtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#607d8b]">Overall Discount</span>
                  <span className="font-mono font-bold text-[#c62828]">- {formatMoney(salesOrder?.discountAmount ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-[#e3ebf1] pt-2">
                  <span className="text-[12px] font-bold text-[#1a3557]">Total Amount</span>
                  <span className="font-mono text-[16px] font-extrabold text-[#0070b8]">{formatMoney(salesOrder?.totalAmount ?? 0)}</span>
                </div>
              </div>
            </div>
          </div>
          </section>
        </>
      )}
    </div>
  );
}
