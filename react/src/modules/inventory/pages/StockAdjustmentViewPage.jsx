import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfirmationModal } from "@/shared/components/common/ConfirmationModal";
import { Skeleton } from "@/shared/components/common/Skeleton";
import { RejectReasonModal } from "@/shared/components/common/RejectReasonModal";
import { useNotification } from "@/shared/hooks/useNotification";
import {
  approveStockAdjustment,
  deleteStockAdjustment,
  getStockAdjustmentById,
  rejectStockAdjustment,
  submitStockAdjustment
} from "@/modules/inventory/api/inventory.api";

function formatDate(value) {
  if (!value) return "N/A";
  return new Intl.DateTimeFormat("en-PH", { year: "numeric", month: "short", day: "2-digit" }).format(new Date(value));
}

function statusBadgeClass(status) {
  switch (status) {
    case "draft":
      return "border-[#b0bec5] bg-[#f3f6f9] text-[#607d8b]";
    case "pending":
      return "border-[#efd79a] bg-[#fff9ec] text-[#9a6a00]";
    case "approved":
      return "border-[#c2ddbe] bg-[#f3faf1] text-[#356b37]";
    case "rejected":
      return "border-[#ef9a9a] bg-[#fff5f5] text-[#c62828]";
    default:
      return "border-[#b0bec5] bg-[#f3f6f9] text-[#607d8b]";
  }
}

function formatSignedNumber(value) {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "0";
  return numeric > 0 ? `+${numeric}` : String(numeric);
}

