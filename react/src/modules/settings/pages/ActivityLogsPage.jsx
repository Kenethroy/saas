import { useState, useDeferredValue } from "react";
import { ActivityLogsTable } from "../components/ActivityLogsTable";

export function ActivityLogsPage() {
  const [filters, setFilters] = useState({
    search: "",
    action: "",
    date_from: ""
  });
  const deferredSearch = useDeferredValue(filters.search.trim());

  return (
    <div className="space-y-0">
      {/* HEADER SECTION */}
      <section className="erp-page-section">
        <div className="erp-page-header">
          <div className="flex items-center gap-3">
            <i className="fas fa-history text-[18px] text-accent-500" />
            <div>
              <div className="erp-page-title">Activity Logs</div>
              <div className="erp-page-description">Complete audit trail of system transactions and administrative actions</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
             <button 
               className="erp-button-secondary !h-8 flex items-center gap-1.5"
               onClick={() => window.print()}
             >
               <i className="fas fa-print" /> Export Audit
             </button>
          </div>
        </div>

        {/* INTEGRATED FILTERS */}
        <div className="erp-page-filters">
          <div className="erp-filter-label">
            <i className="fas fa-search mr-1.5" />
            Search & Filter
          </div>
          
          <div className="relative flex-1 max-w-[320px]">
            <i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-[#90a4ae] text-[10px]" />
            <input
              type="text"
              placeholder="Search descriptions, modules, or users..."
              className="erp-input pl-8 !h-8 text-[11px]"
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
          </div>

          <select 
            className="erp-select !h-8 w-[140px] text-[11px]"
            value={filters.action}
            onChange={(e) => setFilters(prev => ({ ...prev, action: e.target.value }))}
          >
            <option value="">All Actions</option>
            {['LOGIN', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT'].map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          <input
            type="date"
            className="erp-input !h-8 w-[140px] text-[11px]"
            value={filters.date_from}
            onChange={(e) => setFilters(prev => ({ ...prev, date_from: e.target.value }))}
          />

          <button
            onClick={() => setFilters({ search: "", action: "", date_from: "" })}
            className="erp-filter-clear-button !h-8"
          >
            Reset Filters
          </button>
        </div>
      </section>

      {/* TABLE SECTION - JOINED */}
      <section className="erp-page-main-card overflow-hidden">
        <ActivityLogsTable filters={{ ...filters, search: deferredSearch }} />
      </section>
    </div>
  );
}
