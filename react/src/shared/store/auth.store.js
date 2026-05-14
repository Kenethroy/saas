import { create } from "zustand";

const initialUser = null;
const initialToken = typeof window !== "undefined" ? window.localStorage.getItem("jrspc_admin_token") : null;
const initialBranchId = typeof window !== "undefined" ? window.localStorage.getItem("jrspc_admin_branch_id") : null;

function syncUserBranch(user, preferredBranchId = null) {
  if (!user) {
    return null;
  }

  const branches = Array.isArray(user.branches) ? user.branches : [];
  if (branches.length === 0) {
    return {
      ...user,
      currentBranch: null,
      branches: []
    };
  }

  const requestedId = preferredBranchId ? Number(preferredBranchId) : null;
  const selectedBranch = branches.find((branch) => Number(branch.id) === requestedId)
    ?? branches.find((branch) => Number(branch.id) === Number(user.currentBranch?.id))
    ?? branches.find((branch) => branch.isPrimary)
    ?? branches[0];

  return {
    ...user,
    branches,
    currentBranch: selectedBranch
  };
}

export const useAuthStore = create((set, get) => ({
  token: initialToken,
  user: initialUser,
  currentBranchId: initialBranchId,
  setAuth(payload) {
    const nextToken = payload.token ?? get().token;
    const preferredBranchId = payload.currentBranchId ?? get().currentBranchId ?? initialBranchId;
    const nextUser = syncUserBranch(payload.user ?? null, preferredBranchId);

    if (nextToken) {
      window.localStorage.setItem("jrspc_admin_token", nextToken);
    }

    if (nextUser?.currentBranch?.id) {
      window.localStorage.setItem("jrspc_admin_branch_id", String(nextUser.currentBranch.id));
    } else {
      window.localStorage.removeItem("jrspc_admin_branch_id");
    }

    set({
      token: nextToken,
      user: nextUser,
      currentBranchId: nextUser?.currentBranch?.id ? String(nextUser.currentBranch.id) : null
    });
  },
  setUser(user) {
    const nextUser = syncUserBranch(user ?? null, get().currentBranchId ?? initialBranchId);
    if (nextUser?.currentBranch?.id) {
      window.localStorage.setItem("jrspc_admin_branch_id", String(nextUser.currentBranch.id));
    } else {
      window.localStorage.removeItem("jrspc_admin_branch_id");
    }

    set({
      user: nextUser,
      currentBranchId: nextUser?.currentBranch?.id ? String(nextUser.currentBranch.id) : null
    });
  },
  setCurrentBranch(branchId) {
    const nextUser = syncUserBranch(get().user, branchId);
    const nextBranchId = nextUser?.currentBranch?.id ? String(nextUser.currentBranch.id) : null;

    if (nextBranchId) {
      window.localStorage.setItem("jrspc_admin_branch_id", nextBranchId);
    } else {
      window.localStorage.removeItem("jrspc_admin_branch_id");
    }

    set({
      user: nextUser,
      currentBranchId: nextBranchId
    });
  },
  clearAuth() {
    window.localStorage.removeItem("jrspc_admin_token");
    window.localStorage.removeItem("jrspc_admin_branch_id");
    set({
      token: null,
      user: null,
      currentBranchId: null
    });
  }
}));
