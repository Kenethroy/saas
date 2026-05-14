import { useAuthStore } from "@/shared/store/auth.store";

export function useWorkspaceContext() {
  const user = useAuthStore((state) => state.user);
  const setCurrentBranch = useAuthStore((state) => state.setCurrentBranch);

  const tenant = user?.tenant ?? null;
  const subscription = user?.subscription ?? null;
  const currentBranch = user?.currentBranch ?? null;
  const branches = Array.isArray(user?.branches) ? user.branches : [];
  const subscriptionAccess = user?.subscriptionAccess ?? {
    status: null,
    isActive: true
  };

  return {
    tenant,
    subscription,
    currentBranch,
    branches,
    subscriptionAccess,
    isSubscriptionActive: Boolean(subscriptionAccess?.isActive),
    setCurrentBranch
  };
}
