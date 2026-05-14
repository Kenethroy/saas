import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ConfirmationModal } from "@/shared/components/common/ConfirmationModal";
import { FormModal } from "@/shared/components/common/FormModal";
import { Pagination } from "@/shared/components/common/Pagination";
import { Skeleton, TableSkeleton } from "@/shared/components/common/Skeleton";
import { useNotification } from "@/shared/hooks/useNotification";
import {
  createUser,
  deleteUser,
  updateUser
} from "@/modules/users/api/users.api";
import { useUserEmployeeOptions } from "@/modules/users/hooks/useUserEmployeeOptions";
import { useUsers } from "@/modules/users/hooks/useUsers";

const roleOptions = ["staff", "agent", "driver"];

const userFormSchema = z.object({
  employeeId: z.union([z.coerce.number().int().positive(), z.literal(""), z.null()]).optional(),
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(100, "Username is too long")
    .regex(/^[A-Za-z0-9_.-]+$/, "Username may only contain letters, numbers, dot, underscore, and dash"),
  email: z.string().trim().email("Invalid email format").max(255),
  password: z.union([z.string().min(6, "Password must be at least 6 characters"), z.literal("")]).optional(),
  role: z.enum(["staff", "agent", "driver"]).default("staff"),
  status: z.boolean().default(true)
});

const defaultFormValues = {
  employeeId: "",
  username: "",
  email: "",
  password: "",
  role: "staff",
  status: true
};

