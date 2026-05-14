import { useQuery } from "@tanstack/react-query";
import { getPayslips } from "@/modules/payslips/api/payslips.api";

export function usePayslips(params = {}) {
  return useQuery({
    queryKey: ["payslips", params],
    queryFn: () => getPayslips(params)
  });
}

