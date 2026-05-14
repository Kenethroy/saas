import { apiClient } from "@/shared/api/client";

export async function getUsers(params = {}) {
  const response = await apiClient.get("/api/users", {
    params
  });

  return response.data;
}

export async function getUserEmployeeOptions(params = {}) {
  const response = await apiClient.get("/api/users/employee-options", {
    params
  });

  return response.data;
}

export async function createUser(payload) {
  const response = await apiClient.post("/api/users/create", payload);
  return response.data;
}

export async function updateUser(userId, payload) {
  const response = await apiClient.patch(`/api/users/${userId}`, payload);
  return response.data;
}

export async function deleteUser(userId) {
  const response = await apiClient.delete(`/api/users/${userId}`);
  return response.data;
}
