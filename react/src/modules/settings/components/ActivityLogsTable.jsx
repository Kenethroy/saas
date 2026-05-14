import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getActivityLogs } from "../api/activity-logs.api";
import { Skeleton, TableSkeleton } from "@/shared/components/common/Skeleton";
import { Pagination } from "@/shared/components/common/Pagination";

export function ActivityLogsTable({ filters }) {
  const [page, setPage] = useState(1);

  // Reset to first page when top-level filters change
  useEffect(() => {
    setPage(1);
  }, [filters.search, filters.action, filters.date_from]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["activity-logs", { page, ...filters }],
    queryFn: () => getActivityLogs({
      page,
      ...filters,
      limit: 15
    }),
    placeholderData: (previousData) => previousData
  });

  const logs = data?.data ?? [];
  const meta = data?.meta;

  const getActionBadge = (action) => {
    const map = {
      'LOGIN': 'border-[#bbdefb] bg-[#e3f2fd] text-[#1565c0]',
      'CREATE': 'border-[#c8e6c9] bg-[#e8f5e9] text-[#2e7d32]',
      'UPDATE': 'border-[#ffecb3] bg-[#fff8e1] text-[#f57f17]',
      'DELETE': 'border-[#ffcdd2] bg-[#ffebee] text-[#c62828]',
      'APPROVE': 'border-[#b2dfdb] bg-[#e0f2f1] text-[#00695c]',
      'REJECT': 'border-[#ffe0b2] bg-[#fff3e0] text-[#ef6c00]'
    };
    return map[action] || 'border-[#e0e0e0] bg-[#f5f5f5] text-[#616161]';
  };

  const getModuleIcon = (module) => {
    const map = { 'sales_order': 'fa-shopping-cart', 'inventory': 'fa-boxes', 'payment': 'fa-money-bill-wave', 'product': 'fa-box', 'customer': 'fa-users', 'agent': 'fa-user-tie', 'settings': 'fa-cog', 'auth': 'fa-lock' };
    return 'fas ' + (map[module] || 'fa-folder');
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    const d = new Date(date);
    return d.toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' });
  };

  const formatTime = (date) => {
    if (!date) return "N/A";
    const d = new Date(date);
    return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* COMPACT ERP TABLE */}
      <div className="overflow-x-auto min-h-[400px]">
        <table className={`erp-table w-full ${isFetching ? "opacity-70" : ""}`}>
          <thead>
            <tr>
              <th className="w-[150px]">Date & Time</th>
              <th className="w-[180px]">Actor</th>
              <th className="w-[100px]">Event</th>
              <th className="w-[120px]">Module</th>
              <th>Task Summary</th>
              <th className="w-[110px]">Access IP</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <TableSkeleton rows={15}>
                {(i) => (
                  <tr key={`log-sk-${i}`}>
                    <td><Skeleton className="h-4 w-24" /><Skeleton className="h-2.5 w-16 mt-1" /></td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-6 w-6" />
                        <div><Skeleton className="h-3 w-20" /><Skeleton className="h-2 w-14 mt-1" /></div>
                      </div>
                    </td>
                    <td><Skeleton className="h-5 w-16" /></td>
                    <td><Skeleton className="h-4 w-20" /></td>
                    <td><Skeleton className="h-4 w-64" /><Skeleton className="h-2.5 w-32 mt-1" /></td>
                    <td><Skeleton className="h-3 w-20" /></td>
                  </tr>
                )}
              </TableSkeleton>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan="6" className="py-24 text-center">
                  <div className="flex flex-col items-center">
                    <i className="fas fa-history text-[#cfd8dc] text-[32px] mb-3" />
                    <div className="text-[13px] font-bold text-[#1a3557]">No historical logs matched</div>
                    <div className="text-[10px] text-[#90a4ae] mt-1">Adjust your filters to broaden the audit scope</div>
                  </div>
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td>
                    <div className="font-bold text-[#1a3557]">{formatDate(log.created)}</div>
                    <div className="text-[10px] text-[#90a4ae]">{formatTime(log.created)}</div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-[#e8f1f8] rounded-sm flex items-center justify-center text-[9px] font-black text-accent-500 border border-accent-100 uppercase">
                        {log.user_name?.[0] || 'U'}
                      </div>
                      <div>
                        <div className="font-bold text-[#212121] leading-none">{log.user_name}</div>
                        <div className="text-[9px] text-[#90a4ae] mt-0.5 uppercase tracking-tighter">{log.user_role}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`erp-chip whitespace-nowrap ${getActionBadge(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#546e7a]">
                      <i className={`${getModuleIcon(log.entity_type)} text-[11px] w-3.5 text-center`} />
                      {log.entity_type?.replace('_', ' ')}
                    </div>
                  </td>
                  <td>
                    <div className="text-[11px] text-[#1a3557] leading-relaxed max-w-[450px] line-clamp-1" title={log.description}>
                      {log.description}
                    </div>
                    {log.entity_name && (
                      <div className="text-[10px] text-muted mt-0.5">
                        <span className="font-mono text-[9px]">ID: {log.entity_id}</span> • {log.entity_name}
                      </div>
                    )}
                  </td>
                  <td className="font-mono text-[10px] text-[#90a4ae]">
                    {log.ip_address}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!isLoading && meta?.total > 15 && (
         <div className="px-6 py-4 bg-[#fbfdff] border-t border-[#eceff1]">
           <Pagination
             currentPage={page}
             lastPage={Math.ceil(meta.total / 15)}
             total={meta.total}
             perPage={15}
             onNext={() => setPage(p => p + 1)}
             onPrevious={() => setPage(p => p - 1)}
             onGoto={setPage}
             loading={isFetching}
           />
         </div>
      )}
    </div>
  );
}
