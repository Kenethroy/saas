import { useDeferredValue, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ConfirmationModal } from "@/shared/components/common/ConfirmationModal";
import { FormModal } from "@/shared/components/common/FormModal";
import { Skeleton } from "@/shared/components/common/Skeleton";
import { useNotification } from "@/shared/hooks/useNotification";
import {
  createPaymentTerm,
  deletePaymentTerm,
  updatePaymentTerm
} from "@/modules/payment-terms/api/payment-terms.api";
import { usePaymentTerms } from "@/modules/payment-terms/hooks/usePaymentTerms";

const paymentTermFormSchema = z.object({
  name: z.string().trim().min(1, "Payment term name is required").max(100, "Payment term name is too long"),
  days: z.coerce.number().int().min(0, "Days must be zero or more")
});

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

function PaymentTermCardSkeleton() {
  return (
    <article className="erp-entity-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-5 w-14" />
      </div>
      <div className="erp-entity-card-panel mt-4 text-center">
        <Skeleton className="mx-auto h-3 w-20" />
        <Skeleton className="mx-auto mt-2 h-7 w-16" />
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-[#e3ebf1] pt-3">
        <Skeleton className="h-3 w-24" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
    </article>
  );
}

function StatusBadge({ active }) {
  return (
    <span
      className={`erp-status-badge ${
        active
          ? "border-[#c2ddbe] bg-[#f3faf1] text-[#356b37]"
          : "border-[#c8d3db] bg-[#f8fafb] text-[#5f7283]"
      }`}
    >
      <span className="erp-status-badge-dot" />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export function PaymentTermsPage() {
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingTerm, setEditingTerm] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const deferredSearch = useDeferredValue(searchInput.trim());
  const queryClient = useQueryClient();
  const notify = useNotification();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(paymentTermFormSchema),
    defaultValues: {
      name: "",
      days: 0
    }
  });

  const { data, isLoading, isError, error } = usePaymentTerms({
    ...(deferredSearch ? { search: deferredSearch } : {}),
    ...(statusFilter !== "" ? { status: statusFilter === "1" } : {})
  });

  const createMutation = useMutation({
    mutationFn: createPaymentTerm,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["payment-terms"] });
      notify.success("Payment term created successfully");
      reset();
      setShowForm(false);
      setEditingTerm(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updatePaymentTerm(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["payment-terms"] });
      notify.success("Payment term updated successfully");
      reset();
      setShowForm(false);
      setEditingTerm(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deletePaymentTerm,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["payment-terms"] });
      notify.success("Payment term deleted successfully");
      setDeleteTarget(null);
    }
  });

  const paymentTerms = data?.data ?? [];

  function clearFilters() {
    setSearchInput("");
    setStatusFilter("");
  }

  function closeForm() {
    reset({
      name: "",
      days: 0
    });
    setEditingTerm(null);
    setShowForm(false);
  }

  function openCreateForm() {
    reset({
      name: "",
      days: 0
    });
    setEditingTerm(null);
    setShowForm(true);
  }

  function openEditForm(term) {
    reset({
      name: term.name ?? "",
      days: term.days ?? 0
    });
    setEditingTerm(term);
    setShowForm(true);
  }

  async function onSubmit(values) {
    const payload = {
      name: values.name,
      days: values.days
    };

    if (editingTerm) {
      await updateMutation.mutateAsync({
        id: editingTerm.id,
        payload
      });
      return;
    }

    await createMutation.mutateAsync(payload);
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }

    await deleteMutation.mutateAsync(deleteTarget.id);
  }

  const formBusy = isSubmitting || createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <section className="erp-page-section">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <i className="fas fa-calendar-check text-[18px] text-[#90caf9]" />
            <div>
              <div className="erp-page-title">Payment Terms</div>
              <div className="erp-page-description">Credit periods and due-date standards</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openCreateForm}
              className="erp-header-primary-button"
            >
              <i className="fas fa-plus mr-1.5" />
              Add Payment Term
            </button>
          </div>
        </div>

        <div className="erp-page-filters">
          <div className="erp-filter-label">
            <i className="fas fa-filter mr-1" />
            Filters
          </div>

          <div className="relative min-w-[220px] flex-1 md:max-w-[280px]">
            <i className="fas fa-search pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search payment terms..."
              className="erp-input pl-7"
            />
          </div>

          <div className="relative min-w-[140px]">
            <i className="fas fa-signal pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="erp-select pl-7"
            >
              <option value="">All Status</option>
              <option value="1">Active</option>
              <option value="0">Inactive</option>
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

      {isError ? (
        <section className="rounded-sm border border-[#ef9a9a] bg-[#fff5f5] px-4 py-8 text-[11px] text-[#c62828]">
          Failed to load payment terms{error?.message ? `: ${error.message}` : "."}
        </section>
      ) : (
        <section className="space-y-4">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <PaymentTermCardSkeleton key={index} />
              ))}
            </div>
          ) : paymentTerms.length === 0 ? (
            <section className="app-shell-card px-4 py-0">
              <div className="flex min-h-[220px] items-center justify-center text-[11px] italic text-[#90a4ae]">
                No payment terms found for the current filters.
              </div>
            </section>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {paymentTerms.map((term) => (
                <article
                  key={term.id}
                  className="erp-entity-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-[13px] font-bold text-[#1a3557]">{term.name}</h2>
                      <p className="mt-1 text-[10px] text-[#607d8b]">Term #{term.id}</p>
                    </div>
                    <StatusBadge active={term.status} />
                  </div>

                  <div className="erp-entity-card-panel mt-4 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#607d8b]">Credit Days</p>
                    <p className="mt-1 text-[28px] font-bold text-[#1a3557]">{term.days}</p>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-[#e3ebf1] pt-3">
                    <div className="text-[10px] text-[#90a4ae]">
                      Updated <span className="font-bold text-[#607d8b]">{formatDate(term.updatedAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditForm(term)}
                        className="erp-icon-button-md"
                        title="Edit payment term"
                      >
                        <i className="fas fa-pen text-[11px]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(term)}
                        className="erp-icon-button-danger-md"
                        title="Delete payment term"
                      >
                        <i className="fas fa-trash text-[11px]" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <FormModal
        show={showForm}
        title={editingTerm ? "Edit Payment Term" : "Add Payment Term"}
        size="lg"
        onClose={closeForm}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <p className="text-[10px] text-[#546e7a]">
            {editingTerm
              ? "Update the payment term used in customer and invoice due-date rules."
              : "Create a reusable payment term for credit sales and invoicing."}
          </p>

          <div>
            <label className="erp-label">Payment Term Name</label>
            <input
              {...register("name")}
              className="erp-input"
              placeholder="e.g. Net 30"
            />
            {errors.name ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.name.message}</p> : null}
          </div>

          <div>
            <label className="erp-label">Days</label>
            <input
              type="number"
              {...register("days")}
              className="erp-input"
              placeholder="e.g. 30"
            />
            {errors.days ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.days.message}</p> : null}
          </div>

          {createMutation.isError || updateMutation.isError ? (
            <div className="rounded-sm border border-[#ef9a9a] bg-[#fff5f5] px-4 py-3 text-[11px] text-[#c62828]">
              Failed to {editingTerm ? "update" : "create"} payment term
              {(updateMutation.error?.response?.data?.message || createMutation.error?.response?.data?.message)
                ? `: ${updateMutation.error?.response?.data?.message ?? createMutation.error?.response?.data?.message}`
                : "."}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={closeForm} className="erp-button-secondary">
              Cancel
            </button>
            <button type="submit" disabled={formBusy} className="erp-button-primary">
              {formBusy ? "Saving..." : editingTerm ? "Update Payment Term" : "Create Payment Term"}
            </button>
          </div>
        </form>
      </FormModal>

      <ConfirmationModal
        show={Boolean(deleteTarget)}
        title="Delete Payment Term"
        message={deleteTarget ? `Are you sure you want to delete ${deleteTarget.name}?` : ""}
        type="error"
        showCancel
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