export function StockAdjustmentViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const notify = useNotification();
  const queryClient = useQueryClient();

  const adjustmentId = Number(id);

  const [confirmModal, setConfirmModal] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);

  const adjustmentQuery = useQuery({
    queryKey: ["stock-adjustments", "detail", adjustmentId],
    enabled: Number.isFinite(adjustmentId) && adjustmentId > 0,
    queryFn: () => getStockAdjustmentById(adjustmentId)
  });

  const adjustment = adjustmentQuery.data?.data;
  const items = adjustment?.items ?? [];
  const status = String(adjustment?.status ?? "draft");

  const canSubmit = status === "draft";
  const canDelete = status === "draft";
  const canApprove = status === "pending";
  const canReject = status === "pending";
  const canEdit = status === "draft";

  const submitMutation = useMutation({
    mutationFn: () => submitStockAdjustment(adjustmentId),
    onSuccess: async () => {
      notify.success("Stock adjustment submitted.");
      await queryClient.invalidateQueries({ queryKey: ["stock-adjustments"] });
      await queryClient.invalidateQueries({ queryKey: ["stock-adjustments", "detail", adjustmentId] });
    },
    onError: (error) => notify.error(error?.response?.data?.message ?? "Failed to submit stock adjustment.")
  });

  const approveMutation = useMutation({
    mutationFn: () => approveStockAdjustment(adjustmentId),
    onSuccess: async () => {
      notify.success("Stock adjustment approved.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["stock-adjustments"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory-overview"] }),
        queryClient.invalidateQueries({ queryKey: ["stock-adjustments", "detail", adjustmentId] })
      ]);
    },
    onError: (error) => notify.error(error?.response?.data?.message ?? "Failed to approve stock adjustment.")
  });

  const rejectMutation = useMutation({
    mutationFn: (reason) => rejectStockAdjustment(adjustmentId, reason),
    onSuccess: async () => {
      notify.success("Stock adjustment rejected.");
      await queryClient.invalidateQueries({ queryKey: ["stock-adjustments"] });
      await queryClient.invalidateQueries({ queryKey: ["stock-adjustments", "detail", adjustmentId] });
    },
    onError: (error) => notify.error(error?.response?.data?.message ?? "Failed to reject stock adjustment.")
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteStockAdjustment(adjustmentId),
    onSuccess: async () => {
      notify.success("Stock adjustment deleted.");
      await queryClient.invalidateQueries({ queryKey: ["stock-adjustments"] });
      navigate("/stock-adjustments");
    },
    onError: (error) => notify.error(error?.response?.data?.message ?? "Failed to delete stock adjustment.")
  });

  const itemTotals = useMemo(() => {
    const totals = { increases: 0, decreases: 0 };
    for (const item of items) {
      const change = Number(item.quantityChange ?? 0);
      if (!Number.isFinite(change)) continue;
      if (change > 0) totals.increases += change;
      if (change < 0) totals.decreases += Math.abs(change);
    }
    return totals;
  }, [items]);

  function handleRejectSubmit(reason) {
    rejectMutation.mutate(reason);
    setShowRejectModal(false);
  }

  function openDeleteConfirm() {
    setConfirmModal({
      title: "Delete Stock Adjustment",
      message: `Are you sure you want to delete ${adjustment?.adjustmentNumber ?? "this adjustment"}? This action cannot be undone.`,
      type: "error",
      confirmText: "Delete",
      onConfirm: () => deleteMutation.mutateAsync()
    });
  }

  if (adjustmentQuery.isError) {
    return (
      <section className="table-card rounded-[22px] border border-[#efc2c2] bg-white shadow-[0_12px_36px_rgba(26,53,87,0.07)]">
        <div className="px-5 py-10 text-[12px] text-[#c62828]">
          Failed to load stock adjustment{adjustmentQuery.error?.message ? `: ${adjustmentQuery.error.message}` : "."}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="erp-page-section erp-page-section-joined">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate("/stock-adjustments")} className="erp-back-button">
              <i className="fas fa-arrow-left text-[12px]" />
            </button>
            <i className="fas fa-sliders text-[18px] text-[#90caf9]" />
            <div>
              <div className="erp-page-title">Stock Adjustment</div>
              <div className="erp-page-description">
              {adjustmentQuery.isLoading ? (
                <Skeleton className="mt-2 h-3 w-56" />
              ) : (
                <>
                  <span className="font-mono">{adjustment?.adjustmentNumber ?? `#${adjustmentId}`}</span>
                  <span className="mx-2 text-[#b0bec5]">•</span>
                  <span>{formatDate(adjustment?.adjustmentDate)}</span>
                </>
              )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="erp-button-secondary"
              onClick={canEdit ? () => navigate(`/stock-adjustments/${adjustmentId}/edit`) : undefined}
              disabled={!canEdit || adjustmentQuery.isLoading}
              title={canEdit ? "Edit" : "Only draft adjustments can be edited"}
            >
              Edit
            </button>

            {canSubmit ? (
              <button
                type="button"
                className="erp-button-primary"
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending || adjustmentQuery.isLoading}
                title="Submit"
              >
                {submitMutation.isPending ? "Submitting..." : "Submit"}
              </button>
            ) : null}

            {canApprove ? (
              <button
                type="button"
                className="erp-button-primary"
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending || adjustmentQuery.isLoading}
                title="Approve"
              >
                {approveMutation.isPending ? "Approving..." : "Approve"}
              </button>
            ) : null}

            {canReject ? (
              <button
                type="button"
                className="erp-button-secondary"
                onClick={() => setShowRejectModal(true)}
                disabled={rejectMutation.isPending || adjustmentQuery.isLoading}
                title="Reject"
              >
                Reject
              </button>
            ) : null}

            {canDelete ? (
              <button
                type="button"
                className="erp-button-danger"
                onClick={openDeleteConfirm}
                disabled={deleteMutation.isPending || adjustmentQuery.isLoading}
                title="Delete"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            ) : null}
          </div>
        </div>

      </section>

      <section className="table-card erp-page-main-card-joined">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-md border border-[#dde3e8] bg-white px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#546e7a]">Status</div>
            <div className="mt-1">
              {adjustmentQuery.isLoading ? (
                <Skeleton className="h-5 w-20" />
              ) : (
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusBadgeClass(status)}`}>
                  {String(status).toUpperCase()}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-md border border-[#dde3e8] bg-white px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#546e7a]">Reason</div>
            <div className="mt-1 text-[13px] font-semibold text-[#1a3557]">
              {adjustmentQuery.isLoading ? <Skeleton className="h-4 w-40" /> : adjustment?.reason || "—"}
            </div>
          </div>

          <div className="rounded-md border border-[#dde3e8] bg-white px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#546e7a]">Items</div>
            <div className="mt-1 text-[13px] font-semibold text-[#1a3557]">
              {adjustmentQuery.isLoading ? <Skeleton className="h-4 w-16" /> : String(adjustment?.itemCount ?? items.length)}
            </div>
          </div>

          <div className="rounded-md border border-[#dde3e8] bg-white px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#546e7a]">Totals</div>
            <div className="mt-1 text-[12px] text-[#1a3557]">
              {adjustmentQuery.isLoading ? (
                <Skeleton className="h-4 w-28" />
              ) : (
                <>
                  <span className="font-semibold text-[#2e7d32]">+{itemTotals.increases}</span>
                  <span className="mx-1 text-[#b0bec5]">/</span>
                  <span className="font-semibold text-[#c62828]">-{itemTotals.decreases}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {adjustment?.rejectReason ? (
          <div className="mt-4 rounded-md border border-[#efc2c2] bg-[#fff5f5] px-4 py-3 text-[12px] text-[#c62828]">
            <span className="font-bold">Reject reason:</span> {adjustment.rejectReason}
          </div>
        ) : null}

        {adjustment?.remarks ? (
          <div className="mt-4 rounded-md border border-[#dde3e8] bg-white px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.6px] text-[#546e7a]">Remarks</div>
            <div className="mt-1 text-[12px] text-[#37474f] whitespace-pre-wrap">{adjustment.remarks}</div>
          </div>
        ) : null}
      </section>

      <section className="table-card">
        <div className="erp-table-wrapper">
          <table className="erp-table w-full min-w-[980px]">
            <thead>
              <tr>
                <th className="w-[64px]">#</th>
                <th>Product</th>
                <th>Variant</th>
                <th className="!text-center">Restockable</th>
                <th className="!text-right">Before</th>
                <th className="!text-right">Change</th>
                <th className="!text-right">After</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {adjustmentQuery.isLoading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <tr key={`adj-item-skel-${index}`}>
                    <td><Skeleton className="h-3 w-10" /></td>
                    <td><Skeleton className="h-3 w-52" /></td>
                    <td><Skeleton className="h-3 w-40" /></td>
                    <td><Skeleton className="mx-auto h-5 w-16" /></td>
                    <td><Skeleton className="ml-auto h-3 w-12" /></td>
                    <td><Skeleton className="ml-auto h-3 w-12" /></td>
                    <td><Skeleton className="ml-auto h-3 w-12" /></td>
                    <td><Skeleton className="h-3 w-44" /></td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-[12px] text-[#90a4ae]">
                    No items found for this adjustment.
                  </td>
                </tr>
              ) : (
                items.map((item, index) => (
                  <tr key={item.id ?? `${item.productVariantId}-${index}`}>
                    <td className="font-mono text-[11px] text-[#90a4ae]">{index + 1}</td>
                    <td className="font-semibold text-[#1a3557]">{item.productName ?? `Product #${item.productId ?? "—"}`}</td>
                    <td className="text-[11px] text-[#607d8b]">{item.variantName ?? `Variant #${item.productVariantId}`}</td>
                    <td className="text-center text-[11px] text-[#607d8b]">{item.restockFlag ? "Yes" : "No"}</td>
                    <td className="text-right font-mono text-[11px] text-[#607d8b]">{Number(item.quantityBefore ?? 0)}</td>
                    <td className={`text-right font-mono text-[11px] font-bold ${Number(item.quantityChange ?? 0) >= 0 ? "text-[#2e7d32]" : "text-[#c62828]"}`}>
                      {formatSignedNumber(item.quantityChange)}
                    </td>
                    <td className="text-right font-mono text-[11px] text-[#607d8b]">{Number(item.quantityAfter ?? 0)}</td>
                    <td className="text-[11px] text-[#607d8b]">{item.notes || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {confirmModal ? (
        <ConfirmationModal
          show={Boolean(confirmModal)}
          title={confirmModal.title}
          message={confirmModal.message}
          type={confirmModal.type}
          confirmText={confirmModal.confirmText}
          onCancel={() => setConfirmModal(null)}
          onConfirm={async () => {
            await confirmModal.onConfirm?.();
            setConfirmModal(null);
          }}
        />
      ) : null}

      <RejectReasonModal
        show={showRejectModal}
        title="Reject Adjustment"
        subtitle={adjustment?.adjustmentNumber ? `Reject ${adjustment.adjustmentNumber}` : ""}
        initialReason={adjustment?.rejectReason ?? ""}
        isSubmitting={rejectMutation.isPending}
        onClose={() => setShowRejectModal(false)}
        onSubmit={handleRejectSubmit}
      />
    </div>
  );
}