function buildGeneratedUsername(employee) {
  const first = (employee.firstName ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  const last = (employee.lastName ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  const base = [first, last].filter(Boolean).join(".");

  return `${base || "user"}.${employee.id}`;
}

function generatePassword(length = 10) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let result = "";

  for (let index = 0; index < length; index += 1) {
    const randomIndex = Math.floor(Math.random() * alphabet.length);
    result += alphabet[randomIndex];
  }

  return result;
}

function formatDate(value) {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(new Date(value));
}

function roleLabel(role) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function employeeLabel(employee) {
  return `${employee.firstName} ${employee.lastName}`;
}

export function UsersPage() {
  const [searchParams] = useSearchParams();
  const externalSearch = (searchParams.get("search") ?? "").trim();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState(externalSearch);
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const deferredSearch = useDeferredValue(searchInput.trim());
  const queryClient = useQueryClient();
  const notify = useNotification();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    clearErrors,
    watch,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(userFormSchema),
    defaultValues: defaultFormValues
  });

  const { data, isLoading, isError, error, isFetching } = useUsers({
    page,
    perPage: 10,
    ...(deferredSearch ? { search: deferredSearch } : {}),
    ...(roleFilter ? { role: roleFilter } : {}),
    ...(statusFilter !== "" ? { status: statusFilter === "1" } : {})
  });

  const { data: employeeOptionsResponse, isLoading: isEmployeeOptionsLoading } = useUserEmployeeOptions();

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["users"] }),
        queryClient.invalidateQueries({ queryKey: ["user-employee-options"] }),
        queryClient.invalidateQueries({ queryKey: ["employees"] })
      ]);
      notify.success("User account created successfully");
      reset(defaultFormValues);
      setEditingUser(null);
      setShowForm(false);
      setPage(1);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ userId, payload }) => updateUser(userId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      notify.success("User account updated successfully");
      reset(defaultFormValues);
      setEditingUser(null);
      setShowForm(false);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["users"] }),
        queryClient.invalidateQueries({ queryKey: ["user-employee-options"] }),
        queryClient.invalidateQueries({ queryKey: ["employees"] })
      ]);
      notify.success("User account removed successfully");
      setDeleteTarget(null);
    }
  });

  const users = data?.data ?? [];
  const meta = data?.meta;
  const employeeOptions = employeeOptionsResponse?.data ?? [];
  const selectedEmployeeId = watch("employeeId");
  const accountStatus = watch("status");

  useEffect(() => {
    setPage(1);
    setSearchInput(externalSearch);
  }, [externalSearch]);

  const selectedEmployee = useMemo(() => {
    if (editingUser?.employee) {
      return editingUser.employee;
    }

    const employeeId =
      selectedEmployeeId === "" || selectedEmployeeId === null || selectedEmployeeId === undefined
        ? null
        : Number(selectedEmployeeId);

    if (!employeeId) {
      return null;
    }

    return employeeOptions.find((employee) => employee.id === employeeId) ?? null;
  }, [editingUser, employeeOptions, selectedEmployeeId]);

  function clearFilters() {
    setPage(1);
    setSearchInput("");
    setRoleFilter("");
    setStatusFilter("");
  }

  function closeForm() {
    reset(defaultFormValues);
    clearErrors();
    setEditingUser(null);
    setShowForm(false);
  }

  function openCreateForm() {
    reset(defaultFormValues);
    clearErrors();
    setEditingUser(null);
    setShowForm(true);
  }

  function openEditForm(user) {
    reset({
      employeeId: user.employeeId ?? "",
      username: user.username ?? "",
      email: user.email ?? "",
      password: "",
      role: user.role ?? "staff",
      status: user.status ?? true
    });
    clearErrors();
    setEditingUser(user);
    setShowForm(true);
  }

  function handleEmployeeChange(employeeIdValue) {
    setValue("employeeId", employeeIdValue, {
      shouldDirty: true,
      shouldValidate: true
    });
    clearErrors("employeeId");

    if (!employeeIdValue) {
      return;
    }

    const matchedEmployee = employeeOptions.find((employee) => employee.id === Number(employeeIdValue));

    if (!matchedEmployee) {
      return;
    }

    if (matchedEmployee.email) {
      setValue("email", matchedEmployee.email, {
        shouldDirty: true,
        shouldValidate: true
      });
    }

    setValue("username", buildGeneratedUsername(matchedEmployee), {
      shouldDirty: true,
      shouldValidate: true
    });

    setValue("password", generatePassword(), {
      shouldDirty: true,
      shouldValidate: true
    });
  }

  async function onSubmit(values) {
    if (!editingUser && !values.employeeId) {
      setError("employeeId", {
        type: "manual",
        message: "Employee is required"
      });
      return;
    }

    if (!editingUser && !values.password) {
      setError("password", {
        type: "manual",
        message: "Password is required"
      });
      return;
    }

    const payload = {
      username: values.username.trim(),
      email: values.email.trim(),
      role: values.role,
      status: values.status,
      ...(values.password ? { password: values.password } : {})
    };

    if (editingUser) {
      await updateMutation.mutateAsync({
        userId: editingUser.id,
        payload
      });
      return;
    }

    const selectedCreateEmployee = employeeOptions.find((employee) => employee.id === Number(values.employeeId));

    await createMutation.mutateAsync({
      employeeId: Number(values.employeeId),
      ...payload
    });

    setCreatedCredentials({
      employeeName: selectedCreateEmployee ? employeeLabel(selectedCreateEmployee) : null,
      username: payload.username,
      password: payload.password,
      email: payload.email,
      role: payload.role
    });
  }

  async function confirmDeleteUser() {
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
            <i className="fas fa-user-gear text-[18px] text-[#90caf9]" />
            <div>
              <div className="erp-page-title">Users</div>
              <div className="erp-page-description">System access accounts linked to employee master records</div>
            </div>
          </div>
          <button
            type="button"
            onClick={openCreateForm}
            className="erp-header-primary-button"
          >
            <i className="fas fa-plus mr-1.5" />
            Add User
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
              placeholder="Search users..."
              className="erp-input pl-7"
            />
          </div>

          <div className="relative min-w-[140px]">
            <i className="fas fa-user-shield pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
            <select
              value={roleFilter}
              onChange={(event) => {
                setPage(1);
                setRoleFilter(event.target.value);
              }}
              className="erp-select pl-7"
            >
              <option value="">All Roles</option>
              {roleOptions.map((role) => (
                <option key={role} value={role}>
                  {roleLabel(role)}
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
            Failed to load users{error?.message ? `: ${error.message}` : "."}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className={`erp-table w-full min-w-[1040px] ${isLoading ? "opacity-70" : ""}`}>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Employee</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Last Login</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <TableSkeleton rows={8}>
                      {(index) => (
                        <tr key={`user-sk-${index}`}>
                          <td><Skeleton className="mx-auto h-3 w-8" /></td>
                          <td>
                            <div className="space-y-1.5">
                              <Skeleton className="h-3 w-28" />
                              <Skeleton className="h-2.5 w-20 bg-[#e3ebf1]" />
                            </div>
                          </td>
                          <td><Skeleton className="h-3 w-24" /></td>
                          <td><Skeleton className="h-3 w-32" /></td>
                          <td><Skeleton className="h-3 w-16" /></td>
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
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-0 text-center text-[11px] italic text-[#90a4ae]">
                        <div className="flex min-h-[220px] items-center justify-center">
                          No users found for the current filters.
                        </div>
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id}>
                        <td className="font-mono text-muted">{user.id}</td>
                        <td>
                          <div>
                            <p className="font-bold text-ink">{user.employee ? employeeLabel(user.employee) : "No employee linked"}</p>
                            <p className="mt-0.5 text-[10px] text-[#90a4ae]">
                              {user.employee ? roleLabel(user.employee.position) : "N/A"}
                            </p>
                          </div>
                        </td>
                        <td>{user.username}</td>
                        <td>{user.email}</td>
                        <td>{roleLabel(user.role)}</td>
                        <td className="text-center">
                          <span
                            className={`rounded-sm border px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                              user.status
                                ? "border-[#a5d6a7] bg-[#e8f5e9] text-[#2e7d32]"
                                : "border-[#b0bec5] bg-[#f3f6f9] text-muted"
                            }`}
                          >
                            {user.status ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="text-muted">{formatDate(user.lastLoginAt)}</td>
                        <td>
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEditForm(user)}
                              className="erp-icon-button-md"
                              title="Edit user"
                            >
                              <i className="fas fa-pen text-[11px]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(user)}
                              className="erp-icon-button-danger-md"
                              title="Delete user"
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
                itemLabel="users"
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
        title={editingUser ? "Edit User" : "Add User"}
        size="2xl"
        onClose={closeForm}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <p className="text-[10px] text-[#546e7a]">
            {editingUser
              ? "Update login credentials, role assignment, and account status for this employee."
              : "Create a system access account for an employee who does not yet have one."}
          </p>

          <div>
            <label className="erp-label">Employee</label>
            {editingUser ? (
              <div className="rounded-sm border border-[#d3dee7] bg-[#f8fbfd] px-3 py-2.5">
                <p className="text-[12px] font-bold text-[#1a3557]">
                  {editingUser.employee ? employeeLabel(editingUser.employee) : "No employee linked"}
                </p>
                <p className="mt-0.5 text-[10px] text-[#607d8b]">
                  {editingUser.employee ? `${roleLabel(editingUser.employee.position)} - ${editingUser.employee.email || "No email"}` : "Employee link is fixed for existing user accounts."}
                </p>
              </div>
            ) : (
              <>
                <select
                  {...register("employeeId")}
                  className="erp-select"
                  disabled={isEmployeeOptionsLoading || employeeOptions.length === 0}
                  onChange={(event) => handleEmployeeChange(event.target.value)}
                >
                  <option value="">
                    {isEmployeeOptionsLoading
                      ? "Loading employees..."
                      : employeeOptions.length === 0
                        ? "No employees available"
                        : "Select employee"}
                  </option>
                  {employeeOptions.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employeeLabel(employee)} ({roleLabel(employee.position)})
                    </option>
                  ))}
                </select>
                {errors.employeeId ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.employeeId.message}</p> : null}
                {selectedEmployee ? (
                  <p className="mt-1.5 text-[10px] text-[#607d8b]">
                    {roleLabel(selectedEmployee.position)}{selectedEmployee.email ? ` - ${selectedEmployee.email}` : ""}
                  </p>
                ) : null}
              </>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="erp-label">Username</label>
              <input {...register("username")} className="erp-input" placeholder="e.g. juan.dela-cruz" />
              {errors.username ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.username.message}</p> : null}
              {!editingUser && selectedEmployee ? (
                <p className="mt-1.5 text-[10px] text-[#607d8b]">Generated from the selected employee. You can still edit it before saving.</p>
              ) : null}
            </div>
            <div>
              <label className="erp-label">Email</label>
              <input {...register("email")} className="erp-input" placeholder="user@example.com" />
              {errors.email ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.email.message}</p> : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="erp-label">{editingUser ? "New Password" : "Password"}</label>
              <input
                type="password"
                {...register("password")}
                className="erp-input"
                placeholder={editingUser ? "Leave blank to keep current password" : "Minimum 6 characters"}
              />
              {errors.password ? <p className="mt-1 text-[10px] text-[#c62828]">{errors.password.message}</p> : null}
              {editingUser ? (
                <p className="mt-1.5 text-[10px] text-[#607d8b]">Leave blank if the password should stay unchanged.</p>
              ) : selectedEmployee ? (
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <p className="text-[10px] text-[#607d8b]">Generated automatically when an employee is selected. You can still edit it.</p>
                  <button
                    type="button"
                    onClick={() =>
                      setValue("password", generatePassword(), {
                        shouldDirty: true,
                        shouldValidate: true
                      })
                    }
                    className="text-[10px] font-bold text-[#0070b8] transition hover:text-[#005a94]"
                  >
                    Regenerate
                  </button>
                </div>
              ) : null}
            </div>
            <div>
              <label className="erp-label">Role</label>
              <select {...register("role")} className="erp-select">
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {roleLabel(role)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="erp-label">Account Status</label>
            <label className="inline-flex items-center gap-2 text-[11px] font-bold text-[#607d8b]">
              <input type="checkbox" {...register("status")} className="sr-only" />
              <button
                type="button"
                onClick={() =>
                  setValue("status", !accountStatus, {
                    shouldDirty: true,
                    shouldValidate: false
                  })
                }
                className={`relative inline-flex h-4 w-8 items-center rounded-full transition ${
                  accountStatus ? "bg-[#2e7d32]" : "bg-[#b0bec5]"
                }`}
                aria-pressed={accountStatus}
                aria-label={`Set user as ${accountStatus ? "inactive" : "active"}`}
              >
                <span
                  className={`h-3 w-3 rounded-full bg-white shadow-sm transition ${
                    accountStatus ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </button>
              <span>{accountStatus ? "Active" : "Inactive"}</span>
            </label>
          </div>

          {createMutation.isError || updateMutation.isError ? (
            <div className="rounded-sm border border-[#ef9a9a] bg-[#fff5f5] px-4 py-3 text-[11px] text-[#c62828]">
              Failed to {editingUser ? "update" : "create"} user
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
              {formBusy ? "Saving..." : editingUser ? "Update User" : "Create User"}
            </button>
          </div>
        </form>
      </FormModal>

      <ConfirmationModal
        show={Boolean(deleteTarget)}
        title="Remove User"
        message={deleteTarget ? `Are you sure you want to remove ${deleteTarget.username}?` : ""}
        type="error"
        showCancel
        confirmText="Remove"
        cancelText="Cancel"
        onConfirm={() => void confirmDeleteUser()}
        onClose={() => setDeleteTarget(null)}
      />

      <FormModal
        show={Boolean(createdCredentials)}
        title="Account Credentials"
        size="lg"
        onClose={() => setCreatedCredentials(null)}
      >
        <div className="space-y-5">
          <p className="text-[10px] text-[#546e7a]">
            The user account was created successfully. These are the final credentials for the new access account.
          </p>

          <div className="space-y-3 rounded-sm border border-[#d3dee7] bg-[#f8fbfd] p-4">
            {createdCredentials?.employeeName ? (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#607d8b]">Employee</p>
                <p className="mt-1 text-[13px] font-bold text-[#1a3557]">{createdCredentials.employeeName}</p>
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#607d8b]">Username</p>
                <div className="mt-1 rounded-sm border border-[#d3dee7] bg-white px-3 py-2 font-mono text-[12px] text-[#1a3557]">
                  {createdCredentials?.username}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#607d8b]">Password</p>
                <div className="mt-1 rounded-sm border border-[#d3dee7] bg-white px-3 py-2 font-mono text-[12px] text-[#1a3557]">
                  {createdCredentials?.password}
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#607d8b]">Email</p>
                <div className="mt-1 rounded-sm border border-[#d3dee7] bg-white px-3 py-2 text-[12px] text-[#1a3557]">
                  {createdCredentials?.email}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#607d8b]">Role</p>
                <div className="mt-1 rounded-sm border border-[#d3dee7] bg-white px-3 py-2 text-[12px] text-[#1a3557]">
                  {createdCredentials?.role ? roleLabel(createdCredentials.role) : ""}
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button type="button" onClick={() => setCreatedCredentials(null)} className="erp-button-primary">
              Close
            </button>
          </div>
        </div>
      </FormModal>
    </div>
  );
}
