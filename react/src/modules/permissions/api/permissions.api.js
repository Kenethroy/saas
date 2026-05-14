import { apiClient } from "@/shared/api/client";

export async function getPermissions() {
  const response = await apiClient.get("/api/permissions");
  return response.data;
}

export async function getRoleSummaries() {
  const response = await apiClient.get("/api/roles");
  return response.data;
}

export async function getRolePermissions(role) {
  const response = await apiClient.get(`/api/roles/${role}/permissions`);
  return response.data;
}

export async function syncRolePermissions(role, permissionIds) {
  const response = await apiClient.post(`/api/roles/${role}/permissions`, {
    permissionIds
  });

  return response.data;
}

export async function getUserPermissions(userId) {
  const response = await apiClient.get(`/api/users/${userId}/permissions`);
  return response.data;
}

export async function syncUserPermissions(userId, permissionIds) {
  const response = await apiClient.post(`/api/users/${userId}/permissions`, {
    permissionIds
  });

  return response.data;
}
