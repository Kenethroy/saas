import { useQuery } from "@tanstack/react-query";
import { getUserEmployeeOptions } from "@/modules/users/api/users.api";

export function useUserEmployeeOptions(params = {}) {
  return useQuery({
    queryKey: ["user-employee-options", params],
    queryFn: () => getUserEmployeeOptions(params)
  });
}
