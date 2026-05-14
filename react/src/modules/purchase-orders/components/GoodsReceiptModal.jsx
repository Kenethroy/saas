import { useEffect, useState } from "react";
import { FormModal } from "@/shared/components/common/FormModal";

function formatMoney(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2
  }).format(Number(value ?? 0));
}

function formatVariance(value) {
  const abs = Math.abs(value);
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${formatMoney(abs)}`;
}

/**
 * GoodsReceiptModal — shown when user clicks "Mark as Received" on an approved PO.
 * Allows editing actual received quantity and unit cost per line before confirming.
 *
 * Props:
 *   show           {boolean}
 *   purchaseOrder  {object}  — full PO object with items array
 *   isSubmitting   {boolean}
 *   onConfirm      {(grnPayload) => void}
 *   onClose        {() => void}
 */
export function GoodsReceiptModal({ show, purchaseOrder, isSubmitting, onConfirm, onClose }) {
  const [lines, setLines]     = useState([]);
  const [notes, setNotes]     = useState("");

  // Reset form whenever the modal opens with a new PO
  useEffect(() => {
    if (!show || !purchaseOrder) return;
    setNotes("");
    setLines(
      (purchaseOrder.items ?? []).map((item) => ({
        id:               Number(item.id),
        productName:      item.productName ?? "Product",
        variantName:      item.variantName ?? "",
        orderedQty:       Number(item.quantity),
        orderedCost:      Number(item.unitCost),
        orderedLineTotal: Number(item.lineTotal ?? (item.quantity * item.unitCost)),
        receivedQty:      Number(item.quantity),    // pre-fill with ordered
        receivedCost:     Number(item.unitCost)     // pre-fill with ordered
      }))
    );
  }, [show, purchaseOrder]);

  function updateLine(index, field, rawValue) {
    const value = field === "receivedQty"
      ? Math.max(0, Math.trunc(Number(rawValue)))
      : Math.max(0, Number(rawValue));

    setLines((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  const orderedTotal  = lines.reduce((sum, l) => sum + l.orderedLineTotal, 0);
  const receivedTotal = lines.reduce((sum, l) => sum + l.receivedQty * l.receivedCost, 0);
  const variance      = receivedTotal - orderedTotal;
  const hasChanges    = lines.some(
    (l) => l.receivedQty !== l.orderedQty || l.receivedCost !== l.orderedCost
  );

  function handleConfirm(event) {
    event.preventDefault();
    if (isSubmitting) return;

    onConfirm({
      notes: notes.trim() || null,
      items: lines.map((l) => ({
        id:               l.id,
        receivedQuantity: l.receivedQty,
        receivedUnitCost: l.receivedCost
      }))
    });
  }

  if (!show) return null;

  // Show modal immediately — PO data loads inside it
  const isLoading = !purchaseOrder || isSubmitting;

  return (
    <FormModal
      show={show}
      title="Goods Receipt Confirmation"
      size="5xl"
      closeOnClickOutside={!isSubmitting}
      bodyClassName="bg-[#f7fbfe] p-4"
      onClose={onClose}
    >
      {/* Loading state while PO detail is being fetched */}
      {!purchaseOrder ? (
        <div className="flex min-h-[220px] items-center justify-center gap-3 text-[12px] text-[#607d8b]">
          <i className="fas fa-spinner fa-spin text-[18px] text-[#0070b8]" />
          <span>Loading order details…</span>
        </div>
      ) : (
        <form onSubmit={handleConfirm} className="space-y-4">
          {/* Header */}
          <div className="rounded-sm border border-[#b8d4ea] bg-[#f4f9fd] px-4 py-3">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#607d8b]">Purchase Order</div>
                <div className="mt-0.5 font-mono text-[13px] font-bold text-[#1a3557]">{purchaseOrder.poNumber}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#607d8b]">Supplier</div>
                <div className="mt-0.5 text-[12px] font-bold text-[#1a3557]">{purchaseOrder.supplier?.name ?? purchaseOrder.supplierName ?? "—"}</div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#607d8b]">PO Estimated Total</div>
                <div className="mt-0.5 text-[13px] font-bold text-[#1a3557]">{formatMoney(purchaseOrder.totalAmount)}</div>
              </div>
            </div>
          </div>

          {/* Instruction banner */}
          <div className="rounded-sm border border-[#ffe082] bg-[#fff8e1] px-3 py-2 text-[11px] text-[#7a5f00] leading-relaxed">
            <i className="fas fa-triangle-exclamation mr-1.5" />
            Review and adjust the <strong>actual received quantity</strong> and <strong>actual unit cost</strong> per item
            before confirming. These values will be recorded as the final payable amounts and will update inventory stock.
          </div>

          {/* Line items table */}
          <div className="overflow-x-auto rounded-sm border border-[#d3dee7]">
            <table className="w-full min-w-[680px] text-[11px]">
              <thead>
                <tr className="border-b border-[#d3dee7] bg-[#f0f6fb]">
                  <th className="px-3 py-2 text-left font-bold text-[#546e7a]">Item</th>
                  <th className="px-3 py-2 text-center font-bold text-[#546e7a]">Ordered Qty</th>
                  <th className="px-3 py-2 text-center font-bold text-[#546e7a] w-[110px]">Received Qty</th>
                  <th className="px-3 py-2 text-right font-bold text-[#546e7a]">PO Unit Cost</th>
                  <th className="px-3 py-2 text-right font-bold text-[#546e7a] w-[130px]">Actual Unit Cost</th>
                  <th className="px-3 py-2 text-right font-bold text-[#546e7a]">Received Total</th>
                  <th className="px-3 py-2 text-right font-bold text-[#546e7a]">Variance</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => {
                  const receivedLineTotal = line.receivedQty * line.receivedCost;
                  const lineVariance      = receivedLineTotal - line.orderedLineTotal;
                  const changed = line.receivedQty !== line.orderedQty || line.receivedCost !== line.orderedCost;

                  return (
                    <tr
                      key={line.id}
                      className={`border-b border-[#e3ebf1] transition-colors ${changed ? "bg-[#fffde7]" : "bg-white"}`}
                    >
                      {/* Item name */}
                      <td className="px-3 py-2">
                        <div className="font-bold text-[#1a3557]">{line.productName}</div>
                        <div className="text-[9px] text-[#90a4ae]">{line.variantName}</div>
                      </td>

                      {/* Ordered qty (read-only) */}
                      <td className="px-3 py-2 text-center text-[#607d8b]">{line.orderedQty}</td>

                      {/* Received qty (editable) */}
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={line.receivedQty}
                          onChange={(e) => updateLine(index, "receivedQty", e.target.value)}
                          disabled={isSubmitting}
                          className={`erp-input text-center ${line.receivedQty !== line.orderedQty ? "border-[#f59e0b] bg-[#fffbeb]" : ""}`}
                        />
                        {line.receivedQty < line.orderedQty && (
                          <div className="mt-0.5 text-[9px] text-[#d97706]">
                            Short by {line.orderedQty - line.receivedQty}
                          </div>
                        )}
                      </td>

                      {/* PO unit cost (read-only) */}
                      <td className="px-3 py-2 text-right font-mono text-[#607d8b]">
                        {formatMoney(line.orderedCost)}
                      </td>

                      {/* Actual unit cost (editable) */}
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.receivedCost}
                          onChange={(e) => updateLine(index, "receivedCost", e.target.value)}
                          disabled={isSubmitting}
                          className={`erp-input text-right ${line.receivedCost !== line.orderedCost ? "border-[#f59e0b] bg-[#fffbeb]" : ""}`}
                        />
                      </td>

                      {/* Received line total */}
                      <td className="px-3 py-2 text-right font-mono font-bold text-[#1a3557]">
                        {formatMoney(receivedLineTotal)}
                      </td>

                      {/* Variance */}
                      <td className={`px-3 py-2 text-right font-mono font-bold ${lineVariance > 0 ? "text-[#c62828]" : lineVariance < 0 ? "text-[#356b37]" : "text-[#90a4ae]"}`}>
                        {lineVariance === 0 ? "—" : formatVariance(lineVariance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals summary */}
          <div className="rounded-sm border border-[#d3dee7] bg-[#f8fbfd] p-4">
            <div className="grid gap-2 text-[11px] sm:grid-cols-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#607d8b]">PO Estimated Total</span>
                <span className="font-mono text-[14px] font-bold text-[#1a3557]">{formatMoney(orderedTotal)}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#607d8b]">Actual Payable Total</span>
                <span className="font-mono text-[14px] font-bold text-[#0070b8]">{formatMoney(receivedTotal)}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#607d8b]">Total Variance</span>
                <span className={`font-mono text-[14px] font-bold ${variance > 0 ? "text-[#c62828]" : variance < 0 ? "text-[#356b37]" : "text-[#90a4ae]"}`}>
                  {variance === 0 ? "No variance" : formatVariance(variance)}
                </span>
              </div>
            </div>

            {hasChanges && (
              <div className="mt-3 rounded-sm border border-[#cfe0ec] bg-[#f6fbff] px-3 py-2 text-[10px] text-[#315775]">
                <i className="fas fa-circle-info mr-1.5" />
                Changes detected from original PO values — highlighted rows will be recorded with adjusted amounts.
              </div>
            )}
          </div>

          {/* Receipt notes */}
          <div>
            <label className="erp-label" htmlFor="grn-notes">Receipt Notes <span className="font-normal text-[#90a4ae]">(optional)</span></label>
            <textarea
              id="grn-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isSubmitting}
              placeholder="e.g. Delivery note #12345, partial shipment, damaged packaging..."
              className="erp-input resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="erp-button-secondary"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="erp-button-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-1.5" />
                  Confirming Receipt…
                </>
              ) : (
                <>
                  <i className="fas fa-box-open mr-1.5" />
                  Confirm Goods Receipt
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </FormModal>
  );
}
