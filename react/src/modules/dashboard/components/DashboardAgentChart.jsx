import {
  Bar,
  BarChart,
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

function DashboardAgentTooltip({ active, payload, label }) {
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

export function DashboardAgentChart({
  title,
  description,
  rows = [],
  emptyMessage = "No agent ranking found for this month."
}) {
  const chartRows = rows.slice(0, 5).map((row) => ({
    ...row,
    label: row.agentName
  }));

  return (
    <section className="table-card h-full overflow-hidden rounded-[22px] border-[#d7e3ec] shadow-[0_12px_36px_rgba(26,53,87,0.07)]">
      <div className="flex flex-col gap-3 border-b border-[#deebf2] bg-[linear-gradient(180deg,#fcfeff_0%,#f4f8fb_100%)] px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#6c88a1]">Field Team</div>
          <div className="mt-1 text-[15px] font-bold tracking-[0.01em] text-[#17324d]">{title}</div>
          <div className="mt-1 text-[12px] text-[#5f7488]">{description}</div>
        </div>

        <div className="inline-flex items-center rounded-full border border-[#d7e4ec] bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#60798e]">
          Top 5 Agents
        </div>
      </div>

      {chartRows.length === 0 ? (
        <div className="erp-empty-state">{emptyMessage}</div>
      ) : (
        <div className="h-[300px] w-full px-3 py-4 sm:px-4 lg:h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="#e3edf3" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#607d8b", fontSize: 10 }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: "#607d8b", fontSize: 10 }}
                tickFormatter={formatAxisValue}
                width={54}
              />
              <Tooltip content={<DashboardAgentTooltip />} cursor={false} />
              <Legend wrapperStyle={{ fontSize: "11px", color: "#607d8b" }} />
              <Bar dataKey="totalSales" name="Sales Base" fill="#1565c0" radius={[6, 6, 0, 0]} maxBarSize={32} />
              <Bar dataKey="totalCollected" name="Collected" fill="#2e7d32" radius={[6, 6, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}