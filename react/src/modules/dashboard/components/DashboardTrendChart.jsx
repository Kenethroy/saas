import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

function formatAxisValue(value) {
  const numeric = Number(value ?? 0);

  if (numeric >= 1000000) {
    return `₱${(numeric / 1000000).toFixed(1)}M`;
  }

  if (numeric >= 1000) {
    return `₱${(numeric / 1000).toFixed(0)}K`;
  }

  return `₱${numeric.toFixed(0)}`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP"
  }).format(Number(value ?? 0));
}

function DashboardTrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-sm border border-[#d7e3ec] bg-white px-3 py-2 shadow-[0_10px_30px_rgba(15,23,42,0.16)]">
      <div className="text-[11px] font-bold text-[#1a3557]">{label}</div>
      <div className="mt-2 space-y-1 text-[11px] text-[#607d8b]">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              {entry.name}
            </span>
            <span className="font-mono text-[#1a3557]">{formatCurrency(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardTrendChart({
  title,
  description,
  points = [],
  emptyMessage = "No trend data found for the selected year."
}) {
  return (
    <section className="table-card h-full overflow-hidden rounded-[22px] border-[#d7e3ec] shadow-[0_12px_36px_rgba(26,53,87,0.07)]">
      <div className="flex flex-col gap-3 border-b border-[#deebf2] bg-[linear-gradient(180deg,#fcfeff_0%,#f4f8fb_100%)] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#6c88a1]">Performance Trend</div>
          <div className="mt-1 text-[15px] font-bold tracking-[0.01em] text-[#17324d]">{title}</div>
          <div className="mt-1 text-[12px] text-[#5f7488]">{description}</div>
        </div>

        <div className="inline-flex items-center rounded-full border border-[#d7e4ec] bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#60798e]">
          Yearly View
        </div>
      </div>

      {points.length === 0 ? (
        <div className="erp-empty-state">{emptyMessage}</div>
      ) : (
        <div className="h-[300px] w-full px-3 py-4 sm:px-4 lg:h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 12, right: 12, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="dashboard-sales-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0070b8" stopOpacity={0.34} />
                  <stop offset="95%" stopColor="#0070b8" stopOpacity={0.03} />
                </linearGradient>
                <linearGradient id="dashboard-collections-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2e7d32" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#2e7d32" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#e3edf3" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#607d8b", fontSize: 10 }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#607d8b", fontSize: 10 }}
                tickFormatter={formatAxisValue}
                width={58}
              />
              <Tooltip content={<DashboardTrendTooltip />} />
              <Legend wrapperStyle={{ fontSize: "11px", color: "#607d8b" }} />
              <Area
                type="monotone"
                dataKey="sales"
                name="Sales"
                stroke="#0070b8"
                strokeWidth={3}
                fill="url(#dashboard-sales-fill)"
                activeDot={{ r: 5, strokeWidth: 0, fill: "#0070b8" }}
              />
              <Area
                type="monotone"
                dataKey="collections"
                name="Collections"
                stroke="#2e7d32"
                strokeWidth={3}
                fill="url(#dashboard-collections-fill)"
                activeDot={{ r: 5, strokeWidth: 0, fill: "#2e7d32" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}