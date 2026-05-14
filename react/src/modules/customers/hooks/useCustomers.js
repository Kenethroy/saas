import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getCustomers } from "@/modules/customers/api/customers.api";

export function useCustomers(params = {}) {
  return useQuery({
    queryKey: ["customers", params],
    queryFn: () => getCustomers(params),
    placeholderData: keepPreviousData
  });
}
