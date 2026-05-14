import { useDeferredValue, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ConfirmationModal } from "@/shared/components/common/ConfirmationModal";
import { FormModal } from "@/shared/components/common/FormModal";
import { Pagination } from "@/shared/components/common/Pagination";
import { Skeleton, TableSkeleton } from "@/shared/components/common/Skeleton";
import { useNotification } from "@/shared/hooks/useNotification";
import {
  createSupplier,
  deleteSupplier,
  updateSupplier
} from "@/modules/suppliers/api/suppliers.api";
import { useSuppliers } from "@/modules/suppliers/hooks/useSuppliers";
import { usePaymentTermOptions } from "@/modules/payment-terms/hooks/usePaymentTermOptions";

const supplierFormSchema = z.object({
  name: z.string().trim().min(1, "Supplier name is required").max(255, "Supplier name is too long"),
  companyName: z.string().trim().max(255, "Company name is too long").optional(),
  contactPerson: z.string().trim().max(255, "Contact person is too long").optional(),
  email: z.union([z.string().trim().email("Invalid email format").max(255), z.literal("")]).optional(),
  phone: z.string().trim().max(50, "Phone number is too long").optional(),
  address: z.string().trim().max(2000, "Address is too long").optional(),
  paymentTermId: z.union([z.coerce.number().int().positive(), z.literal(""), z.null()]).optional(),
  status: z.boolean().default(true)
});

