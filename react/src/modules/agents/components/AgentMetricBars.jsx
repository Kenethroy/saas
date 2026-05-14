function formatCurrencyShort(value) {
  const numeric = Number(value ?? 0);

  if (numeric >= 1000000) {
    return `₱${(numeric / 1000000).toFixed(1)}M`;
  }

  if (numeric >= 1000) {
    return `₱${(numeric / 1000).toFixed(0)}K`;
  }

  return `₱${numeric.toFixed(0)}`;
}

export function AgentMetricBars({
  title,
  description,
  rows = [],
  series = [],
  valueFormatter = formatCurrencyShort,
  metaRenderer = null,
  emptyMessage = "No agent performance rows found for the selected filters."
}) {
  const normalizedRows = rows.slice(0, 8);
  const maxValue = Math.max(
    1,
    ...normalizedRows.flatMap((row) => series.map((item) => Number(row[item.key] ?? 0)))
  );

  return (
    <section className="table-card erp-page-main-card-joined overflow-hidden">
      <div className="border-b border-[#d7e3ec] bg-[#fbfdff] px-4 py-3">
        <div className="text-[12px] font-bold text-[#1a3557]">{title}</div>
        <div className="mt-1 text-[11px] text-[#607d8b]">{description}</div>
      </div>

      {normalizedRows.length === 0 ? (
        <div className="erp-empty-state">{emptyMessage}</div>
      ) : (
        <div className="space-y-4 px-4 py-4">
          <div className="flex flex-wrap items-center gap-4">
            {series.map((item) => (
              <div key={item.key} className="flex items-center gap-2 text-[11px] text-[#607d8b]">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                {item.label}
              </div>
            ))}
          </div>

          {normalizedRows.map((row) => (
            <div key={row.agentId} className="space-y-2 rounded-sm border border-[#d7e3ec] bg-white px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[12px] font-bold text-[#1a3557]">{row.agentName}</div>
                  <div className="text-[10px] text-[#607d8b]">{row.agentCode}</div>
                </div>
                {metaRenderer ? (
                  <div className="text-right text-[10px] text-[#607d8b]">
                    {metaRenderer(row)}
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                {series.map((item) => {
                  const value = Number(row[item.key] ?? 0);
                  const width = `${Math.max(6, (value / maxValue) * 100)}%`;

                  return (
                    <div key={`${row.agentId}-${item.key}`}>
                      <div className="mb-1 flex items-center justify-between text-[10px] text-[#607d8b]">
                        <span>{item.label}</span>
                        <span className="font-mono text-[#1a3557]">{valueFormatter(value)}</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-[#e8eef2]">
                        <div className="h-2.5 rounded-full" style={{ width, backgroundColor: item.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
