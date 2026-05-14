import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCurrentUser, getCurrentUserSessions, logoutOtherSessions } from "@/modules/auth/api/auth.api";
import { ConfirmationModal } from "@/shared/components/common/ConfirmationModal";
import { Skeleton } from "@/shared/components/common/Skeleton";
import { useNotification } from "@/shared/hooks/useNotification";
import { useAuthStore } from "@/shared/store/auth.store";

function formatRole(value) {
  if (!value) {
    return "N/A";
  }

  return String(value)
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatStatus(value) {
  return value ? "Active" : "Inactive";
}

function formatDateTime(value) {
  if (!value) {
    return "N/A";
  }

  return new Intl.DateTimeFormat("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatSessionTitle(session) {
  if (session?.deviceName) {
    return session.deviceName;
  }

  if (session?.platform) {
    return session.platform;
  }

  return "Browser Session";
}

function formatSessionMeta(session) {
  const pieces = [session?.platform, session?.ipAddress].filter(Boolean);
  return pieces.length ? pieces.join(" • ") : "Session metadata unavailable";
}

function InfoCard({ icon, label, value, helper = null }) {
  return (
    <div className="rounded-sm border border-[#d7e3ec] bg-white px-4 py-3 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.5px] text-[#607d8b]">
        <i className={`fas ${icon} text-[#90a4ae]`} aria-hidden="true" />
        <span>{label}</span>
      </div>
      <div className="mt-2 text-[13px] font-bold text-[#1a3557]">{value}</div>
      {helper ? <div className="mt-1 text-[10px] text-[#78909c]">{helper}</div> : null}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      <section className="erp-page-section erp-page-section-joined">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-64" />
            </div>
          </div>
        </div>
      </section>
      <section className="erp-page-main-card p-4">
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Skeleton className="h-[300px] w-full" />
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-24 w-full" />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export function ProfilePage() {
  const navigate = useNavigate();
  const notify = useNotification();
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);
  const [otherSessionsConfirmOpen, setOtherSessionsConfirmOpen] = useState(false);

  const profileQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getCurrentUser
  });
  const sessionsQuery = useQuery({
    queryKey: ["auth", "sessions"],
    queryFn: getCurrentUserSessions
  });
  const logoutOtherSessionsMutation = useMutation({
    mutationFn: logoutOtherSessions,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] });
      setOtherSessionsConfirmOpen(false);
      const revokedCount = response?.data?.revokedCount ?? 0;
      notify.success(revokedCount > 0 ? `${revokedCount} other session${revokedCount === 1 ? "" : "s"} signed out.` : "No other active sessions found.");
    },
    onError: (error) => {
      notify.error(error.response?.data?.message || "Failed to revoke other sessions.");
    }
  });

  const user = profileQuery.data?.data ?? null;
  const sessions = sessionsQuery.data?.data ?? [];
  const currentSession = sessions.find((session) => session.current) ?? null;
  const otherSessions = sessions.filter((session) => !session.current);
  const fullName = [user?.employee?.firstName, user?.employee?.lastName].filter(Boolean).join(" ").trim() || user?.username || "Administrator";
  const initials = fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "AD";

  useEffect(() => {
    if (user) {
      setUser(user);
    }
  }, [setUser, user]);

  if (profileQuery.isLoading) {
    return <ProfileSkeleton />;
  }

  if (profileQuery.isError) {
    return (
      <section className="table-card erp-page-main-card-joined">
        <div className="px-4 py-10 text-[11px] text-[#c62828]">
          Failed to load profile{profileQuery.error?.message ? `: ${profileQuery.error.message}` : "."}
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="erp-page-section erp-page-section-joined">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#1e4a7a] text-[15px] font-bold text-white">
              {initials}
            </div>
            <div>
              <div className="erp-page-title">My Profile</div>
              <div className="erp-page-description">Administrative identity, assigned employee record, and access summary for the current account.</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/admin/settings/security")}
              className="erp-header-secondary-button"
            >
              <i className="fas fa-key mr-1.5" />
              Security Settings
            </button>
            <button
              type="button"
              onClick={() => setOtherSessionsConfirmOpen(true)}
              className="erp-header-secondary-button"
              disabled={logoutOtherSessionsMutation.isPending || otherSessions.length === 0}
            >
              <i className={`fas ${logoutOtherSessionsMutation.isPending ? "fa-spinner fa-spin" : "fa-user-shield"} mr-1.5`} />
              Sign Out Other Sessions
            </button>
          </div>
        </div>
      </section>

      <section className="erp-page-main-card p-4">
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="overflow-hidden rounded-sm border border-[#d7e3ec] bg-[#f8fbfd]">
            <div className="border-b border-[#d7e3ec] bg-[linear-gradient(135deg,#1e4a7a_0%,#2c5f8a_55%,#4a90b8_100%)] px-5 py-6 text-white">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[22px] font-bold">
                {initials}
              </div>
              <div className="mt-4 text-[18px] font-bold">{fullName}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[0.4px] text-[#d4e7f6]">{formatRole(user?.role)}</div>
            </div>

            <div className="space-y-4 px-5 py-5">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#607d8b]">Username</div>
                <div className="mt-1 font-mono text-[13px] font-bold text-[#1a3557]">{user?.username ?? "N/A"}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.5px] text-[#607d8b]">Email</div>
                <div className="mt-1 break-all text-[12px] font-medium text-[#1a3557]">{user?.email ?? "N/A"}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-sm border border-[#d7e3ec] bg-white px-3 py-3">
                  <div className="text-[9px] font-bold uppercase tracking-[0.5px] text-[#607d8b]">Account</div>
                  <div className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-bold ${user?.status ? "bg-[#e8f5e9] text-[#2e7d32]" : "bg-[#fff5f5] text-[#c62828]"}`}>
                    {formatStatus(user?.status)}
                  </div>
                </div>
                <div className="rounded-sm border border-[#d7e3ec] bg-white px-3 py-3">
                  <div className="text-[9px] font-bold uppercase tracking-[0.5px] text-[#607d8b]">Permissions</div>
                  <div className="mt-2 text-[20px] font-bold text-[#0070b8]">{user?.permissions?.length ?? 0}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <InfoCard icon="fa-user-tie" label="Employee Name" value={fullName} helper="Linked employee identity for this login." />
              <InfoCard icon="fa-briefcase" label="Position" value={user?.employee?.position ?? "N/A"} helper="Operational role from the employee record." />
              <InfoCard icon="fa-envelope" label="Employee Email" value={user?.employee?.email ?? user?.email ?? "N/A"} helper="Contact detail used for internal coordination." />
              <InfoCard icon="fa-user-shield" label="Access Role" value={formatRole(user?.role)} helper="Current access tier enforced by permissions." />
              <InfoCard icon="fa-toggle-on" label="Employee Status" value={formatStatus(user?.employee?.status ?? user?.status)} helper="Employment record availability in the system." />
              <InfoCard icon="fa-id-badge" label="Employee ID" value={user?.employee?.id ?? user?.employeeId ?? "N/A"} helper="Primary employee linkage for this account." />
            </div>

            <div className="overflow-hidden rounded-sm border border-[#d7e3ec] bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
              <div className="border-b border-[#e8eef3] bg-[#fbfdff] px-4 py-3">
                <div className="text-[12px] font-bold text-[#1a3557]">Access Footprint</div>
                <div className="mt-1 text-[11px] text-[#607d8b]">Flattened permission list assigned to the current session.</div>
              </div>

              {user?.permissions?.length ? (
                <div className="flex flex-wrap gap-2 px-4 py-4">
                  {user.permissions.map((permission) => (
                    <span
                      key={permission}
                      className="inline-flex rounded-full border border-[#d7e3ec] bg-[#f8fbfd] px-2.5 py-1 text-[10px] font-bold text-[#48657d]"
                    >
                      {permission}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-5 text-[11px] text-[#78909c]">No explicit permission slugs were returned for this account.</div>
              )}
            </div>

            <div className="overflow-hidden rounded-sm border border-[#d7e3ec] bg-white shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
              <div className="border-b border-[#e8eef3] bg-[#fbfdff] px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[12px] font-bold text-[#1a3557]">Active Sessions</div>
                    <div className="mt-1 text-[11px] text-[#607d8b]">Current login plus any other active browser sessions for this account.</div>
                  </div>
                  <span className="rounded-full bg-[#e8f1f8] px-2 py-1 text-[10px] font-bold text-[#1e4a7a]">
                    {sessions.length} active
                  </span>
                </div>
              </div>

              {sessionsQuery.isLoading ? (
                <div className="space-y-3 px-4 py-4">
                  {Array.from({ length: 3 }, (_, index) => (
                    <Skeleton key={index} className="h-20 w-full" />
                  ))}
                </div>
              ) : sessionsQuery.isError ? (
                <div className="px-4 py-5 text-[11px] text-[#c62828]">Failed to load active sessions.</div>
              ) : sessions.length === 0 ? (
                <div className="px-4 py-5 text-[11px] text-[#78909c]">No active sessions were returned for this account.</div>
              ) : (
                <div className="space-y-3 px-4 py-4">
                  {currentSession ? (
                    <div className="rounded-sm border border-[#bbdefb] bg-[#f8fbff] px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-[12px] font-bold text-[#1a3557]">{formatSessionTitle(currentSession)}</div>
                            <span className="rounded-full bg-[#0070b8] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.4px] text-white">Current</span>
                          </div>
                          <div className="mt-1 text-[11px] text-[#607d8b]">{formatSessionMeta(currentSession)}</div>
                          <div className="mt-2 grid gap-1 text-[10px] text-[#78909c] md:grid-cols-2">
                            <div>Last seen: {formatDateTime(currentSession.lastSeenAt)}</div>
                            <div>Signed in: {formatDateTime(currentSession.createdAt)}</div>
                          </div>
                          {currentSession.userAgent ? (
                            <div className="mt-2 truncate text-[10px] text-[#90a4ae]" title={currentSession.userAgent}>
                              {currentSession.userAgent}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {otherSessions.map((session) => (
                    <div key={session.id} className="rounded-sm border border-[#d7e3ec] bg-white px-4 py-3">
                      <div className="text-[12px] font-bold text-[#1a3557]">{formatSessionTitle(session)}</div>
                      <div className="mt-1 text-[11px] text-[#607d8b]">{formatSessionMeta(session)}</div>
                      <div className="mt-2 grid gap-1 text-[10px] text-[#78909c] md:grid-cols-2">
                        <div>Last seen: {formatDateTime(session.lastSeenAt)}</div>
                        <div>Signed in: {formatDateTime(session.createdAt)}</div>
                      </div>
                      {session.userAgent ? (
                        <div className="mt-2 truncate text-[10px] text-[#90a4ae]" title={session.userAgent}>
                          {session.userAgent}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
      <ConfirmationModal
        show={otherSessionsConfirmOpen}
        title="Sign Out Other Sessions"
        message="This will revoke every other active session for your account and keep only this current session signed in."
        type="warning"
        showCancel
        confirmText="Sign Out Others"
        onConfirm={() => {
          void logoutOtherSessionsMutation.mutateAsync();
        }}
        onClose={() => setOtherSessionsConfirmOpen(false)}
      />
    </div>
  );
}
