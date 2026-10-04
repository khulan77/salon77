export default function Loading() {
  return (
    <div
      role="status"
      aria-label="Удирдлагын хэсгийг ачаалж байна"
      className="loading-state"
    >
      <div className="skeleton" style={{ height: 40, width: "45%" }} />
      <div className="skeleton" style={{ height: 220 }} />
      <div className="skeleton" />
      <span className="sr-only">Удирдлагын хэсгийг ачаалж байна…</span>
    </div>
  );
}
