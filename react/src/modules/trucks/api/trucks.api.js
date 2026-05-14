import { apiClient } from "@/shared/api/client";

export async function getTrucks(params = {}) {
  const response = await apiClient.get("/api/trucks", {
    params
  });

  return response.data;
}

export async function getTruckById(id) {
  const response = await apiClient.get(`/api/trucks/${id}`);
  return response.data;
}

export async function createTruck(payload) {
  const response = await apiClient.post("/api/trucks/create", payload);
  return response.data;
}

export async function updateTruck(id, payload) {
  const response = await apiClient.patch(`/api/trucks/${id}`, payload);
  return response.data;
}

export async function deleteTruck(id) {
  const response = await apiClient.delete(`/api/trucks/${id}`);
  return response.data;
}
