/**
 * A dependency-free log-log chart.
 *
 * Written by hand instead of pulling a charting library: the complexity lab plots
 * four series on a logarithmic axis, and that is not worth 90 kB of bundle.
 *
 * @module components/Chart
 */

export interface ChartPoint {
  x: number;
  y: number;
}

export interface ChartSeries {
  label: string;
  color: string;
  points: ChartPoint[];
  dashed?: boolean;
  dots?: boolean;
}

const W = 680;
const H = 280;
const PAD = { top: 14, right: 16, bottom: 34, left: 54 };

function niceTick(power: number): string {
  const value = 10 ** power;
  if (value >= 1_000_000) return `${value / 1_000_000}M`;
  if (value >= 1000) return `${value / 1000}k`;
  return String(value);
}

export function LogLogChart({
  series,
  xLabel,
  yLabel,
  emptyHint,
}: {
  series: ChartSeries[];
  xLabel: string;
  yLabel: string;
  emptyHint: string;
}) {
  const points = series.flatMap((s) => s.points).filter((p) => p.x > 0 && p.y > 0);

  if (points.length === 0) {
    return <div className="empty">{emptyHint}</div>;
  }

  const xs = points.map((p) => Math.log10(p.x));
  const ys = points.map((p) => Math.log10(p.y));
  const x0 = Math.floor(Math.min(...xs));
  const x1 = Math.ceil(Math.max(...xs));
  const y0 = Math.floor(Math.min(...ys));
  const y1 = Math.ceil(Math.max(...ys));

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const sx = (value: number): number =>
    PAD.left + ((Math.log10(value) - x0) / Math.max(1, x1 - x0)) * plotW;
  const sy = (value: number): number =>
    PAD.top + plotH - ((Math.log10(value) - y0) / Math.max(1, y1 - y0)) * plotH;

  const xTicks: number[] = [];
  for (let p = x0; p <= x1; p++) xTicks.push(p);
  const yTicks: number[] = [];
  for (let p = y0; p <= y1; p++) yTicks.push(p);

  return (
    <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${yLabel} versus ${xLabel}`}>
      <g className="chart-grid">
        {yTicks.map((p) => (
          <line key={`gy${p}`} x1={PAD.left} x2={W - PAD.right} y1={sy(10 ** p)} y2={sy(10 ** p)} />
        ))}
        {xTicks.map((p) => (
          <line
            key={`gx${p}`}
            x1={sx(10 ** p)}
            x2={sx(10 ** p)}
            y1={PAD.top}
            y2={H - PAD.bottom}
          />
        ))}
      </g>

      <g className="chart-axis">
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={H - PAD.bottom}
          y2={H - PAD.bottom}
        />
        <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={H - PAD.bottom} />
        {yTicks.map((p) => (
          <text key={`ty${p}`} x={PAD.left - 8} y={sy(10 ** p) + 3} textAnchor="end">
            {niceTick(p)}
          </text>
        ))}
        {xTicks.map((p) => (
          <text
            key={`tx${p}`}
            x={sx(10 ** p)}
            y={H - PAD.bottom + 15}
            textAnchor="middle"
          >
            {niceTick(p)}
          </text>
        ))}
        <text x={W - PAD.right} y={H - 4} textAnchor="end">
          {xLabel}
        </text>
        <text
          transform={`translate(14 ${PAD.top + plotH / 2}) rotate(-90)`}
          textAnchor="middle"
        >
          {yLabel}
        </text>
      </g>

      {series.map((s) => {
        const usable = s.points
          .filter((p) => p.x > 0 && p.y > 0)
          .sort((a, b) => a.x - b.x);
        if (usable.length === 0) return null;
        const path = usable.map((p) => `${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
        return (
          <g key={s.label}>
            <polyline
              className="chart-line"
              points={path}
              stroke={s.color}
              strokeDasharray={s.dashed ? '5 4' : undefined}
            />
            {s.dots &&
              usable.map((p) => (
                <circle
                  key={`${s.label}-${p.x}`}
                  className="chart-dot"
                  cx={sx(p.x)}
                  cy={sy(p.y)}
                  r={3.2}
                  fill={s.color}
                />
              ))}
          </g>
        );
      })}
    </svg>
  );
}

export function Legend({ series }: { series: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="legend">
      {series.map((s) => (
        <span key={s.label}>
          <i
            style={{
              background: s.dashed ? 'transparent' : s.color,
              borderTop: s.dashed ? `3px dashed ${s.color}` : undefined,
            }}
          />
          {s.label}
        </span>
      ))}
    </div>
  );
}
