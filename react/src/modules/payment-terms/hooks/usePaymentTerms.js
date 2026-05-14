import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getPaymentTerms } from "@/modules/payment-terms/api/payment-terms.api";

export function usePaymentTerms(params = {}) {
  return useQuery({
    queryKey: ["payment-terms", params],
    queryFn: () => getPaymentTerms(params),
    placeholderData: keepPreviousData
  });
}
