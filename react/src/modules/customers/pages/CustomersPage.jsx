import { useDeferredValue, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  createCustomer,
  deleteCustomer,
  updateCustomer
} from "@/modules/customers/api/customers.api";
import { useCustomers } from "@/modules/customers/hooks/useCustomers";
import { useEmployees } from "@/modules/employees/hooks/useEmployees";
import { usePaymentTermOptions } from "@/modules/payment-terms/hooks/usePaymentTermOptions";

const customerFormSchema = z.object({
  name: z.string().trim().min(1, "Customer name is required").max(255, "Customer name is too long"),
  company: z.string().trim().max(255, "Company name is too long").optional(),
  email: z.union([z.string().trim().email("Invalid email format").max(255), z.literal("")]).optional(),
  phone: z.string().trim().max(50, "Phone number is too long").optional(),
  address: z.string().trim().max(2000, "Address is too long").optional(),
  paymentTermId: z.union([z.coerce.number().int().positive(), z.literal(""), z.null()]).optional(),
  status: z.boolean().default(true),
  hasOpeningBalance: z.boolean().default(false),
  openingBalance: z.coerce.number().min(0, "Balance must be non-negative").optional(),
  agentId: z.union([z.coerce.number().int().positive(), z.literal(""), z.null()]).optional()
}).refine(data => {
  if (data.hasOpeningBalance && (!data.agentId || data.agentId === "")) {
    return false;
  }
  return true;
}, {
  message: "Assigned Agent is required when creating an opening balance",
  path: ["agentId"]
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

const defaultFormValues = {
  name: "",
  company: "",
  email: "",
  phone: "",
  address: "",
  paymentTermId: "",
  status: true,
  hasOpeningBalance: false,
  openingBalance: 0,
  agentId: ""
};

export function CustomersPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
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
    resolver: zodResolver(customerFormSchema),
    defaultValues: defaultFormValues
  });

  const { data, isLoading, isError, error, isFetching } = useCustomers({
    page,
    perPage: 10,
    ...(deferredSearch ? { search: deferredSearch } : {}),
    ...(statusFilter !== "" ? { status: statusFilter === "1" } : {})
  });

  const { data: paymentTermsResponse } = usePaymentTermOptions();
  const { data: employeesResponse } = useEmployees({ status: "active", position: "agent" });
  const agents = employeesResponse?.data ?? [];

  const createMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      notify.success("Customer created successfully");
      reset(defaultFormValues);
      setShowForm(false);
      setEditingCustomer(null);
      setPage(1);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ customerId, payload }) => updateCustomer(customerId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      notify.success("Customer updated successfully");
      reset(defaultFormValues);
      setShowForm(false);
      setEditingCustomer(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCustomer,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      notify.success("Customer deleted successfully");
      setDeleteTarget(null);
    }
  });

  const customers = data?.data ?? [];
  const meta = data?.meta;
  const paymentTerms = paymentTermsResponse?.data ?? [];
  const customerStatus = watch("status");
  const hasOpeningBalance = watch("hasOpeningBalance");

  function clearFilters() {
    setPage(1);
    setSearchInput("");
    setStatusFilter("");
  }

  function closeForm() {
    reset(defaultFormValues);
    setEditingCustomer(null);
    setShowForm(false);
  }

  function openCreateForm() {
    reset(defaultFormValues);
    setEditingCustomer(null);
    setShowForm(true);
  }

  function openEditForm(customer) {
    reset({
      name: customer.name ?? "",
      company: customer.company ?? "",
      email: customer.email ?? "",
      phone: customer.phone ?? "",
      address: customer.address ?? "",
      paymentTermId: customer.paymentTermId ?? "",
      status: customer.status ?? true,
      hasOpeningBalance: false,
      openingBalance: 0,
      agentId: ""
    });
    setEditingCustomer(customer);
    setShowForm(true);
  }

  async function onSubmit(values) {
    const payload = {
      name: values.name,
      company: values.company?.trim() || null,
      email: values.email?.trim() || null,
      phone: values.phone?.trim() || null,
      address: values.address?.trim() || null,
      paymentTermId:
        values.paymentTermId === "" || values.paymentTermId === null || values.paymentTermId === undefined
          ? null
          : Number(values.paymentTermId),
      status: values.status,
      ...(editingCustomer || !values.hasOpeningBalance ? {} : {
        openingBalance: Number(values.openingBalance || 0),
        agentId: values.agentId === "" || values.agentId === null || values.agentId === undefined ? null : Number(values.agentId)
      })
    };

    if (editingCustomer) {
      await updateMutation.mutateAsync({
        customerId: editingCustomer.id,
        payload
      });
      return;
    }

    await createMutation.mutateAsync(payload);
  }

  async function confirmDeleteCustomer() {
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
            <i className="fas fa-users text-[18px] text-[#90caf9]" />
            <div>
              <div className="erp-page-title">Customers</div>
              <div className="erp-page-description">Customer master records and payment-term defaults</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openCreateForm}
              className="erp-header-primary-button"
            >
              <i className="fas fa-plus mr-1.5" />
              Add Customer
            </button>
          </div>
        </div>

        <div className="erp-page-filters">
          <div className="erp-filter-label">
            <i className="fas fa-filter mr-1" />
            Filters
          </div>

          <div className="relative min-w-[220px] flex-1 md:max-w-[320px]">
            <i className="fas fa-search pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
            <input
              value={searchInput}
              onChange={(event) => {
                setPage(1);
                setSearchInput(event.target.value);
              }}
              placeholder="Search customers..."
              className="erp-input pl-7"
            />
          </div>

          <div className="relative min-w-[140px]">
            <i className="fas fa-signal pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
            <select
              value={statusFilter}
              onChange={(event) => {
                setPage(1);
                setStatusFilter(event.target.value);
              }}
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

      <section className="table-card">
        {isError ? (
          <div className="px-4 py-10 text-[11px] text-[#c62828]">
            Failed to load customers{error?.message ? `: ${error.message}` : "."}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className={`erp-table w-full min-w-[980px] ${isLoading ? "opacity-70" : ""}`}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Customer</th>
                    <th>Company</th>
                    <th>Contact</th>
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
                        <tr key={`customer-sk-${index}`}>
                          <td><Skeleton className="mx-auto h-3 w-8" /></td>
                          <td>
                            <div className="space-y-1.5">
                              <Skeleton className="h-3 w-28" />
                              <Skeleton className="h-2.5 w-40 bg-[#e3ebf1]" />
                            </div>
                          </td>
                          <td><Skeleton className="h-3 w-24" /></td>
                          <td><Skeleton className="h-3 w-28" /></td>
                          <td><Skeleton className="h-3 w-20" /></td>
                          <td><Skeleton className="mx-auto h-4 w-14" /></td>
                          <td><Skeleton className="h-3 w-20" /></td>
                          <td>
                            <div className="flex items-center justify-center gap-2">
                              <Skeleton className="h-8 w-8" />
                              <Skeleton className="h-8 w-8" />
                            </div>
                          </td>
                        </tr>
                      )}
                    </TableSkeleton>
                  ) : customers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-0 text-center text-[11px] italic text-[#90a4ae]">
                        <div className="flex min-h-[220px] items-center justify-center">
                          No customers found for the current filters.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    customers.map((customer) => (
                      <tr key={customer.id}>
                        <td className="font-mono text-muted">{customer.id}</td>
                        <td>
                          <div>
                            <p className="font-bold text-ink">{customer.name}</p>
                            <p className="mt-0.5 text-[10px] text-[#90a4ae]">{customer.address || "No address set"}</p>
                          </div>
                        </td>
                        <td>{customer.company || "N/A"}</td>
                        <td>
                          <div>
                            <p>{customer.email || "No email"}</p>
                            <p className="mt-0.5 text-[10px] text-[#90a4ae]">{customer.phone || "No phone"}</p>
                          </div>
                        </td>
                        <td>{customer.paymentTerm?.name || "Cash / None"}</td>
                        <td className="text-center">
                          <span
                            className={`rounded-sm border px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                              customer.status
                                ? "border-[#a5d6a7] bg-[#e8f5e9] text-[#2e7d32]"
                                : "border-[#b0bec5] bg-[#f3f6f9] text-muted"
                            }`}
                          >
                            {customer.status ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="text-muted">{formatDate(customer.updatedAt)}</td>
                        <td>
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => navigate(`/customers/${customer.id}`)}
                              className="erp-icon-button-md"
                              title="View customer details"
                            >
                              <i className="fas fa-eye text-[11px]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditForm(customer)}
                              className="erp-icon-button-md"
                              title="Edit customer"
                            >
                              <i className="fas fa-pen text-[11px]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(customer)}
                              className="erp-icon-button-danger-md"
                              title="Delete customer"
                            >
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

            {!isLoading ? (
              <Pagination
                currentPage={meta?.currentPage ?? 1}
                lastPage={meta?.lastPage ?? 1}
                perPage={meta?.perPage ?? 10}
                total={meta?.total ?? 0}
                itemLabel="customers"
                loading={isFetching}
                onPrevious={() => setPage((current) => Math.max(1, current - 1))}
                onNext={() =>
                  setPage((current) => (meta?.lastPage ? Math.min(meta.lastPage, current + 1) : current + 1))
                }
                onGoto={(targetPage) => setPage(targetPage)}
              />
            ) : null}
          </>
        )}
      </section>

      <FormModal
        show={showForm}
        title={editingCustomer ? "Edit Customer" : "Add Customer"}
        size="2xl"
        onClose={closeForm}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <p className="text-[10px] text-[#546e7a]">
            {editingCustomer
              ? "Update the customer master record used for future sales orders, invoices, and AR."
              : "Create a customer record for future sales orders, invoices, and AR."}
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="erp-label">Customer Name</label>
              <input {...register("name")} className="erp-input" placeholder="e.g. Juan Dela Cruz" />
              {errors.name ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.name.message}</p> : null}
            </div>

            <div>
              <label className="erp-label">Company</label>
              <input {...register("company")} className="erp-input" placeholder="e.g. ABC Builders" />
              {errors.company ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.company.message}</p> : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="erp-label">Email</label>
              <input {...register("email")} className="erp-input" placeholder="customer@example.com" />
              {errors.email ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.email.message}</p> : null}
            </div>

            <div>
              <label className="erp-label">Phone</label>
              <input {...register("phone")} className="erp-input" placeholder="0917xxxxxxx" />
              {errors.phone ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.phone.message}</p> : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="erp-label">Payment Term</label>
              <select {...register("paymentTermId")} className="erp-select">
                <option value="">Cash / None</option>
                {paymentTerms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name} ({term.days} days)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="erp-label">Customer Status</label>
              <label className="inline-flex items-center gap-2 text-[11px] font-bold text-[#607d8b]">
                <input type="checkbox" {...register("status")} className="sr-only" />
                <button
                  type="button"
                  onClick={() =>
                    setValue("status", !customerStatus, {
                      shouldDirty: true,
                      shouldValidate: false
                    })
                  }
                  className={`relative inline-flex h-4 w-8 items-center rounded-full transition ${
                    customerStatus ? "bg-[#2e7d32]" : "bg-[#b0bec5]"
                  }`}
                  aria-pressed={customerStatus}
                  aria-label={`Set customer as ${customerStatus ? "inactive" : "active"}`}
                >
                  <span
                    className={`h-3 w-3 rounded-full bg-white shadow-sm transition ${
                      customerStatus ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
                <span>{customerStatus ? "Active" : "Inactive"}</span>
              </label>
            </div>
          </div>

          {!editingCustomer ? (
            <div className="rounded-sm border border-[#e3ebf1] p-4 bg-[#f8fafc]">
              <div className="mb-4">
                <label className="inline-flex items-center gap-2 text-[11px] font-bold text-ink cursor-pointer select-none">
                  <input type="checkbox" {...register("hasOpeningBalance")} className="h-4 w-4 rounded border-[#b0bec5] text-[#1a3557] focus:ring-[#1a3557]" />
                  Add an Opening Balance for this Customer
                </label>
              </div>

              {hasOpeningBalance && (
                <div className="grid gap-4 md:grid-cols-2 pt-2 border-t border-[#e3ebf1]">
                  <div>
                    <label className="erp-label">Opening Balance Amount</label>
                    <input type="number" min="0" step="0.01" {...register("openingBalance")} className="erp-input" />
                    {errors.openingBalance ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.openingBalance.message}</p> : null}
                  </div>
                  <div>
                    <label className="erp-label">Assigned Agent</label>
                    <select {...register("agentId")} className="erp-select">
                      <option value="">Select an Agent</option>
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.firstName} {agent.lastName}
                        </option>
                      ))}
                    </select>
                    {errors.agentId ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.agentId.message}</p> : null}
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <div>
            <label className="erp-label">Address</label>
            <textarea
              {...register("address")}
              rows={4}
              className="erp-input min-h-[96px] resize-none"
              placeholder="Customer address"
            />
            {errors.address ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.address.message}</p> : null}
          </div>

          {createMutation.isError || updateMutation.isError ? (
            <div className="rounded-sm border border-[#ef9a9a] bg-[#fff5f5] px-4 py-3 text-[11px] text-[#c62828]">
              {updateMutation.error?.response?.data?.message || createMutation.error?.response?.data?.message || "An unexpected error occurred."}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={closeForm} className="erp-button-secondary">
              Cancel
            </button>
            <button type="submit" disabled={formBusy} className="erp-button-primary">
              {formBusy ? "Saving..." : editingCustomer ? "Update Customer" : "Create Customer"}
            </button>
          </div>
        </form>
      </FormModal>

      <ConfirmationModal
        show={Boolean(deleteTarget)}
        title="Delete Customer"
        message={deleteTarget ? `Are you sure you want to delete ${deleteTarget.name}?` : ""}
        type="error"
        showCancel
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={() => void confirmDeleteCustomer()}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
