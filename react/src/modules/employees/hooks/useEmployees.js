import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getEmployees } from "@/modules/employees/api/employees.api";

export function useEmployees(params = {}) {
  return useQuery({
    queryKey: ["employees", params],
    queryFn: () => getEmployees(params),
    placeholderData: keepPreviousData
  });
}
