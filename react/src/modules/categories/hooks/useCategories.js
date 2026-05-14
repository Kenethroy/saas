import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getCategories } from "@/modules/categories/api/categories.api";

export function useCategories(params = {}) {
  return useQuery({
    queryKey: ["categories", params],
    queryFn: () => getCategories(params),
    placeholderData: keepPreviousData
  });
}
