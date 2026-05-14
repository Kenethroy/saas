import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getAccountsReceivables } from "../api/accounts-receivable.api";

export function useAccountsReceivables(params = {}) {
  return useQuery({
    queryKey: ["accounts-receivables", params],
    queryFn: () => getAccountsReceivables(params),
    placeholderData: keepPreviousData
  });
}
