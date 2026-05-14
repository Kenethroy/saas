import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCurrentUser } from "@/modules/auth/api/auth.api";
import { useAuthStore } from "@/shared/store/auth.store";

export function useAuthUser() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getCurrentUser,
    enabled: Boolean(token) && !user,
    retry: 1
  });

  useEffect(() => {
    if (meQuery.data?.data) {
      setUser(meQuery.data.data);
    }
  }, [meQuery.data, setUser]);

  return {
    token,
    user: user ?? meQuery.data?.data ?? null,
    isLoadingUser: Boolean(token) && !user && meQuery.isLoading,
    isUserError: meQuery.isError
  };
}
