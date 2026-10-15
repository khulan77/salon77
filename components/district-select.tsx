import { DISTRICTS, normalizeDistrict } from "@/lib/districts";
// `stored` is the branch's saved district; an unknown free-text one is named
// so the owner can pick its standard district.
export function DistrictSelect({
  stored = "",
  ...props
}: { stored?: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const known = stored ? normalizeDistrict(stored) : null;
  return (
    <label className="field">
      Дүүрэг
      <select
        required
        {...(props.value === undefined ? { defaultValue: known ?? "" } : {})}
        {...props}
      >
        <option value="">Дүүрэг сонгох</option>
        {DISTRICTS.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      {stored && !known && (
        <small>Өмнө нь «{stored}» гэж бичигдсэн байсан.</small>
      )}
    </label>
  );
}
