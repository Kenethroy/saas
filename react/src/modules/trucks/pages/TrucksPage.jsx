import { useDeferredValue, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ConfirmationModal } from "@/shared/components/common/ConfirmationModal";
import { FormModal } from "@/shared/components/common/FormModal";
import { Pagination } from "@/shared/components/common/Pagination";
import { Skeleton, TableSkeleton } from "@/shared/components/common/Skeleton";
import { useNotification } from "@/shared/hooks/useNotification";
import { createTruck, deleteTruck, getTrucks, updateTruck } from "@/modules/trucks/api/trucks.api";

const truckStatusOptions = [
  { value: "", label: "All Status" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "maintenance", label: "Maintenance" }
];

const truckFormSchema = z.object({
  plateNumber: z.string().trim().min(1, "Plate number is required").max(50, "Plate number is too long"),
  model: z.string().trim().max(100, "Model is too long").optional(),
  brand: z.string().trim().max(100, "Brand is too long").optional(),
  year: z.union([z.coerce.number().int().min(1900).max(3000), z.literal(""), z.null()]).optional(),
  color: z.string().trim().max(50, "Color is too long").optional(),
  capacityKg: z.union([z.coerce.number().min(0), z.literal(""), z.null()]).optional(),
  status: z.enum(["active", "inactive", "maintenance"]).default("active"),
  notes: z.string().trim().max(5000, "Notes are too long").optional()
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

function formatCapacity(value) {
  if (value == null || value === "") {
    return "N/A";
  }

  return new Intl.NumberFormat("en-PH", {
    maximumFractionDigits: 2
  }).format(Number(value));
}

function TruckCardSkeleton() {
  return (
    <article className="erp-entity-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-5 w-20" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="erp-entity-card-panel">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-2 h-5 w-14" />
        </div>
        <div className="erp-entity-card-panel">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2 h-5 w-10" />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between pt-1">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-20" />
      </div>
    </article>
  );
}

function StatusBadge({ status }) {
  const styles = {
    active: "border-[#c2ddbe] bg-[#f3faf1] text-[#356b37]",
    inactive: "border-[#c8d3db] bg-[#f8fafb] text-[#5f7283]",
    maintenance: "border-[#efd79a] bg-[#fff9ec] text-[#9a6a00]"
  };

  return (
    <span className={`erp-status-badge ${styles[status] ?? styles.inactive}`}>
      <span className="erp-status-badge-dot" />
      {status ? status.charAt(0).toUpperCase() + status.slice(1) : "Unknown"}
    </span>
  );
}

export function TrucksPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingTruck, setEditingTruck] = useState(null);
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
    resolver: zodResolver(truckFormSchema),
    defaultValues: {
      plateNumber: "",
      model: "",
      brand: "",
      year: "",
      color: "",
      capacityKg: "",
      status: "active",
      notes: ""
    }
  });

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["trucks", page, deferredSearch, statusFilter],
    queryFn: () =>
      getTrucks({
        page,
        perPage: 12,
        ...(deferredSearch ? { search: deferredSearch } : {}),
        ...(statusFilter ? { status: statusFilter } : {})
      }),
    placeholderData: keepPreviousData
  });

  const createMutation = useMutation({
    mutationFn: createTruck,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["trucks"] });
      notify.success("Truck created successfully");
      reset();
      setShowForm(false);
      setEditingTruck(null);
      setPage(1);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ truckId, payload }) => updateTruck(truckId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["trucks"] });
      notify.success("Truck updated successfully");
      reset();
      setShowForm(false);
      setEditingTruck(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTruck,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["trucks"] });
      notify.success("Truck deleted successfully");
      setDeleteTarget(null);
    },
    onError: (mutationError) => {
      notify.warning(mutationError?.response?.data?.message ?? "Truck cannot be deleted right now.");
    }
  });

  const trucks = data?.data ?? [];
  const meta = data?.meta;

  function clearFilters() {
    setPage(1);
    setSearchInput("");
    setStatusFilter("");
  }

  function closeForm() {
    reset();
    setShowForm(false);
    setEditingTruck(null);
  }

  function openCreateForm() {
    reset({
      plateNumber: "",
      model: "",
      brand: "",
      year: "",
      color: "",
      capacityKg: "",
      status: "active",
      notes: ""
    });
    setEditingTruck(null);
    setShowForm(true);
  }

  function openEditForm(truck) {
    reset({
      plateNumber: truck.plateNumber ?? "",
      model: truck.model ?? "",
      brand: truck.brand ?? "",
      year: truck.year ?? "",
      color: truck.color ?? "",
      capacityKg: truck.capacityKg ?? "",
      status: truck.status ?? "active",
      notes: truck.notes ?? ""
    });
    setEditingTruck(truck);
    setShowForm(true);
  }

  async function onSubmit(values) {
    const payload = {
      plateNumber: values.plateNumber,
      model: values.model?.trim() || null,
      brand: values.brand?.trim() || null,
      year: values.year === "" || values.year == null ? null : Number(values.year),
      color: values.color?.trim() || null,
      capacityKg: values.capacityKg === "" || values.capacityKg == null ? null : Number(values.capacityKg),
      status: values.status,
      notes: values.notes?.trim() || null
    };

    if (editingTruck) {
      await updateMutation.mutateAsync({
        truckId: editingTruck.id,
        payload
      });
      return;
    }

    await createMutation.mutateAsync(payload);
  }

  async function confirmDeleteTruck() {
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
            <i className="fas fa-truck text-[18px] text-[#90caf9]" />
            <div>
              <div className="erp-page-title">Trucks</div>
              <div className="erp-page-description">Fleet setup, truck status tracking, and assignment-ready records</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openCreateForm}
              className="erp-header-primary-button"
            >
              <i className="fas fa-plus mr-1.5" />
              Add Truck
            </button>
          </div>
        </div>

        <div className="erp-page-filters">
          <div className="erp-filter-label">
            <i className="fas fa-filter mr-1" />
            Filters
          </div>

          <div className="relative min-w-[200px] flex-1 md:max-w-[280px]">
            <i className="fas fa-search pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
            <input
              value={searchInput}
              onChange={(event) => {
                setPage(1);
                setSearchInput(event.target.value);
              }}
              placeholder="Search trucks..."
              className="erp-input pl-7"
            />
          </div>

          <div className="relative min-w-[160px]">
            <i className="fas fa-signal pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
            <select
              value={statusFilter}
              onChange={(event) => {
                setPage(1);
                setStatusFilter(event.target.value);
              }}
              className="erp-select pl-7"
            >
              {truckStatusOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
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

      {isError ? (
        <section className="rounded-sm border border-[#ef9a9a] bg-[#fff5f5] px-4 py-8 text-[11px] text-[#c62828]">
          Failed to load trucks{error?.message ? `: ${error.message}` : "."}
        </section>
      ) : (
        <section className="space-y-4">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <TruckCardSkeleton key={index} />
              ))}
            </div>
          ) : trucks.length === 0 ? (
            <section className="app-shell-card px-4 py-0">
              <div className="flex min-h-[220px] items-center justify-center text-[11px] italic text-[#90a4ae]">
                No trucks found for the current filters.
              </div>
            </section>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                {trucks.map((truck) => (
                  <article
                    key={truck.id}
                    className="erp-entity-card"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate font-mono text-[13px] font-bold text-[#1a3557]">{truck.plateNumber}</h2>
                        <p className="mt-1 text-[10px] text-[#607d8b]">
                          {[truck.brand, truck.model].filter(Boolean).join(" • ") || "No brand/model"}
                        </p>
                      </div>
                      <StatusBadge status={truck.status} />
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="erp-entity-card-panel">
                        <p className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#607d8b]">Capacity</p>
                        <p className="mt-1 text-[18px] font-bold text-[#1a3557]">{formatCapacity(truck.capacityKg)}</p>
                        <p className="text-[10px] text-[#90a4ae]">kg</p>
                      </div>
                      <div className="erp-entity-card-panel">
                        <p className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#607d8b]">Year</p>
                        <p className="mt-1 text-[18px] font-bold text-[#1a3557]">{truck.year ?? "N/A"}</p>
                        <p className="text-[10px] text-[#90a4ae]">{truck.color ?? "No color"}</p>
                      </div>
                    </div>

                    <div className="erp-entity-card-muted-panel mt-4 min-h-[40px]">
                      {truck.notes ? truck.notes : "No notes recorded for this truck."}
                    </div>

                    <div className="mt-4 flex items-center justify-between pt-1">
                      <div className="text-[10px] text-[#90a4ae]">
                        Updated <span className="font-bold text-[#607d8b]">{formatDate(truck.updatedAt)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditForm(truck)}
                          className="erp-icon-button-md"
                          title="Edit truck"
                        >
                          <i className="fas fa-pen text-[11px]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(truck)}
                          className="erp-icon-button-danger-md"
                          title="Delete truck"
                        >
                          <i className="fas fa-trash text-[11px]" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <section className="table-card">
                <Pagination
                  currentPage={meta?.currentPage ?? 1}
                  lastPage={meta?.lastPage ?? 1}
                  perPage={meta?.perPage ?? 12}
                  total={meta?.total ?? 0}
                  itemLabel="trucks"
                  loading={isFetching}
                  onPrevious={() => setPage((current) => Math.max(1, current - 1))}
                  onNext={() => setPage((current) => (meta?.lastPage ? Math.min(meta.lastPage, current + 1) : current + 1))}
                  onGoto={(targetPage) => setPage(targetPage)}
                />
              </section>
            </>
          )}
        </section>
      )}

      <FormModal show={showForm} title={editingTruck ? "Edit Truck" : "Add Truck"} size="xl" onClose={closeForm}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <p className="text-[10px] text-[#546e7a]">
            {editingTruck
              ? "Update the truck details used for delivery planning and fleet management."
              : "Create a truck record for deliveries and fleet assignment."}
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="erp-label">Plate Number</label>
              <input {...register("plateNumber")} className="erp-input" placeholder="e.g. ABC-1234" />
              {errors.plateNumber ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.plateNumber.message}</p> : null}
            </div>
            <div>
              <label className="erp-label">Status</label>
              <select {...register("status")} className="erp-select">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="maintenance">Maintenance</option>
              </select>
              {errors.status ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.status.message}</p> : null}
            </div>
            <div>
              <label className="erp-label">Brand</label>
              <input {...register("brand")} className="erp-input" placeholder="e.g. Isuzu" />
              {errors.brand ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.brand.message}</p> : null}
            </div>
            <div>
              <label className="erp-label">Model</label>
              <input {...register("model")} className="erp-input" placeholder="e.g. ELF" />
              {errors.model ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.model.message}</p> : null}
            </div>
            <div>
              <label className="erp-label">Year</label>
              <input type="number" {...register("year")} className="erp-input" placeholder="e.g. 2024" />
              {errors.year ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.year.message}</p> : null}
            </div>
            <div>
              <label className="erp-label">Color</label>
              <input {...register("color")} className="erp-input" placeholder="e.g. White" />
              {errors.color ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.color.message}</p> : null}
            </div>
            <div className="md:col-span-2">
              <label className="erp-label">Capacity (kg)</label>
              <input type="number" step="0.01" {...register("capacityKg")} className="erp-input" placeholder="e.g. 3500" />
              {errors.capacityKg ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.capacityKg.message}</p> : null}
            </div>
          </div>

          <div>
            <label className="erp-label">Notes</label>
            <textarea
              {...register("notes")}
              rows={4}
              className="erp-input min-h-[96px] resize-none"
              placeholder="Optional notes about maintenance, capacity, or assignment status."
            />
            {errors.notes ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.notes.message}</p> : null}
          </div>

          {createMutation.isError || updateMutation.isError ? (
            <div className="rounded-sm border border-[#ef9a9a] bg-[#fff5f5] px-4 py-3 text-[11px] text-[#c62828]">
              Failed to {editingTruck ? "update" : "create"} truck
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
              {formBusy ? "Saving..." : editingTruck ? "Update Truck" : "Create Truck"}
            </button>
          </div>
        </form>
      </FormModal>

      <ConfirmationModal
        show={Boolean(deleteTarget)}
        title="Delete Truck"
        message={deleteTarget ? `Are you sure you want to delete truck ${deleteTarget.plateNumber}?` : ""}
        type="error"
        showCancel
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => {
          void confirmDeleteTruck();
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
