import { useDeferredValue, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ConfirmationModal } from "@/shared/components/common/ConfirmationModal";
import { Pagination } from "@/shared/components/common/Pagination";
import { Skeleton, TableSkeleton } from "@/shared/components/common/Skeleton";
import { RejectReasonModal } from "@/shared/components/common/RejectReasonModal";
import { useNotification } from "@/shared/hooks/useNotification";
import {
  approveStockAdjustment,
  getStockAdjustments,
  rejectStockAdjustment,
  submitStockAdjustment
} from "@/modules/inventory/api/inventory.api";

const STATUS_OPTIONS = [
  { value: "", label: "All Status" },
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" }
];

const REASON_OPTIONS = [
  { value: "", label: "All Reasons" },
  { value: "damaged", label: "Damaged / Spoiled" },
  { value: "recount", label: "Physical Recount" },
  { value: "returned", label: "Customer Return" },
  { value: "lost", label: "Lost / Shrinkage" },
  { value: "initial", label: "Initial Stock Entry" },
  { value: "other", label: "Other" }
];

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

function formatDate(value) {
  if (!value) return "N/A";
  return new Intl.DateTimeFormat("en-PH", { year: "numeric", month: "short", day: "2-digit" }).format(new Date(value));
}

export function StockAdjustmentsPage() {
  const navigate = useNavigate();
  const notify = useNotification();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const deferredSearch = useDeferredValue(searchInput.trim().toLowerCase());
  const [statusFilter, setStatusFilter] = useState("");
  const [reasonFilter, setReasonFilter] = useState("");

  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);

  const {
    data: adjustmentsResponse,
    isLoading: isAdjustmentsLoading,
    isError: isAdjustmentsError,
    error: adjustmentsError,
    isFetching: isAdjustmentsFetching
  } = useQuery({
    queryKey: ["stock-adjustments", page, deferredSearch, statusFilter, reasonFilter],
    queryFn: () =>
      getStockAdjustments({
        page,
        perPage: 10,
        ...(deferredSearch ? { search: deferredSearch } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(reasonFilter ? { reason: reasonFilter } : {})
      })
  });

  const adjustmentRows = adjustmentsResponse?.data ?? [];
  const meta = adjustmentsResponse?.meta ?? {};
  const total = Number(meta.total ?? 0);
  const currentPage = Number(meta.currentPage ?? page);
  const lastPage = Number(meta.lastPage ?? 1);

  const submitMutation = useMutation({
    mutationFn: (id) => submitStockAdjustment(id),
    onSuccess: async () => {
      notify.success("Stock adjustment submitted.");
      await queryClient.invalidateQueries({ queryKey: ["stock-adjustments"] });
    },
    onError: (mutationError) => {
      notify.error(mutationError?.response?.data?.message ?? "Failed to submit stock adjustment.");
    }
  });

  const approveMutation = useMutation({
    mutationFn: (id) => approveStockAdjustment(id),
    onSuccess: async () => {
      notify.success("Stock adjustment approved.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["stock-adjustments"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory-overview"] })
      ]);
      setApproveTarget(null);
    },
    onError: (mutationError) => {
      notify.error(mutationError?.response?.data?.message ?? "Failed to approve stock adjustment.");
    }
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason: rejectReason }) => rejectStockAdjustment(id, rejectReason),
    onSuccess: async () => {
      notify.success("Stock adjustment rejected.");
      await queryClient.invalidateQueries({ queryKey: ["stock-adjustments"] });
      setRejectTarget(null);
    },
    onError: (mutationError) => {
      notify.error(mutationError?.response?.data?.message ?? "Failed to reject stock adjustment.");
    }
  });

  async function confirmReject(reason) {
    if (!rejectTarget) return;
    rejectMutation.mutate({ id: rejectTarget.id, reason });
  }

  return (
    <div className="space-y-4">
      <section className="erp-page-section erp-page-section-joined">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <i className="fas fa-sliders text-[18px] text-[#90caf9]" />
            <div>
              <div className="erp-page-title">Stock Adjustments</div>
              <div className="erp-page-description">Draft, submit, approve, and audit stock corrections.</div>
            </div>
          </div>

          <button type="button" onClick={() => navigate("/stock-adjustments/create")} className="erp-header-primary-button">
            <i className="fas fa-plus mr-1.5" />
            New Adjustment
          </button>
        </div>

        <div className="erp-page-filters">
          <div className="erp-filter-label">
            <i className="fas fa-filter mr-1" />
            Filters
          </div>

          <div className="relative min-w-[220px] flex-1 md:max-w-[380px]">
            <i className="fas fa-search pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
            <input
              value={searchInput}
              onChange={(event) => {
                setPage(1);
                setSearchInput(event.target.value);
              }}
              placeholder="Search adjustment ID..."
              className="erp-input pl-7"
            />
          </div>

          <div className="relative min-w-[200px]">
            <i className="fas fa-flag pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
            <select
              value={statusFilter}
              onChange={(event) => {
                setPage(1);
                setStatusFilter(event.target.value);
              }}
              className="erp-select pl-7"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="relative min-w-[220px]">
            <i className="fas fa-tag pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
            <select
              value={reasonFilter}
              onChange={(event) => {
                setPage(1);
                setReasonFilter(event.target.value);
              }}
              className="erp-select pl-7"
            >
              {REASON_OPTIONS.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="table-card erp-page-main-card-joined">
        {isAdjustmentsError ? (
          <div className="px-4 py-10 text-[11px] text-[#c62828]">
            Failed to load stock adjustments{adjustmentsError?.message ? `: ${adjustmentsError.message}` : "."}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className={`erp-table w-full min-w-[980px] ${isAdjustmentsLoading ? "opacity-70" : ""}`}>
                <thead>
                  <tr>
                    <th className="w-[64px]">#</th>
                    <th>Adjustment #</th>
                    <th>Date</th>
                    <th>Reason</th>
                    <th className="!text-right">Items</th>
                    <th className="!text-center">Status</th>
                    <th className="!text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isAdjustmentsLoading ? (
                    <TableSkeleton rows={7}>
                      {(index) => (
                        <tr key={`adj-sk-${index}`}>
                          <td><Skeleton className="h-3 w-10" /></td>
                          <td><Skeleton className="h-3 w-32" /></td>
                          <td><Skeleton className="h-3 w-20" /></td>
                          <td><Skeleton className="h-3 w-44" /></td>
                          <td><Skeleton className="ml-auto h-3 w-10" /></td>
                          <td><Skeleton className="mx-auto h-5 w-20" /></td>
                          <td><Skeleton className="ml-auto h-7 w-28" /></td>
                        </tr>
                      )}
                    </TableSkeleton>
                  ) : adjustmentRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-[12px] text-[#90a4ae]">
                        No stock adjustments found.
                      </td>
                    </tr>
                  ) : (
                    adjustmentRows.map((row, index) => (
                      <tr key={row.id}>
                        <td className="font-mono text-[11px] text-[#90a4ae]">{(currentPage - 1) * 10 + index + 1}</td>
                        <td className="font-semibold text-[#1a3557]">
                          <button
                            type="button"
                            className="erp-btn-link text-[#1a3557] hover:text-[#0f2745]"
                            onClick={() => navigate(`/stock-adjustments/${row.id}`)}
                            title="View adjustment"
                          >
                            {row.adjustmentNumber}
                          </button>
                        </td>
                        <td className="text-[11px] text-[#607d8b]">{formatDate(row.adjustmentDate)}</td>
                        <td className="text-[11px] text-[#607d8b]">{row.reason || "—"}</td>
                        <td className="text-right font-mono text-[#607d8b]">{row.itemCount ?? 0}</td>
                        <td className="text-center">
                          <span className={`erp-status-badge ${statusBadgeClass(row.status)}`}>
                            <span className="erp-status-badge-dot" />
                            {row.status}
                          </span>
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              className="erp-btn-link text-[#0070b8] hover:text-[#005a94]"
                              onClick={() => navigate(`/stock-adjustments/${row.id}`)}
                              title="View adjustment"
                            >
                              <i className="fas fa-eye text-[15px]" />
                            </button>
                          <button
                            type="button"
                            className={`erp-btn-link ${row.status === "draft" ? "text-[#546e7a] hover:text-[#37474f]" : "text-[#b0bec5]"}`}
                            onClick={row.status === "draft" ? () => navigate(`/stock-adjustments/${row.id}/edit`) : undefined}
                            disabled={row.status !== "draft"}
                            title={row.status === "draft" ? "Edit adjustment" : "Only draft adjustments can be edited"}
                          >
                            <i className="fas fa-pen-to-square text-[15px]" />
                          </button>
                          {row.status === "draft" ? (
                            <button
                              type="button"
                              className="erp-button-secondary"
                              onClick={() => submitMutation.mutate(row.id)}
                              disabled={submitMutation.isPending || isAdjustmentsFetching}
                            >
                              Submit
                            </button>
                          ) : row.status === "pending" ? (
                            <>
                              <button
                                type="button"
                                className="erp-button-secondary"
                                onClick={() => setRejectTarget(row)}
                                disabled={rejectMutation.isPending || isAdjustmentsFetching}
                              >
                                Reject
                              </button>
                              <button
                                type="button"
                                className="erp-button-primary"
                                onClick={() => setApproveTarget(row)}
                                disabled={approveMutation.isPending || isAdjustmentsFetching}
                              >
                                Approve
                              </button>
                            </>
                          ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={currentPage}
              lastPage={lastPage}
              perPage={10}
              total={total}
              itemLabel="adjustments"
              loading={isAdjustmentsFetching}
              onPrevious={() => setPage(Math.max(1, currentPage - 1))}
              onNext={() => setPage(Math.min(lastPage, currentPage + 1))}
              onGoto={(nextPage) => setPage(nextPage)}
            />
          </>
        )}
      </section>

      <ConfirmationModal
        show={Boolean(approveTarget)}
        title="Approve Adjustment"
        message={approveTarget ? `Approve ${approveTarget.adjustmentNumber}? This will update stock and create movement logs.` : ""}
        type="warning"
        showCancel
        confirmText={approveMutation.isPending ? "Approving..." : "Approve"}
        cancelText="Cancel"
        onConfirm={() => approveTarget && approveMutation.mutate(approveTarget.id)}
        onClose={() => setApproveTarget(null)}
      />

      <RejectReasonModal
        show={Boolean(rejectTarget)}
        title="Reject Adjustment"
        subtitle={rejectTarget ? `Reject ${rejectTarget.adjustmentNumber}` : ""}
        isSubmitting={rejectMutation.isPending}
        onClose={() => setRejectTarget(null)}
        onSubmit={(reason) => {
          confirmReject(reason);
          setRejectTarget(null);
        }}
      />
    </div>
  );
}
