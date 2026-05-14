import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getUsers } from "@/modules/users/api/users.api";

export function useUsers(params = {}) {
  return useQuery({
    queryKey: ["users", params],
    queryFn: () => getUsers(params),
    placeholderData: keepPreviousData
  });
}
