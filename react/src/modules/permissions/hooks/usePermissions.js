import { useQuery } from "@tanstack/react-query";
import {
  getPermissions,
  getRolePermissions,
  getRoleSummaries,
  getUserPermissions
} from "@/modules/permissions/api/permissions.api";

export function usePermissions() {
  return useQuery({
    queryKey: ["permissions"],
    queryFn: getPermissions
  });
}

export function useRoleSummaries() {
  return useQuery({
    queryKey: ["role-summaries"],
    queryFn: getRoleSummaries
  });
}

export function useRolePermissions(role) {
  return useQuery({
    queryKey: ["role-permissions", role],
    queryFn: () => getRolePermissions(role),
    enabled: Boolean(role)
  });
}

export function useUserPermissions(userId) {
  return useQuery({
    queryKey: ["user-permissions", userId],
    queryFn: () => getUserPermissions(userId),
    enabled: Boolean(userId)
  });
}
