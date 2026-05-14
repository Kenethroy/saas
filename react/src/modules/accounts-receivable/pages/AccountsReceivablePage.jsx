import { useDeferredValue, useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FormModal } from "@/shared/components/common/FormModal";
import { Pagination } from "@/shared/components/common/Pagination";
import { Skeleton, TableSkeleton } from "@/shared/components/common/Skeleton";
import { useNotification } from "@/shared/hooks/useNotification";
import { useAccountsReceivables } from "../hooks/useAccountsReceivables";
import { updateAccountsReceivable } from "../api/accounts-receivable.api";
import { useEmployees } from "@/modules/employees/hooks/useEmployees";
import { DateField } from "@/shared/components/common/DateField";

const arFormSchema = z.object({
  amount: z.coerce.number().min(0, "Amount must be non-negative").optional(),
  dueDate: z.union([z.string(), z.null()]).optional(),
  agentId: z.union([z.coerce.number().int().positive(), z.literal(""), z.null()]).optional()
});

function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP"
  }).format(value);
}

function formatDate(value) {
  if (!value) return "N/A";
  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

export function AccountsReceivablePage() {
  const [searchParams] = useSearchParams();
  const externalSearch = (searchParams.get("search") ?? "").trim();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState(externalSearch);
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingAR, setEditingAR] = useState(null);
  const deferredSearch = useDeferredValue(searchInput.trim());
  const queryClient = useQueryClient();
  const notify = useNotification();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(arFormSchema)
  });

  const { data, isLoading, isError, error, isFetching } = useAccountsReceivables({
    page,
    perPage: 10,
    ...(deferredSearch ? { search: deferredSearch } : {}),
    ...(statusFilter ? { status: statusFilter } : {})
  });

  const { data: employeesResponse } = useEmployees({ status: "active", position: "agent" });
  const agents = employeesResponse?.data ?? [];

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateAccountsReceivable(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["accounts-receivables"] });
      notify.success("Accounts Receivable updated successfully");
      setShowForm(false);
      setEditingAR(null);
    }
  });

  const arRecords = data?.data ?? [];
  const meta = data?.meta;

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
    setEditingAR(null);
    setShowForm(false);
  }

  function openEditForm(ar) {
    reset({
      amount: ar.amount ?? 0,
      dueDate: ar.dueDate ?? null,
      agentId: ar.agentId ?? ""
    });
    setEditingAR(ar);
    setShowForm(true);
  }

  function recordPayment(ar) {
    const customerId = ar.customerId;
    if (customerId) {
      navigate(`/customer-collections?customerId=${customerId}&openModal=true`);
    } else {
      navigate("/customer-collections?openModal=true");
    }
  }

  async function onSubmit(values) {
    if (!editingAR) return;

    const payload = {
      dueDate: values.dueDate || null,
      agentId: values.agentId === "" || values.agentId === null ? null : Number(values.agentId)
    };

    // Only allow editing amount if it's an opening balance and no payments made
    if (editingAR.isOpeningBalance && editingAR.paidAmount === 0) {
      payload.amount = Number(values.amount || 0);
    }

    await updateMutation.mutateAsync({
      id: editingAR.id,
      payload
    });
  }

  const formBusy = isSubmitting || updateMutation.isPending;

  return (
    <div className="space-y-4">
      <section className="erp-page-section erp-page-section-joined">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <i className="fas fa-file-invoice-dollar text-[18px] text-[#90caf9]" />
            <div>
              <div className="erp-page-title">Accounts Receivable</div>
              <div className="erp-page-description">Receivable listing, customer balances, and collections tracking.</div>
            </div>
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
              placeholder="Search reference # or customer..."
              className="erp-input pl-7 text-[11px]"
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
              <option value="unpaid">Unpaid</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
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

      <section className="table-card erp-page-main-card-joined">
        {isError ? (
          <div className="px-4 py-10 text-[11px] text-[#c62828]">
            Failed to load records{error?.message ? `: ${error.message}` : "."}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className={`erp-table w-full ${isLoading ? "opacity-70" : ""}`}>
                <thead>
                  <tr>
                    <th className="w-[60px] text-center">Ref ID</th>
                    <th className="min-w-[180px]">Type / Invoice</th>
                    <th className="min-w-[200px]">Customer</th>
                    <th className="w-[150px]">Agent</th>
                    <th className="w-[120px] text-right">Total Amount</th>
                    <th className="w-[120px] text-right">Outstanding</th>
                    <th className="w-[100px] text-center">Status</th>
                    <th className="w-[80px] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <TableSkeleton rows={8}>
                      {(index) => (
                        <tr key={`ar-sk-${index}`}>
                          <td><Skeleton className="mx-auto h-3 w-8" /></td>
                          <td>
                            <div className="space-y-1.5">
                              <Skeleton className="h-3 w-28" />
                              <Skeleton className="h-2.5 w-20" />
                            </div>
                          </td>
                          <td>
                            <div className="space-y-1.5">
                              <Skeleton className="h-3 w-32" />
                              <Skeleton className="h-2.5 w-24" />
                            </div>
                          </td>
                          <td><Skeleton className="h-3 w-24" /></td>
                          <td><Skeleton className="ml-auto h-3 w-20" /></td>
                          <td><Skeleton className="ml-auto h-3 w-20" /></td>
                          <td><Skeleton className="mx-auto h-4 w-14" /></td>
                          <td><Skeleton className="ml-auto h-8 w-8" /></td>
                        </tr>
                      )}
                    </TableSkeleton>
                  ) : arRecords.length === 0 ? (
                    <tr>
                      <td colSpan={8}>
                        <div className="erp-empty-state">
                          No receivables found for the current filters.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    arRecords.map((ar) => (
                      <tr key={ar.id}>
                        <td className="text-center font-mono text-[11px] text-muted">{ar.id}</td>
                        <td className="min-w-[180px]">
                          {ar.isOpeningBalance ? (
                            <span className="font-bold text-[#f57c00]">Opening Balance</span>
                          ) : (
                            <span className="font-mono font-bold text-ink">{ar.invoiceNumber}</span>
                          )}
                          <p className="mt-0.5 text-[11px] text-muted">Due: {formatDate(ar.dueDate)}</p>
                        </td>
                        <td className="min-w-[200px]">
                          <div>
                            <p className="font-bold text-ink">{ar.customerName}</p>
                            {ar.customerCompany && (
                              <p className="mt-0.5 text-[11px] italic text-muted truncate" title={ar.customerCompany}>
                                {ar.customerCompany}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="w-[150px] truncate text-ink">{ar.agentName || "No Agent"}</td>
                        <td className="w-[120px] whitespace-nowrap text-right font-mono font-bold text-ink">
                          {formatCurrency(ar.amount)}
                        </td>
                        <td className="w-[120px] whitespace-nowrap text-right font-mono font-bold text-[#c62828]">
                          {formatCurrency(ar.outstandingAmount)}
                        </td>
                        <td className="w-[100px] text-center">
                          <span
                            className={`erp-chip ${
                              ar.status === "paid"
                                ? "border-[#a5d6a7] bg-[#e8f5e9] text-[#2e7d32]"
                                : ar.status === "partial"
                                ? "border-[#fff59d] bg-[#fffde7] text-[#f57f17]"
                                : "border-[#ef9a9a] bg-[#ffebee] text-[#c62828]"
                            }`}
                          >
                            {ar.status}
                          </span>
                        </td>
                        <td className="w-[80px]">
                          <div className="erp-row-actions">
                            {ar.status !== "paid" && (
                              <button
                                type="button"
                                onClick={() => recordPayment(ar)}
                                className="erp-icon-button-md text-[#2e7d32] hover:bg-[#e8f5e9]"
                                title="Record Payment"
                              >
                                <i className="fas fa-money-bill-wave text-[11px]" />
                              </button>
                            )}
                            {ar.isOpeningBalance && (
                              <button
                                type="button"
                                onClick={() => openEditForm(ar)}
                                className="erp-icon-button-md"
                                title="Manage Opening Balance"
                              >
                                <i className="fas fa-pen text-[11px]" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {!isLoading && meta?.total > 0 && (
              <Pagination
                currentPage={meta.currentPage}
                lastPage={meta.lastPage}
                perPage={meta.perPage}
                total={meta.total}
                itemLabel="receivables"
                loading={isFetching}
                onPrevious={() => setPage((current) => Math.max(1, current - 1))}
                onNext={() =>
                  setPage((current) => (meta.lastPage ? Math.min(meta.lastPage, current + 1) : current + 1))
                }
                onGoto={(targetPage) => setPage(targetPage)}
              />
            )}
          </>
        )}
      </section>

      <FormModal
        show={showForm}
        title="Manage Accounts Receivable"
        size="2xl"
        onClose={closeForm}
      >
        {editingAR && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="mb-4 rounded-sm bg-[#f8fafc] p-3 shadow-inner">
              <div className="grid grid-cols-2 gap-4 text-[11px]">
                <div>
                  <span className="font-bold text-muted">Customer:</span>{" "}
                  <span className="font-bold text-ink">{editingAR.customerName}</span>
                </div>
                <div>
                  <span className="font-bold text-muted">Type:</span>{" "}
                  <span className="font-bold text-ink">
                    {editingAR.isOpeningBalance ? "Opening Balance" : `Invoice ${editingAR.invoiceNumber}`}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-muted">Paid Amount:</span>{" "}
                  <span className="font-mono text-[#2e7d32]">{formatCurrency(editingAR.paidAmount)}</span>
                </div>
                <div>
                  <span className="font-bold text-muted">Outstanding:</span>{" "}
                  <span className="font-mono font-bold text-[#c62828]">{formatCurrency(editingAR.outstandingAmount)}</span>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="erp-label">Total Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  {...register("amount")}
                  disabled={!editingAR.isOpeningBalance || editingAR.paidAmount > 0}
                  className="erp-input disabled:bg-[#f3f6f9] disabled:text-[#90a4ae]"
                />
                {!editingAR.isOpeningBalance && (
                  <p className="mt-1 text-[10px] text-[#90a4ae]">Invoice amounts cannot be edited here.</p>
                )}
                {editingAR.isOpeningBalance && editingAR.paidAmount > 0 && (
                  <p className="mt-1 text-[10px] text-[#c62828]">Cannot edit opening balance after payment.</p>
                )}
                {errors.amount ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.amount.message}</p> : null}
              </div>

              <div>
                <label className="erp-label">Assigned Agent</label>
                <select {...register("agentId")} className="erp-select">
                  <option value="">No Agent</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.firstName} {agent.lastName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="erp-label">Due Date</label>
                <DateField
                  control={control}
                  name="dueDate"
                  placeholderText="Select due date"
                />
              </div>
            </div>

            {updateMutation.isError ? (
              <div className="rounded-sm border border-[#ef9a9a] bg-[#fff5f5] px-4 py-3 text-[11px] text-[#c62828]">
                Failed to update accounts receivable
                {updateMutation.error?.response?.data?.message
                  ? `: ${updateMutation.error.response.data.message}`
                  : "."}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeForm} className="erp-button-secondary">
                Cancel
              </button>
              <button type="submit" disabled={formBusy} className="erp-button-primary">
                {formBusy ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        )}
      </FormModal>
    </div>
  );
}
