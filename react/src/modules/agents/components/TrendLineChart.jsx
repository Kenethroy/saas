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

function buildPolyline(points, key, maxValue, width, height, padding) {
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  if (points.length === 0) {
    return "";
  }

  return points.map((point, index) => {
    const x = points.length === 1
      ? padding.left + plotWidth / 2
      : padding.left + (index * plotWidth) / (points.length - 1);
    const value = Number(point[key] ?? 0);
    const y = padding.top + plotHeight - (value / maxValue) * plotHeight;

    return `${x},${y}`;
  }).join(" ");
}

export function TrendLineChart({
  title,
  description,
  points = [],
  series = [],
  emptyMessage = "No trend data found for the selected filters."
}) {
  const width = 720;
  const height = 280;
  const padding = { top: 20, right: 20, bottom: 40, left: 56 };
  const values = points.flatMap((point) => series.map((item) => Number(point[item.key] ?? 0)));
  const maxValue = Math.max(...values, 1);
  const tickCount = 4;
  const xLabelStep = points.length > 18 ? 3 : points.length > 10 ? 2 : 1;

  return (
    <section className="table-card erp-page-main-card-joined overflow-hidden">
      <div className="border-b border-[#d7e3ec] bg-[#fbfdff] px-4 py-3">
        <div className="text-[12px] font-bold text-[#1a3557]">{title}</div>
        <div className="mt-1 text-[11px] text-[#607d8b]">{description}</div>
      </div>

      {points.length === 0 ? (
        <div className="erp-empty-state">{emptyMessage}</div>
      ) : (
        <div className="px-3 py-4">
          <div className="mb-3 flex flex-wrap items-center gap-4 px-1">
            {series.map((item) => (
              <div key={item.key} className="flex items-center gap-2 text-[11px] text-[#607d8b]">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                {item.label}
              </div>
            ))}
          </div>

          <svg viewBox={`0 0 ${width} ${height}`} className="h-[280px] w-full">
            {Array.from({ length: tickCount + 1 }, (_, index) => {
              const plotHeight = height - padding.top - padding.bottom;
              const y = padding.top + (plotHeight / tickCount) * index;
              const value = maxValue - (maxValue / tickCount) * index;
              return (
                <g key={`grid-${index}`}>
                  <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e3edf3" strokeWidth="1" />
                  <text x={padding.left - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#78909c">
                    {formatAxisValue(value)}
                  </text>
                </g>
              );
            })}

            <line
              x1={padding.left}
              y1={height - padding.bottom}
              x2={width - padding.right}
              y2={height - padding.bottom}
              stroke="#90a4ae"
              strokeWidth="1"
            />

            {series.map((item) => (
              <polyline
                key={item.key}
                fill="none"
                stroke={item.color}
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={buildPolyline(points, item.key, maxValue, width, height, padding)}
              />
            ))}

            {points.map((point, index) => {
              if (index % xLabelStep !== 0 && index !== points.length - 1) {
                return null;
              }

              const plotWidth = width - padding.left - padding.right;
              const x = points.length === 1
                ? padding.left + plotWidth / 2
                : padding.left + (index * plotWidth) / (points.length - 1);

              return (
                <text
                  key={`label-${point.label}-${index}`}
                  x={x}
                  y={height - padding.bottom + 18}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#607d8b"
                >
                  {point.label}
                </text>
              );
            })}
          </svg>
        </div>
      )}
    </section>
  );
}
