// Daily counts as thin bars; each bar carries its own label for hover and screen readers.
export function CountChart({
  data,
  label,
  endLabel = "Өнөөдөр",
}: {
  data: { day: string; count: number }[];
  label: string;
  endLabel?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((sum, d) => sum + d.count, 0);
  return (
    <figure className="pf-chart">
      <figcaption>
        {label}
        <b>{total}</b>
      </figcaption>
      <div
        className="pf-bars"
        role="img"
        aria-label={`${label}: нийт ${total}`}
      >
        {data.map((d) => {
          const tip = `${Number(d.day.slice(5, 7))}/${Number(d.day.slice(8))}: ${d.count}`;
          return (
            <span key={d.day} title={tip} aria-label={tip}>
              <i style={{ height: `${(d.count / max) * 100}%` }} />
            </span>
          );
        })}
      </div>
      <div className="pf-axis" aria-hidden="true">
        <span>{`${Number(data[0].day.slice(5, 7))}/${Number(data[0].day.slice(8))}`}</span>
        <span>{endLabel}</span>
      </div>
    </figure>
  );
}