function formatDate(value) {
  if (!value) return "N/A";
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

const defaultFormValues = {
  name: "",
  companyName: "",
  contactPerson: "",
  email: "",
  phone: "",
  address: "",
  paymentTermId: "",
  status: true
};

function isSupplierActive(supplier) {
  return supplier?.status === true || Number(supplier?.status) === 1;
}

export function SuppliersPage() {
  const [searchParams] = useSearchParams();
  const externalSearch = (searchParams.get("search") ?? "").trim();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState(externalSearch);
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const deferredSearch = useDeferredValue(searchInput.trim());
  const queryClient = useQueryClient();
  const notify = useNotification();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: defaultFormValues
  });

  const { data, isLoading, isError, error, isFetching } = useSuppliers({
    page,
    limit: 10,
    ...(deferredSearch ? { search: deferredSearch } : {}),
    ...(statusFilter !== "" ? { status: statusFilter === "1" ? 1 : 0 } : {})
  });

  const { data: paymentTermsResponse } = usePaymentTermOptions();

  const createMutation = useMutation({
    mutationFn: createSupplier,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      notify.success("Supplier created successfully");
      reset(defaultFormValues);
      setShowForm(false);
      setEditingSupplier(null);
      setPage(1);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateSupplier(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      notify.success("Supplier updated successfully");
      reset(defaultFormValues);
      setShowForm(false);
      setEditingSupplier(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSupplier,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      notify.success("Supplier deleted successfully");
      setDeleteTarget(null);
    }
  });

  const suppliers = data?.data ?? [];
  const meta = data?.meta;
  const paymentTerms = paymentTermsResponse?.data ?? [];
  const supplierStatus = watch("status");

  useEffect(() => {
    setPage(1);
    setSearchInput(externalSearch);
  }, [externalSearch]);

  function clearFilters() {
    setPage(1);
    setSearchInput("");
    setStatusFilter("");
  }

  function closeForm() {
    reset(defaultFormValues);
    setEditingSupplier(null);
    setShowForm(false);
  }

  function openCreateForm() {
    reset(defaultFormValues);
    setEditingSupplier(null);
    setShowForm(true);
  }

  function openEditForm(supplier) {
    reset({
      name: supplier.name ?? "",
      companyName: supplier.companyName ?? "",
      contactPerson: supplier.contactPerson ?? "",
      email: supplier.email ?? "",
      phone: supplier.phone ?? "",
      address: supplier.address ?? "",
      paymentTermId: supplier.paymentTermId ?? "",
      status: isSupplierActive(supplier)
    });
    setEditingSupplier(supplier);
    setShowForm(true);
  }

  async function onSubmit(values) {
    const payload = {
      name: values.name,
      companyName: values.companyName?.trim() || null,
      contactPerson: values.contactPerson?.trim() || null,
      email: values.email?.trim() || null,
      phone: values.phone?.trim() || null,
      address: values.address?.trim() || null,
      paymentTermId: !values.paymentTermId ? null : Number(values.paymentTermId),
      status: values.status ? 1 : 0
    };

    if (editingSupplier) {
      await updateMutation.mutateAsync({
        id: editingSupplier.id,
        payload
      });
      return;
    }

    await createMutation.mutateAsync(payload);
  }

  async function confirmDeleteSupplier() {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync(deleteTarget.id);
  }

  const formBusy = isSubmitting || createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <section className="erp-page-section">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <i className="fas fa-truck-loading text-[18px] text-[#ffb74d]" />
            <div>
              <div className="erp-page-title">Suppliers</div>
              <div className="erp-page-description">Supplier master records for purchasing and accounts payable.</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={openCreateForm} className="erp-header-primary-button">
              <i className="fas fa-plus mr-1.5" /> Add Supplier
            </button>
          </div>
        </div>

        <div className="erp-page-filters">
          <div className="erp-filter-label"><i className="fas fa-filter mr-1" /> Filters</div>
          <div className="relative min-w-[220px] flex-1 md:max-w-[320px]">
            <i className="fas fa-search pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
            <input
              value={searchInput}
              onChange={(e) => { setPage(1); setSearchInput(e.target.value); }}
              placeholder="Search suppliers..."
              className="erp-input pl-7"
            />
          </div>
          <div className="relative min-w-[140px]">
            <i className="fas fa-signal pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
            <select
              value={statusFilter}
              onChange={(e) => { setPage(1); setStatusFilter(e.target.value); }}
              className="erp-select pl-7"
            >
              <option value="">All Status</option>
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </select>
          </div>
          <button type="button" onClick={clearFilters} className="erp-filter-clear-button">
            <i className="fas fa-times mr-1" /> Clear
          </button>
        </div>
      </section>

      <section className="table-card">
        {isError ? (
          <div className="px-4 py-10 text-[11px] text-[#c62828]">Failed to load suppliers{error?.message ? `: ${error.message}` : "."}</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className={`erp-table w-full min-w-[980px] ${isLoading ? "opacity-70" : ""}`}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Supplier</th>
                    <th>Company</th>
                    <th>Contact Info</th>
                    <th>Payment Term</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <TableSkeleton rows={8}>
                      {(index) => (
                        <tr key={`supp-sk-${index}`}>
                          <td><Skeleton className="mx-auto h-3 w-8" /></td>
                          <td><Skeleton className="h-3 w-28" /></td>
                          <td><Skeleton className="h-3 w-24" /></td>
                          <td><Skeleton className="h-3 w-28" /></td>
                          <td><Skeleton className="h-3 w-20" /></td>
                          <td><Skeleton className="mx-auto h-4 w-14" /></td>
                          <td><Skeleton className="h-3 w-20" /></td>
                          <td><Skeleton className="mx-auto h-8 w-16" /></td>
                        </tr>
                      )}
                    </TableSkeleton>
                  ) : suppliers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-0 text-center text-[11px] italic text-[#90a4ae]">
                        <div className="flex min-h-[220px] items-center justify-center">No suppliers found.</div>
                      </td>
                    </tr>
                  ) : (
                    suppliers.map((supplier) => (
                      <tr key={supplier.id}>
                        <td className="font-mono text-muted">{supplier.id}</td>
                        <td>
                          <p className="font-bold text-ink">{supplier.name}</p>
                          <p className="mt-0.5 text-[10px] text-[#90a4ae]">{supplier.address || "No address"}</p>
                        </td>
                        <td>{supplier.companyName || "N/A"}</td>
                        <td>
                          <p>{supplier.email || "No email"}</p>
                          <p className="mt-0.5 text-[10px] text-[#90a4ae]">{supplier.phone || "No phone"}</p>
                        </td>
                        <td>{supplier.paymentTerm?.name || "Cash / None"}</td>
                        <td className="text-center">
                          <span className={`rounded-sm border px-1.5 py-0.5 text-[9px] font-bold uppercase ${isSupplierActive(supplier) ? "border-[#a5d6a7] bg-[#e8f5e9] text-[#2e7d32]" : "border-[#b0bec5] bg-[#f3f6f9] text-muted"}`}>
                            {isSupplierActive(supplier) ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="text-muted">{formatDate(supplier.updatedAt)}</td>
                        <td>
                          <div className="flex items-center justify-center gap-2">
                            <button type="button" onClick={() => navigate(`/suppliers/${supplier.id}`)} className="erp-icon-button-md" title="View supplier details">
                              <i className="fas fa-eye text-[11px]" />
                            </button>
                            <button type="button" onClick={() => openEditForm(supplier)} className="erp-icon-button-md" title="Edit supplier">
                              <i className="fas fa-pen text-[11px]" />
                            </button>
                            <button type="button" onClick={() => setDeleteTarget(supplier)} className="erp-icon-button-danger-md" title="Delete supplier">
                              <i className="fas fa-trash text-[11px]" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {!isLoading && (
              <Pagination
                currentPage={meta?.page ?? 1}
                lastPage={meta?.totalPages ?? 1}
                perPage={meta?.limit ?? 10}
                total={meta?.total ?? 0}
                itemLabel="suppliers"
                loading={isFetching}
                onPrevious={() => setPage(p => Math.max(1, p - 1))}
                onNext={() => setPage(p => meta?.totalPages ? Math.min(meta.totalPages, p + 1) : p + 1)}
                onGoto={(t) => setPage(t)}
              />
            )}
          </>
        )}
      </section>

      <FormModal show={showForm} title={editingSupplier ? "Edit Supplier" : "Add Supplier"} size="2xl" onClose={closeForm}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="erp-label">Supplier Name</label>
              <input {...register("name")} className="erp-input" placeholder="e.g. Acme Corp" />
              {errors.name && <p className="mt-1 text-[10px] text-[#c62828]">{errors.name.message}</p>}
            </div>
            <div>
              <label className="erp-label">Company Name</label>
              <input {...register("companyName")} className="erp-input" placeholder="e.g. Acme Building Materials" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="erp-label">Email</label>
              <input {...register("email")} className="erp-input" placeholder="vendor@example.com" />
            </div>
            <div>
              <label className="erp-label">Phone</label>
              <input {...register("phone")} className="erp-input" placeholder="0917xxxxxxx" />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
             <div>
              <label className="erp-label">Contact Person</label>
              <input {...register("contactPerson")} className="erp-input" placeholder="e.g. John Smith" />
            </div>
            <div>
              <label className="erp-label">Payment Term</label>
              <select {...register("paymentTermId")} className="erp-select">
                <option value="">Cash / None</option>
                {paymentTerms.map((term) => (
                  <option key={term.id} value={term.id}>{term.name} ({term.days} days)</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="erp-label">Status</label>
            <label className="inline-flex items-center gap-2 text-[11px] font-bold text-[#607d8b]">
              <input type="checkbox" {...register("status")} className="sr-only" />
              <button
                type="button"
                onClick={() => setValue("status", !supplierStatus, { shouldDirty: true })}
                className={`relative inline-flex h-4 w-8 items-center rounded-full transition ${supplierStatus ? "bg-[#2e7d32]" : "bg-[#b0bec5]"}`}
              >
                <span className={`h-3 w-3 rounded-full bg-white shadow-sm transition ${supplierStatus ? "translate-x-4" : "translate-x-0.5"}`} />
              </button>
              <span>{supplierStatus ? "Active" : "Inactive"}</span>
            </label>
          </div>
          <div>
            <label className="erp-label">Address</label>
            <textarea {...register("address")} rows={3} className="erp-input resize-none" placeholder="Supplier address" />
          </div>
          {(createMutation.isError || updateMutation.isError) && (
            <div className="rounded-sm border border-[#ef9a9a] bg-[#fff5f5] px-4 py-3 text-[11px] text-[#c62828]">
              {updateMutation.error?.response?.data?.message || createMutation.error?.response?.data?.message || "An unexpected error occurred."}
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={closeForm} className="erp-button-secondary">Cancel</button>
            <button type="submit" disabled={formBusy} className="erp-button-primary">{formBusy ? "Saving..." : editingSupplier ? "Update" : "Create"}</button>
          </div>
        </form>
      </FormModal>

      <ConfirmationModal
        show={Boolean(deleteTarget)}
        title="Delete Supplier"
        message={deleteTarget ? `Are you sure you want to delete ${deleteTarget.name}?` : ""}
        type="error"
        showCancel
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDeleteSupplier}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
