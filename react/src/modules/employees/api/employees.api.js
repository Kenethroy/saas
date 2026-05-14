import { apiClient } from "@/shared/api/client";

export async function getEmployees(params = {}) {
  const response = await apiClient.get("/api/employees", {
    params
  });

  return response.data;
}

export async function createEmployee(payload) {
  const response = await apiClient.post("/api/employees/create", payload);
  return response.data;
}

export async function updateEmployee(employeeId, payload) {
  const response = await apiClient.patch(`/api/employees/${employeeId}`, payload);
  return response.data;
}

export async function deleteEmployee(employeeId) {
  const response = await apiClient.delete(`/api/employees/${employeeId}`);
  return response.data;
}
