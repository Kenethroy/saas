import { useDeferredValue, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ConfirmationModal } from "@/shared/components/common/ConfirmationModal";
import { FormModal } from "@/shared/components/common/FormModal";
import { Pagination } from "@/shared/components/common/Pagination";
import { Skeleton, TableSkeleton } from "@/shared/components/common/Skeleton";
import { DateField } from "@/shared/components/common/DateField";
import { useNotification } from "@/shared/hooks/useNotification";
import {
  createEmployee,
  deleteEmployee,
  updateEmployee
} from "@/modules/employees/api/employees.api";
import { useEmployees } from "@/modules/employees/hooks/useEmployees";

const employeeStatusOptions = ["active", "inactive", "on_leave"];
const employeePositionOptions = ["agent", "staff", "driver", "pahenante"];
const rateTypeOptions = ["Monthly", "Daily", "Per Trip"];

const employeeFormSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  position: z.enum(["agent", "staff", "driver", "pahenante"], {
    required_error: "Position is required"
  }),
  phone: z.string().trim().max(20).optional(),
  email: z.union([z.string().trim().email("Invalid email format").max(100), z.literal("")]).optional(),
  status: z.enum(["active", "inactive", "on_leave"]).default("active"),
  address: z.string().trim().max(2000).optional(),
  licenseNumber: z.string().trim().max(50).optional(),
  licenseExpiry: z.string().optional(),
  emergencyContactName: z.string().trim().max(100).optional(),
  emergencyContactPhone: z.string().trim().max(20).optional(),
  dateHired: z.string().optional(),
  salaryRate: z.coerce.number().min(0, "Salary rate must be zero or more").default(0),
  rateType: z.enum(["Monthly", "Daily", "Per Trip"]).default("Daily"),
  sssNo: z.string().trim().max(20).optional(),
  tinNo: z.string().trim().max(20).optional(),
  philhealthNo: z.string().trim().max(20).optional(),
  pagibigNo: z.string().trim().max(20).optional()
});

const defaultFormValues = {
  firstName: "",
  lastName: "",
  position: "",
  phone: "",
  email: "",
  status: "active",
  address: "",
  licenseNumber: "",
  licenseExpiry: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  dateHired: "",
  salaryRate: 0,
  rateType: "Daily",
  sssNo: "",
  tinNo: "",
  philhealthNo: "",
  pagibigNo: ""
};

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

function formatMoney(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2
  }).format(Number(value ?? 0));
}

function normalizeDateInput(value) {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString().slice(0, 10);
}

function statusLabel(status) {
  if (status === "on_leave") {
    return "On Leave";
  }

  return status === "active" ? "Active" : "Inactive";
}

function positionLabel(position) {
  if (position === "pahenante") {
    return "Pahenante";
  }

  return position.charAt(0).toUpperCase() + position.slice(1);
}

