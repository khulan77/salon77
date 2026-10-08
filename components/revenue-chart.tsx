"use client";
import { useState } from "react";
import {
  formatCompactMnt,
  formatDayLabel,
  formatMnt,
  formatMonthLabel,
} from "@/lib/ui-language";
type Bucket = { key: string; revenue: number; count: number };
// Rounds the axis top to 1/2/2.5/5 × 10ⁿ per tick so labels stay readable.
function niceMax(value: number, ticks: number) {
  if (value <= 0) return ticks;
  const raw = value / ticks,
    magnitude = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  return step * ticks;
}
export function RevenueChart({
  series,
  granularity,
  compact = false,
}: {
  series: Bucket[];
  granularity: "day" | "month";
  compact?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);
  const ticks = compact ? 2 : 4;
  const max = niceMax(Math.max(0, ...series.map((b) => b.revenue)), ticks);
  const average = series.length
    ? series.reduce((sum, b) => sum + b.revenue, 0) / series.length
    : 0;
  const label = (key: string) =>
    granularity === "day" ? formatDayLabel(key) : formatMonthLabel(key);
  const every = Math.max(1, Math.ceil(series.length / (compact ? 6 : 10)));
  const current = active === null ? null : series[active];
  return (
    <div className={`revenue-chart ${compact ? "is-compact" : ""}`}>
      <div className="chart-body">
        {!compact && (
          <div className="chart-axis" aria-hidden="true">
            {Array.from({ length: ticks + 1 }, (_, i) => (
              <span key={i} style={{ bottom: `${(i / ticks) * 100}%` }}>
                {formatCompactMnt((max / ticks) * i)}
              </span>
            ))}
          </div>
        )}
        <div
          className="chart-plot"
          role="img"
          aria-label={`Орлогын график: ${series.length} ${granularity === "day" ? "өдөр" : "сар"}, хамгийн их ${formatMnt(Math.max(0, ...series.map((b) => b.revenue)))}`}
          onMouseLeave={() => setActive(null)}
        >
          {Array.from({ length: ticks + 1 }, (_, i) => (
            <i
              key={i}
              className="chart-grid"
              style={{ bottom: `${(i / ticks) * 100}%` }}
            />
          ))}
          {average > 0 && (
            <i
              className="chart-average"
              style={{ bottom: `${(average / max) * 100}%` }}
            />
          )}
          {series.map((b, i) => (
            <div
              key={b.key}
              className={`chart-column ${active === i ? "is-active" : ""}`}
              tabIndex={compact ? -1 : 0}
              aria-label={`${label(b.key)}: ${formatMnt(b.revenue)}, ${b.count} захиалга`}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
            >
              {b.revenue > 0 && (
                <span
                  className="chart-bar"
                  style={{ height: `${(b.revenue / max) * 100}%` }}
                />
              )}
            </div>
          ))}
          {current && (
            <div
              className="chart-tooltip"
              style={{
                left: `${((active! + 0.5) / series.length) * 100}%`,
              }}
            >
              <strong>{label(current.key)}</strong>
              <span>{formatMnt(current.revenue)}</span>
              <small>{current.count} захиалга</small>
            </div>
          )}
        </div>
      </div>
      <div className="chart-labels" aria-hidden="true">
        {series.map((b, i) => (
          <span key={b.key}>
            {i % every === 0
              ? granularity === "day"
                ? Number(b.key.slice(8))
                : `${Number(b.key.slice(5))}-р сар`
              : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
export function averageLabel(series: Bucket[]) {
  return series.length
    ? formatMnt(
        Math.round(
          series.reduce((sum, b) => sum + b.revenue, 0) / series.length,
        ),
      )
    : formatMnt(0);
}
