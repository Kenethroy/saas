import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/shared/components/common/Skeleton";
import { useNotification } from "@/shared/hooks/useNotification";
import {
  syncRolePermissions,
  syncUserPermissions
} from "@/modules/permissions/api/permissions.api";
import {
  usePermissions,
  useRolePermissions,
  useRoleSummaries,
  useUserPermissions
} from "@/modules/permissions/hooks/usePermissions";
import { useUsers } from "@/modules/users/hooks/useUsers";

function roleLabel(role) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function moduleLabel(moduleName) {
  return moduleName
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function PermissionGroupSkeleton() {
  return (
    <div className="rounded-sm border border-[#d3dee7] bg-white p-4 shadow-[0_1px_2px_rgba(26,53,87,0.06)]">
      <Skeleton className="h-4 w-36" />
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-sm border border-[#e3ebf1] bg-[#f8fbfd] px-3 py-2.5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-2 h-2.5 w-40 bg-[#e3ebf1]" />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="rounded-sm border border-[#d3dee7] bg-white px-4 py-0 shadow-[0_1px_2px_rgba(26,53,87,0.06)]">
      <div className="flex min-h-[220px] items-center justify-center text-[11px] italic text-[#90a4ae]">
        {message}
      </div>
    </div>
  );
}

export function PermissionsPage() {
  const [selectedRole, setSelectedRole] = useState("staff");
  const [roleSelection, setRoleSelection] = useState([]);
  const [userSearchInput, setUserSearchInput] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [userSelection, setUserSelection] = useState([]);
  const deferredUserSearch = useDeferredValue(userSearchInput.trim());
  const queryClient = useQueryClient();
  const notify = useNotification();

  const { data: permissionsResponse, isLoading: isPermissionsLoading, isError: isPermissionsError, error: permissionsError } = usePermissions();
  const { data: roleSummariesResponse, isLoading: isRoleSummariesLoading } = useRoleSummaries();
  const { data: rolePermissionsResponse, isLoading: isRolePermissionsLoading } = useRolePermissions(selectedRole);
  const {
    data: userPermissionsResponse,
    isLoading: isUserPermissionsLoading,
    isError: isUserPermissionsError,
    error: userPermissionsError
  } = useUserPermissions(selectedUserId || null);
  const { data: usersResponse, isLoading: isUsersLoading } = useUsers({
    page: 1,
    perPage: 100,
    ...(deferredUserSearch ? { search: deferredUserSearch } : {})
  });

  const permissions = permissionsResponse?.data ?? [];
  const roleSummaries = roleSummariesResponse?.data ?? [];
  const users = usersResponse?.data ?? [];
  const rolePermissionIds = useMemo(
    () => (rolePermissionsResponse?.data ?? []).map((permission) => permission.id),
    [rolePermissionsResponse]
  );
  const userOverrideIds = useMemo(
    () => (userPermissionsResponse?.data?.overrides ?? []).map((permission) => permission.id),
    [userPermissionsResponse]
  );
  const inheritedRolePermissions = userPermissionsResponse?.data?.rolePermissions ?? [];

  useEffect(() => {
    if (roleSummaries.length > 0 && !roleSummaries.some((role) => role.id === selectedRole)) {
      setSelectedRole(roleSummaries[0].id);
    }
  }, [roleSummaries, selectedRole]);

  useEffect(() => {
    setRoleSelection(rolePermissionIds);
  }, [rolePermissionIds]);

  useEffect(() => {
    setUserSelection(userOverrideIds);
  }, [userOverrideIds]);

  const groupedPermissions = useMemo(() => {
    const groups = new Map();

    for (const permission of permissions) {
      const groupKey = permission.module || "general";
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }

      groups.get(groupKey).push(permission);
    }

    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([groupKey, groupPermissions]) => ({
        key: groupKey,
        label: moduleLabel(groupKey),
        permissions: groupPermissions
      }));
  }, [permissions]);

  const roleMutation = useMutation({
    mutationFn: ({ role, permissionIds }) => syncRolePermissions(role, permissionIds),
    onSuccess: async (_, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["role-permissions", variables.role] }),
        queryClient.invalidateQueries({ queryKey: ["role-summaries"] })
      ]);
      notify.success(`Role permissions updated for ${roleLabel(variables.role)}`);
    }
  });

  const userMutation = useMutation({
    mutationFn: ({ userId, permissionIds }) => syncUserPermissions(userId, permissionIds),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["user-permissions", variables.userId] });
      notify.success("User permission overrides updated successfully");
    }
  });

  function toggleRolePermission(permissionId) {
    setRoleSelection((current) =>
      current.includes(permissionId)
        ? current.filter((id) => id !== permissionId)
        : [...current, permissionId]
    );
  }

  function toggleUserPermission(permissionId) {
    setUserSelection((current) =>
      current.includes(permissionId)
        ? current.filter((id) => id !== permissionId)
        : [...current, permissionId]
    );
  }

  async function saveRolePermissions() {
    await roleMutation.mutateAsync({
      role: selectedRole,
      permissionIds: [...roleSelection].sort((a, b) => a - b)
    });
  }

  async function saveUserPermissions() {
    if (!selectedUserId) {
      return;
    }

    await userMutation.mutateAsync({
      userId: selectedUserId,
      permissionIds: [...userSelection].sort((a, b) => a - b)
    });
  }

  const selectedUser = users.find((user) => user.id === Number(selectedUserId)) ?? null;
  const roleDirty = useMemo(() => {
    const base = [...rolePermissionIds].sort((a, b) => a - b);
    const current = [...roleSelection].sort((a, b) => a - b);
    return JSON.stringify(base) !== JSON.stringify(current);
  }, [rolePermissionIds, roleSelection]);
  const userDirty = useMemo(() => {
    const base = [...userOverrideIds].sort((a, b) => a - b);
    const current = [...userSelection].sort((a, b) => a - b);
    return JSON.stringify(base) !== JSON.stringify(current);
  }, [userOverrideIds, userSelection]);

  return (
    <div className="space-y-4">
      <section className="erp-page-section">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <i className="fas fa-user-shield text-[18px] text-[#90caf9]" />
            <div>
              <div className="erp-page-title">Permissions</div>
              <div className="erp-page-description">Role-based access control and user-specific overrides</div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="rounded-sm border border-[#d3dee7] bg-white p-4 shadow-[0_1px_2px_rgba(26,53,87,0.06)]">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[13px] font-bold text-[#1a3557]">Role Permissions</p>
              <p className="mt-1 text-[10px] text-[#607d8b]">Choose a role, then assign the baseline permissions every user in that role should inherit.</p>
            </div>
            {selectedRole !== "admin" ? (
              <button
                type="button"
                onClick={() => void saveRolePermissions()}
                disabled={!roleDirty || roleMutation.isPending || isRolePermissionsLoading}
                className="erp-button-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {roleMutation.isPending ? "Saving..." : "Save Role Permissions"}
              </button>
            ) : null}
          </div>

          {isRoleSummariesLoading ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-sm border border-[#d3dee7] bg-[#f8fbfd] p-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="mt-2 h-3 w-32 bg-[#e3ebf1]" />
                  <div className="mt-4 flex gap-3">
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-8 w-16" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {roleSummaries.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setSelectedRole(role.id)}
                  className={`rounded-sm border p-4 text-left transition ${
                    selectedRole === role.id
                      ? "border-[#0070b8] bg-[#eef5fa] shadow-[inset_0_0_0_1px_#64b5f6]"
                      : "border-[#d3dee7] bg-white hover:border-[#9eb9d0]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-bold text-[#1a3557]">{role.name}</p>
                      <p className="mt-1 text-[10px] text-[#607d8b]">{role.description}</p>
                    </div>
                    {role.id === "admin" ? (
                      <span className="rounded-sm border border-[#c5e1f7] bg-[#eef5fa] px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#0070b8]">
                        System
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-[10px]">
                    <span className="rounded-sm border border-[#d3dee7] bg-[#f8fbfd] px-2 py-1 text-[#546e7a]">
                      {role.permission_count} permissions
                    </span>
                    <span className="rounded-sm border border-[#d3dee7] bg-[#f8fbfd] px-2 py-1 text-[#546e7a]">
                      {role.user_count} users
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 rounded-sm border border-[#d3dee7] bg-[#f8fbfd] px-3 py-2.5 text-[10px] text-[#607d8b]">
            {selectedRole === "admin"
              ? "Admin is treated as full-access in the backend, so role permission editing is locked here."
              : `Editing ${roleLabel(selectedRole)} role permissions.`}
          </div>
        </div>

        {isPermissionsError ? (
          <div className="rounded-sm border border-[#ef9a9a] bg-[#fff5f5] px-4 py-8 text-[11px] text-[#c62828]">
            Failed to load permissions{permissionsError?.message ? `: ${permissionsError.message}` : "."}
          </div>
        ) : isPermissionsLoading || isRolePermissionsLoading ? (
          <div className="space-y-4">
            <PermissionGroupSkeleton />
            <PermissionGroupSkeleton />
          </div>
        ) : (
          <div className="space-y-4">
            {groupedPermissions.map((group) => (
              <section key={group.key} className="rounded-sm border border-[#d3dee7] bg-white p-4 shadow-[0_1px_2px_rgba(26,53,87,0.06)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-bold text-[#1a3557]">{group.label}</p>
                    <p className="mt-1 text-[10px] text-[#607d8b]">{group.permissions.length} permission entries</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {group.permissions.map((permission) => (
                    <label
                      key={`${selectedRole}-${permission.id}`}
                      className={`rounded-sm border px-3 py-2.5 text-left transition ${
                        selectedRole === "admin"
                          ? "border-[#e3ebf1] bg-[#f8fbfd] opacity-70"
                          : roleSelection.includes(permission.id)
                            ? "border-[#90caf9] bg-[#eef5fa]"
                            : "border-[#d3dee7] bg-white hover:border-[#9eb9d0]"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={roleSelection.includes(permission.id)}
                          disabled={selectedRole === "admin"}
                          onChange={() => toggleRolePermission(permission.id)}
                          className="mt-0.5 h-4 w-4 rounded border-[#90a4ae] text-[#0070b8] focus:ring-[#64b5f6]"
                        />
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold text-[#1a3557]">{permission.name}</p>
                          <p className="mt-1 text-[10px] text-[#607d8b]">{permission.slug}</p>
                          {permission.description ? (
                            <p className="mt-1 text-[10px] text-[#90a4ae]">{permission.description}</p>
                          ) : null}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-sm border border-[#d3dee7] bg-white p-4 shadow-[0_1px_2px_rgba(26,53,87,0.06)]">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[13px] font-bold text-[#1a3557]">User Permission Overrides</p>
            <p className="mt-1 text-[10px] text-[#607d8b]">Override the role baseline for one specific user when a special exception is needed.</p>
          </div>
          <button
            type="button"
            onClick={() => void saveUserPermissions()}
            disabled={!selectedUserId || !userDirty || userMutation.isPending || isUserPermissionsLoading}
            className="erp-button-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {userMutation.isPending ? "Saving..." : "Save User Overrides"}
          </button>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(260px,320px)_1fr]">
          <div className="space-y-3">
            <div className="relative">
              <i className="fas fa-search pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#90a4ae]" />
              <input
                value={userSearchInput}
                onChange={(event) => setUserSearchInput(event.target.value)}
                placeholder="Search users..."
                className="erp-input pl-7"
              />
            </div>

            <div className="max-h-[420px] overflow-y-auto rounded-sm border border-[#d3dee7] bg-[#f8fbfd] p-2">
              {isUsersLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="rounded-sm border border-[#e3ebf1] bg-white px-3 py-2.5">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="mt-2 h-2.5 w-32 bg-[#e3ebf1]" />
                    </div>
                  ))}
                </div>
              ) : users.length === 0 ? (
                <div className="flex min-h-[180px] items-center justify-center px-4 text-center text-[11px] italic text-[#90a4ae]">
                  No users found for the current search.
                </div>
              ) : (
                <div className="space-y-2">
                  {users.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setSelectedUserId(String(user.id))}
                      className={`w-full rounded-sm border px-3 py-2.5 text-left transition ${
                        selectedUserId === String(user.id)
                          ? "border-[#0070b8] bg-[#eef5fa]"
                          : "border-[#d3dee7] bg-white hover:border-[#9eb9d0]"
                      }`}
                    >
                      <p className="text-[11px] font-bold text-[#1a3557]">{user.username}</p>
                      <p className="mt-1 text-[10px] text-[#607d8b]">
                        {user.employee ? `${user.employee.firstName} ${user.employee.lastName}` : "No employee linked"}
                      </p>
                      <p className="mt-1 text-[10px] text-[#90a4ae]">{roleLabel(user.role)} - {user.email}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            {!selectedUserId ? (
              <EmptyState message="Select a user on the left to manage permission overrides." />
            ) : isUserPermissionsError ? (
              <div className="rounded-sm border border-[#ef9a9a] bg-[#fff5f5] px-4 py-8 text-[11px] text-[#c62828]">
                Failed to load user permissions{userPermissionsError?.message ? `: ${userPermissionsError.message}` : "."}
              </div>
            ) : isUserPermissionsLoading ? (
              <div className="space-y-4">
                <div className="rounded-sm border border-[#d3dee7] bg-white p-4 shadow-[0_1px_2px_rgba(26,53,87,0.06)]">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="mt-2 h-3 w-48 bg-[#e3ebf1]" />
                </div>
                <PermissionGroupSkeleton />
              </div>
            ) : (
              <>
                <div className="rounded-sm border border-[#d3dee7] bg-[#f8fbfd] p-4">
                  <p className="text-[13px] font-bold text-[#1a3557]">
                    {selectedUser ? selectedUser.username : "Selected User"}
                  </p>
                  <p className="mt-1 text-[10px] text-[#607d8b]">
                    {selectedUser?.employee
                      ? `${selectedUser.employee.firstName} ${selectedUser.employee.lastName} - ${roleLabel(selectedUser.role)}`
                      : roleLabel(selectedUser?.role ?? "staff")}
                  </p>
                  <div className="mt-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#607d8b]">Inherited Role Permissions</p>
                    {inheritedRolePermissions.length === 0 ? (
                      <p className="mt-2 text-[10px] text-[#90a4ae]">No inherited permissions found for this role.</p>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {inheritedRolePermissions.map((permission) => (
                          <span
                            key={`inherited-${permission.id}`}
                            className="rounded-sm border border-[#c5e1f7] bg-[#eef5fa] px-2 py-1 text-[10px] text-[#0070b8]"
                          >
                            {permission.slug}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {groupedPermissions.map((group) => (
                  <section key={`user-${group.key}`} className="rounded-sm border border-[#d3dee7] bg-white p-4 shadow-[0_1px_2px_rgba(26,53,87,0.06)]">
                    <p className="text-[13px] font-bold text-[#1a3557]">{group.label}</p>
                    <p className="mt-1 text-[10px] text-[#607d8b]">Checked permissions here are explicit user overrides.</p>

                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {group.permissions.map((permission) => (
                        <label
                          key={`user-${selectedUserId}-${permission.id}`}
                          className={`rounded-sm border px-3 py-2.5 transition ${
                            userSelection.includes(permission.id)
                              ? "border-[#90caf9] bg-[#eef5fa]"
                              : "border-[#d3dee7] bg-white hover:border-[#9eb9d0]"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={userSelection.includes(permission.id)}
                              onChange={() => toggleUserPermission(permission.id)}
                              className="mt-0.5 h-4 w-4 rounded border-[#90a4ae] text-[#0070b8] focus:ring-[#64b5f6]"
                            />
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold text-[#1a3557]">{permission.name}</p>
                              <p className="mt-1 text-[10px] text-[#607d8b]">{permission.slug}</p>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </section>
                ))}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
