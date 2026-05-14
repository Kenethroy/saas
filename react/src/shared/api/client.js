import axios from "axios";
import { useAuthStore } from "@/shared/store/auth.store";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "https://apinode.jrspctrading.com"
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth();
    }

    return Promise.reject(error);
  }
);
