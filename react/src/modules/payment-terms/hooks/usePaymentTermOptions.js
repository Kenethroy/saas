import { useQuery } from "@tanstack/react-query";
import { getPaymentTerms } from "@/modules/payment-terms/api/payment-terms.api";

export function usePaymentTermOptions() {
  return useQuery({
    queryKey: ["payment-term-options"],
    queryFn: async () => {
      const response = await getPaymentTerms({ status: true });
      return response;
    }
  });
}
