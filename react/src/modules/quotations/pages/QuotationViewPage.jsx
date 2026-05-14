import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ConfirmationModal } from "@/shared/components/common/ConfirmationModal";
import { Skeleton } from "@/shared/components/common/Skeleton";
import { useNotification } from "@/shared/hooks/useNotification";
import { convertQuotation, getQuotationById, getQuotationPdf, updateQuotationStatus } from "@/modules/quotations/api/quotations.api";
import { canEditQuotation, getAllowedQuotationStatuses } from "@/modules/quotations/utils/status";
import { extractBlobErrorMessage, openPdfViewer } from "@/shared/utils/pdf";

const statusOptions = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
  { value: "converted", label: "Converted" }
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
  if (status === "converted") return "Converted";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getAgentName(agent) {
  if (!agent) return "Unassigned";
  return [agent.firstName, agent.lastName].filter(Boolean).join(" ");
}

export function QuotationViewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const notify = useNotification();
  const queryClient = useQueryClient();
  const [nextStatus, setNextStatus] = useState("");
  const [confirmState, setConfirmState] = useState(null);
  const [isPdfViewerOpening, setIsPdfViewerOpening] = useState(false);

  const { data: response, isLoading, isError, error } = useQuery({
    queryKey: ["quotation", id],
    enabled: Boolean(id),
    queryFn: () => getQuotationById(id)
  });

  const quotation = response?.data ?? null;
  const items = quotation?.items ?? [];

  const allowedStatuses = useMemo(
    () => getAllowedQuotationStatuses(quotation?.status),
    [quotation?.status]
  );

  const allowedStatusOptions = useMemo(
    () => statusOptions.filter((option) => allowedStatuses.includes(option.value)),
    [allowedStatuses]
  );

  useEffect(() => {
    if (quotation?.status) {
      setNextStatus(quotation.status);
    }
  }, [quotation?.status]);

  const updateStatusMutation = useMutation({
    mutationFn: ({ quotationId, status }) => updateQuotationStatus(quotationId, status),
    onSuccess: async (response, variables) => {
      notify.success(`Quotation marked as ${statusLabel(variables.status).toLowerCase()}.`);
      await queryClient.invalidateQueries({ queryKey: ["quotation", id] });
      await queryClient.invalidateQueries({ queryKey: ["quotations"] });

      if (variables.status === "accepted") {
        setConfirmState({
          title: "Convert to Sales Order",
          message: `${response.data.quoteNumber} is now accepted. Do you want to convert it into a sales order now?`,
          type: "warning",
          confirmText: "Convert Now",
          action: async () => {
            if (!response.data?.id) return;
            await convertMutation.mutateAsync(response.data.id);
          }
        });
      }
    }
  });

  const convertMutation = useMutation({
    mutationFn: convertQuotation,
    onSuccess: async (result) => {
      notify.success(`${result.data.quoteNumber} converted to ${result.data.salesOrderNumber}.`);
      await queryClient.invalidateQueries({ queryKey: ["quotation", id] });
      await queryClient.invalidateQueries({ queryKey: ["quotations"] });
      await queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      navigate(`/sales-orders/${result.data.salesOrderId}`);
    },
    onError: (mutationError) => {
      notify.error(mutationError?.response?.data?.message ?? "Failed to convert quotation.");
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

  function openAcceptConfirmation(action) {
    setConfirmState({
      title: "Accept Quotation",
      message: "Accept this quotation? After acceptance, you can choose whether to convert it into a sales order.",
      type: "warning",
      confirmText: "Accept",
      action
    });
  }

  function openStatusConfirmation(status, action) {
    const config = {
      rejected: {
        title: "Reject Quotation",
        message: "Reject this quotation? This will mark it as not approved by the customer.",
        confirmText: "Reject",
        type: "error"
      },
      expired: {
        title: "Expire Quotation",
        message: "Mark this quotation as expired? This should be used when the validity period has passed or the quote is no longer active.",
        confirmText: "Mark Expired",
        type: "warning"
      }
    };

    const selectedConfig = config[status];
    if (!selectedConfig) {
      return;
    }

    setConfirmState({
      ...selectedConfig,
      action
    });
  }

  async function handleOpenQuotationPdf() {
    if (!quotation?.id) {
      return;
    }

    setIsPdfViewerOpening(true);
    try {
      const pdfBlob = await getQuotationPdf(quotation.id);
      const normalizedBlob = pdfBlob instanceof Blob ? pdfBlob : new Blob([pdfBlob], { type: "application/pdf" });

      openPdfViewer(navigate, {
        pdfData: normalizedBlob,
        title: "Quotation PDF",
        subtitle: quotation.quoteNumber,
        documentName: `${quotation.quoteNumber}.pdf`,
        fromPath: `${location.pathname}${location.search}`
      });
    } catch (pdfError) {
      notify.error(await extractBlobErrorMessage(pdfError, "Failed to load quotation PDF."));
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
              onClick={() => navigate("/quotations")}
              className="erp-back-button"
              title="Back to Quotations"
            >
              <i className="fas fa-arrow-left text-[12px]" />
            </button>
            <div>
              <div className="erp-page-title">Quotation Receipt</div>
              <div className="erp-page-description">Receipt-style view for quotation review and conversion</div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            {canEditQuotation(quotation?.status) ? (
              <button
                type="button"
                onClick={() => navigate(`/quotations/${quotation.id}/edit`)}
                className="erp-header-secondary-button"
              >
                <i className="fas fa-pen mr-1.5" />
                Edit
              </button>
            ) : null}
            {quotation?.status === "accepted" ? (
              <button
                type="button"
                onClick={async () => {
                  if (!quotation?.id) return;
                  await convertMutation.mutateAsync(quotation.id);
                }}
                disabled={convertMutation.isPending}
                className="erp-header-secondary-button"
              >
                <i className="fas fa-exchange-alt mr-1.5" />
                {convertMutation.isPending ? "Converting..." : "Convert"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleOpenQuotationPdf}
              disabled={isPdfViewerOpening || !quotation?.id}
              className="erp-header-secondary-button disabled:cursor-not-allowed disabled:opacity-60"
            >
              <i className={`fas ${isPdfViewerOpening ? "fa-spinner fa-spin" : "fa-file-pdf"} mr-1.5`} />
              {isPdfViewerOpening ? "Opening..." : "Quotation PDF"}
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
          Failed to load quotation{error?.message ? `: ${error.message}` : "."}
        </section>
      ) : (
        <section className="erp-page-main-card p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#607d8b]">JRSPC Hardware Enterprise</div>
              <div className="mt-1 text-[16px] font-extrabold tracking-[0.6px] text-[#1a3557]">Quotation</div>
              <div className="mt-1 text-[10px] text-[#90a4ae]">Generated from the quotation registry</div>
            </div>

            <div className="rounded-sm border border-[#d3dee7] bg-[#f8fbfd] px-3 py-2">
              <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#607d8b]">Quote Number</div>
              <div className="mt-1 font-mono text-[14px] font-bold text-[#0070b8]">
                {isLoading ? <Skeleton className="h-4 w-28" /> : quotation?.quoteNumber ?? "N/A"}
              </div>
              <div className="mt-2 grid gap-2">
                <div className="text-[10px] text-[#607d8b]">
                  Current: <span className="font-bold text-[#1a3557]">{isLoading ? "..." : statusLabel(quotation?.status)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={allowedStatuses.includes(nextStatus) ? nextStatus : quotation?.status ?? ""}
                    onChange={(event) => setNextStatus(event.target.value)}
                    disabled={isLoading || updateStatusMutation.isPending || quotation?.status === "converted"}
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
                      if (!quotation?.id) return;
                      const applyStatusUpdate = async () => {
                        await updateStatusMutation.mutateAsync({ quotationId: quotation.id, status: nextStatus });
                      };

                      if (nextStatus === "accepted" && quotation.status !== "accepted") {
                        openAcceptConfirmation(applyStatusUpdate);
                        return;
                      }

                      if (["rejected", "expired"].includes(nextStatus) && nextStatus !== quotation.status) {
                        openStatusConfirmation(nextStatus, applyStatusUpdate);
                        return;
                      }

                      await applyStatusUpdate();
                    }}
                    disabled={
                      isLoading ||
                      updateStatusMutation.isPending ||
                      !quotation?.id ||
                      !nextStatus ||
                      nextStatus === quotation?.status
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
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 border-t border-[#e3ebf1] pt-4 md:grid-cols-2">
            <div className="rounded-sm border border-[#e3ebf1] bg-white p-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#607d8b]">Quoted To</div>
              <div className="mt-1 text-[12px] font-bold text-[#1a3557]">
                {isLoading ? <Skeleton className="h-3 w-40" /> : quotation?.customer?.name ?? "N/A"}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#90a4ae]">Quote Date</div>
                  <div className="mt-0.5 font-bold text-[#1a3557]">{isLoading ? "..." : formatDate(quotation?.quoteDate)}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#90a4ae]">Valid Until</div>
                  <div className="mt-0.5 font-bold text-[#1a3557]">{isLoading ? "..." : formatDate(quotation?.validUntil)}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#90a4ae]">Contact Person</div>
                  <div className="mt-0.5 font-bold text-[#1a3557]">{isLoading ? "..." : quotation?.contactPerson || "N/A"}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#90a4ae]">Payment Term</div>
                  <div className="mt-0.5 font-bold text-[#1a3557]">
                    {isLoading
                      ? "..."
                      : quotation?.paymentTerm
                        ? `${quotation.paymentTerm.name} (${quotation.paymentTerm.days}d)`
                        : "Cash / None"}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-sm border border-[#e3ebf1] bg-white p-3">
              <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#607d8b]">Sales Agent</div>
              <div className="mt-1 text-[12px] font-bold text-[#1a3557]">
                {isLoading ? <Skeleton className="h-3 w-28" /> : getAgentName(quotation?.agent)}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#90a4ae]">Created</div>
                  <div className="mt-0.5 font-bold text-[#1a3557]">{isLoading ? "..." : formatDate(quotation?.createdAt)}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#90a4ae]">Updated</div>
                  <div className="mt-0.5 font-bold text-[#1a3557]">{isLoading ? "..." : formatDate(quotation?.updatedAt)}</div>
                </div>
                {quotation?.salesOrder ? (
                  <div className="col-span-2">
                    <div className="text-[9px] font-bold uppercase tracking-[0.6px] text-[#90a4ae]">Converted Sales Order</div>
                    <button
                      type="button"
                      onClick={() => navigate(`/sales-orders/${quotation.salesOrder.id}`)}
                      className="mt-0.5 font-mono font-bold text-[#0070b8] underline-offset-2 hover:underline"
                    >
                      {quotation.salesOrder.salesOrderNumber}
                    </button>
                  </div>
                ) : null}
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
                    <tr key={`qt-item-sk-${index}`} className="border-t border-[#e3ebf1]">
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
              <div className="mt-1 whitespace-pre-wrap text-[#1a3557]">{quotation?.notes ? quotation.notes : "-"}</div>
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
                  <span className="font-mono font-bold text-[#c62828]">- {formatMoney(quotation?.discountAmount ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between border-t border-[#e3ebf1] pt-2">
                  <span className="text-[12px] font-bold text-[#1a3557]">Total Amount</span>
                  <span className="font-mono text-[16px] font-extrabold text-[#0070b8]">{formatMoney(quotation?.totalAmount ?? 0)}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <ConfirmationModal
        show={Boolean(confirmState)}
        title={confirmState?.title ?? ""}
        message={confirmState?.message ?? ""}
        type={confirmState?.type ?? "warning"}
        showCancel
        confirmText={confirmState?.confirmText ?? "Confirm"}
        cancelText="Cancel"
        onConfirm={async () => {
          const action = confirmState?.action;
          setConfirmState(null);
          await action?.();
        }}
        onClose={() => setConfirmState(null)}
      />
    </div>
  );
}
