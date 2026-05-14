import { useQuery } from "@tanstack/react-query";
import { getCategoryOptions } from "@/modules/categories/api/categories.api";

export function useCategoryOptions() {
  return useQuery({
    queryKey: ["category-options"],
    queryFn: getCategoryOptions
  });
}