export function EmployeesPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const deferredSearch = useDeferredValue(searchInput.trim());
  const queryClient = useQueryClient();
  const notify = useNotification();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: defaultFormValues
  });
  const selectedPosition = watch("position");

  const { data, isLoading, isError, error, isFetching } = useEmployees({
    page,
    perPage: 10,
    ...(deferredSearch ? { search: deferredSearch } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(positionFilter ? { position: positionFilter } : {})
  });

  const createMutation = useMutation({
    mutationFn: createEmployee,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      notify.success("Employee created successfully");
      reset(defaultFormValues);
      setShowForm(false);
      setEditingEmployee(null);
      setPage(1);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ employeeId, payload }) => updateEmployee(employeeId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      notify.success("Employee updated successfully");
      reset(defaultFormValues);
      setShowForm(false);
      setEditingEmployee(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteEmployee,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      notify.success("Employee removed successfully");
      setDeleteTarget(null);
    }
  });

  const employees = data?.data ?? [];
  const meta = data?.meta;

  function clearFilters() {
    setPage(1);
    setSearchInput("");
    setStatusFilter("");
    setPositionFilter("");
  }

  function closeForm() {
    reset(defaultFormValues);
    setEditingEmployee(null);
    setShowForm(false);
  }

  function openCreateForm() {
    reset(defaultFormValues);
    setEditingEmployee(null);
    setShowForm(true);
  }

  function openEditForm(employee) {
    reset({
      firstName: employee.firstName ?? "",
      lastName: employee.lastName ?? "",
      position: employee.position ?? "",
      phone: employee.phone ?? "",
      email: employee.email ?? "",
      status: employee.status ?? "active",
      address: employee.address ?? "",
      licenseNumber: employee.licenseNumber ?? "",
      licenseExpiry: normalizeDateInput(employee.licenseExpiry),
      emergencyContactName: employee.emergencyContactName ?? "",
      emergencyContactPhone: employee.emergencyContactPhone ?? "",
      dateHired: normalizeDateInput(employee.dateHired),
      salaryRate: Number(employee.salaryRate ?? 0),
      rateType: employee.rateType ?? "Daily",
      sssNo: employee.sssNo ?? "",
      tinNo: employee.tinNo ?? "",
      philhealthNo: employee.philhealthNo ?? "",
      pagibigNo: employee.pagibigNo ?? ""
    });
    setEditingEmployee(employee);
    setShowForm(true);
  }

  async function onSubmit(values) {
    const payload = {
      firstName: values.firstName,
      lastName: values.lastName,
      position: values.position,
      phone: values.phone?.trim() || null,
      email: values.email?.trim() || null,
      status: values.status,
      address: values.address?.trim() || null,
      licenseNumber: values.position === "driver" ? values.licenseNumber?.trim() || null : null,
      licenseExpiry: values.position === "driver" ? values.licenseExpiry || null : null,
      emergencyContactName: values.emergencyContactName?.trim() || null,
      emergencyContactPhone: values.emergencyContactPhone?.trim() || null,
      dateHired: values.dateHired || null,
      salaryRate: Number(values.salaryRate ?? 0),
      rateType: values.rateType,
      sssNo: values.sssNo?.trim() || null,
      tinNo: values.tinNo?.trim() || null,
      philhealthNo: values.philhealthNo?.trim() || null,
      pagibigNo: values.pagibigNo?.trim() || null
    };

    if (editingEmployee) {
      await updateMutation.mutateAsync({
        employeeId: editingEmployee.id,
        payload
      });
      return;
    }

    await createMutation.mutateAsync(payload);
  }

  async function confirmDeleteEmployee() {
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
            <i className="fas fa-id-card text-[18px] text-[#90caf9]" />
            <div>
              <div className="erp-page-title">Employees</div>
              <div className="erp-page-description">Personnel master records and employment profile data</div>
            </div>
          </div>
          <button
            type="button"
            onClick={openCreateForm}
            className="erp-header-primary-button"
          >
            <i className="fas fa-plus mr-1.5" />
            Add Employee
          </button>
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
              placeholder="Search employees..."
              className="erp-input pl-7"
            />
          </div>

          <div className="relative min-w-[160px]">
            <i className="fas fa-briefcase pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
            <select
              value={positionFilter}
              onChange={(event) => {
                setPage(1);
                setPositionFilter(event.target.value);
              }}
              className="erp-select pl-7"
            >
              <option value="">All Positions</option>
              {employeePositionOptions.map((position) => (
                <option key={position} value={position}>
                  {positionLabel(position)}
                </option>
              ))}
            </select>
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
              {employeeStatusOptions.map((status) => (
                <option key={status} value={status}>
                  {statusLabel(status)}
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

      <section className="table-card">
        {isError ? (
          <div className="px-4 py-10 text-[11px] text-[#c62828]">
            Failed to load employees{error?.message ? `: ${error.message}` : "."}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className={`erp-table w-full ${isLoading ? "opacity-70" : ""}`}>
                <thead>
                  <tr>
                    <th className="w-[60px] text-center">ID</th>
                    <th className="min-w-[200px]">Employee</th>
                    <th className="w-[120px]">Position</th>
                    <th className="min-w-[180px]">Contact Info</th>
                    <th className="w-[140px]">Employment</th>
                    <th className="w-[120px]">Salary Rate</th>
                    <th className="w-[100px] text-center">Status</th>
                    <th className="w-[140px]">User Access</th>
                    <th className="w-[100px] text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <TableSkeleton rows={8}>
                      {(index) => (
                        <tr key={`employee-sk-${index}`}>
                          <td><Skeleton className="mx-auto h-3 w-8" /></td>
                          <td>
                            <div className="space-y-1.5">
                              <Skeleton className="h-3 w-28" />
                              <Skeleton className="h-2.5 w-24" />
                            </div>
                          </td>
                          <td><Skeleton className="h-3 w-20" /></td>
                          <td>
                            <div className="space-y-1.5">
                              <Skeleton className="h-3 w-24" />
                              <Skeleton className="h-2.5 w-20" />
                            </div>
                          </td>
                          <td>
                            <div className="space-y-1.5">
                              <Skeleton className="h-3 w-24" />
                              <Skeleton className="h-2.5 w-20" />
                            </div>
                          </td>
                          <td><Skeleton className="h-3 w-20" /></td>
                          <td><Skeleton className="mx-auto h-4 w-16" /></td>
                          <td><Skeleton className="h-3 w-20" /></td>
                          <td className="flex justify-end gap-2">
                            <Skeleton className="h-8 w-8" />
                            <Skeleton className="h-8 w-8" />
                          </td>
                        </tr>
                      )}
                    </TableSkeleton>
                  ) : employees.length === 0 ? (
                    <tr>
                      <td colSpan={9}>
                        <div className="erp-empty-state">
                          No employees found for the current filters.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    employees.map((employee) => (
                      <tr key={employee.id}>
                        <td className="w-[60px] text-center font-mono text-[11px] text-muted">{employee.id}</td>
                        <td className="min-w-[200px]">
                          <div>
                            <p className="font-bold text-ink">{employee.firstName} {employee.lastName}</p>
                            <p className="mt-0.5 max-w-[250px] truncate text-[11px] italic text-muted" title={employee.address}>
                              {employee.address || "No address set"}
                            </p>
                          </div>
                        </td>
                        <td className="w-[120px] whitespace-nowrap">
                          <span className="text-ink">{positionLabel(employee.position)}</span>
                        </td>
                        <td className="min-w-[180px]">
                          <div>
                            <p className="truncate text-ink" title={employee.email}>{employee.email || "No email"}</p>
                            <p className="mt-0.5 text-[11px] text-muted">{employee.phone || "No phone"}</p>
                          </div>
                        </td>
                        <td className="w-[140px] whitespace-nowrap">
                          <div>
                            <p className="text-ink">{formatDate(employee.dateHired)}</p>
                            <p className="mt-0.5 text-[11px] font-medium text-brass">{employee.rateType}</p>
                          </div>
                        </td>
                        <td className="w-[120px] whitespace-nowrap font-medium text-ink">
                          {formatMoney(employee.salaryRate)}
                        </td>
                        <td className="w-[100px] text-center">
                          <span
                            className={`erp-chip ${
                              employee.status === "active"
                                ? "border-[#a5d6a7] bg-[#e8f5e9] text-[#2e7d32]"
                                : employee.status === "on_leave"
                                  ? "border-[#ffe082] bg-[#fff8e1] text-[#f9a825]"
                                  : "border-[#b0bec5] bg-[#f3f6f9] text-muted"
                            }`}
                          >
                            {statusLabel(employee.status)}
                          </span>
                        </td>
                        <td className="w-[140px] whitespace-nowrap">
                          {employee.user ? (
                            <div className="flex items-center gap-1.5">
                              <i className="fas fa-user-circle text-[12px] text-brass" />
                              <span className="text-ink">{employee.user.username}</span>
                            </div>
                          ) : (
                            <span className="text-[11px] italic text-muted">No system account</span>
                          )}
                        </td>
                        <td className="w-[100px]">
                          <div className="erp-row-actions">
                            <button
                              type="button"
                              onClick={() => openEditForm(employee)}
                              className="erp-icon-button-md"
                              title="Edit employee"
                            >
                              <i className="fas fa-pen text-[11px]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(employee)}
                              className="erp-icon-button-danger-md"
                              title="Delete employee"
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
                itemLabel="employees"
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
        title={editingEmployee ? "Edit Employee" : "Add Employee"}
        size="4xl"
        onClose={closeForm}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <p className="text-[10px] text-[#546e7a]">
            {editingEmployee
              ? "Update the employee master record used across operations and access setup."
              : "Create an employee master record before assigning system access."}
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="erp-label">First Name</label>
              <input {...register("firstName")} className="erp-input" />
              {errors.firstName ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.firstName.message}</p> : null}
            </div>
            <div>
              <label className="erp-label">Last Name</label>
              <input {...register("lastName")} className="erp-input" />
              {errors.lastName ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.lastName.message}</p> : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="erp-label">Position</label>
              <select {...register("position")} className="erp-select">
                <option value="">Select position</option>
                {employeePositionOptions.map((position) => (
                  <option key={position} value={position}>
                    {positionLabel(position)}
                  </option>
                ))}
              </select>
              {errors.position ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.position.message}</p> : null}
            </div>
            <div>
              <label className="erp-label">Status</label>
              <select {...register("status")} className="erp-select">
                {employeeStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {statusLabel(status)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="erp-label">Email</label>
              <input {...register("email")} className="erp-input" />
              {errors.email ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.email.message}</p> : null}
            </div>
            <div>
              <label className="erp-label">Phone</label>
              <input {...register("phone")} className="erp-input" />
              {errors.phone ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.phone.message}</p> : null}
            </div>
          </div>

          <div>
            <label className="erp-label">Address</label>
            <textarea {...register("address")} rows={3} className="erp-input min-h-[84px] resize-none" />
            {errors.address ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.address.message}</p> : null}
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="erp-label">Date Hired</label>
              <Controller
                control={control}
                name="dateHired"
                render={({ field }) => (
                  <DateField
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
            <div>
              <label className="erp-label">Salary Rate</label>
              <input type="number" step="0.01" {...register("salaryRate")} className="erp-input" />
              {errors.salaryRate ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.salaryRate.message}</p> : null}
            </div>
            <div>
              <label className="erp-label">Rate Type</label>
              <select {...register("rateType")} className="erp-select">
                {rateTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedPosition === "driver" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="erp-label">Driver License Number</label>
                <input {...register("licenseNumber")} className="erp-input" />
              </div>
              <div>
                <label className="erp-label">Driver License Expiry</label>
                <Controller
                  control={control}
                  name="licenseExpiry"
                  render={({ field }) => (
                    <DateField
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="erp-label">Emergency Contact Name</label>
              <input {...register("emergencyContactName")} className="erp-input" />
            </div>
            <div>
              <label className="erp-label">Emergency Contact Phone</label>
              <input {...register("emergencyContactPhone")} className="erp-input" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="erp-label">SSS No.</label>
              <input {...register("sssNo")} className="erp-input" />
            </div>
            <div>
              <label className="erp-label">TIN No.</label>
              <input {...register("tinNo")} className="erp-input" />
            </div>
            <div>
              <label className="erp-label">PhilHealth No.</label>
              <input {...register("philhealthNo")} className="erp-input" />
            </div>
            <div>
              <label className="erp-label">Pag-IBIG No.</label>
              <input {...register("pagibigNo")} className="erp-input" />
            </div>
          </div>

          {createMutation.isError || updateMutation.isError ? (
            <div className="rounded-sm border border-[#ef9a9a] bg-[#fff5f5] px-4 py-3 text-[11px] text-[#c62828]">
              Failed to {editingEmployee ? "update" : "create"} employee
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
              {formBusy ? "Saving..." : editingEmployee ? "Update Employee" : "Create Employee"}
            </button>
          </div>
        </form>
      </FormModal>

      <ConfirmationModal
        show={Boolean(deleteTarget)}
        title="Remove Employee"
        message={
          deleteTarget
            ? `Are you sure you want to remove ${deleteTarget.firstName} ${deleteTarget.lastName}?`
            : ""
        }
        type="error"
        showCancel
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={() => void confirmDeleteEmployee()}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
