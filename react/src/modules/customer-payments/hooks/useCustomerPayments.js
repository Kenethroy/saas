import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getCustomerPayments } from "../api/customer-payments.api";

export function useCustomerPayments(params = {}) {
  return useQuery({
    queryKey: ["customer-payments-list", params],
    queryFn: () => getCustomerPayments(params),
    placeholderData: keepPreviousData
  });
}
