import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getDashboardNotifications, getDashboardOverview, getDashboardReceivablesCalendar } from "../api/dashboard.api";

export function useDashboardOverview(params = {}) {
  return useQuery({
    queryKey: ["dashboard", "overview", params],
    queryFn: () => getDashboardOverview(params),
    placeholderData: keepPreviousData
  });
}

export function useDashboardReceivablesCalendar(params = {}) {
  return useQuery({
    queryKey: ["dashboard", "receivables-calendar", params],
    queryFn: () => getDashboardReceivablesCalendar(params),
    placeholderData: keepPreviousData
  });
}

export function useDashboardNotifications(options = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: ["dashboard", "notifications"],
    queryFn: getDashboardNotifications,
    enabled,
    refetchInterval: 60_000
  });
}
