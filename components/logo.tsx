import Link from "next/link";
// The Salon77 mark: one solid champagne "77" on an obsidian rounded square.
// Plain shapes with no shadow or gradient, so it stays crisp down to 16px.
// app/icon.svg holds the same drawing; the other icons are made from it.
export const MARK_PATHS = {
  tile: "#121316",
  ink: "#c5a880",
  sevens: "M13 16h17v6.5L22 48h-7l8-25H13zM34 16h17v6.5L43 48h-7l8-25H34z",
};
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      className="logo-mark"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      {/* A faint champagne edge keeps the tile visible on dark grounds. */}
      <rect
        x="1"
        y="1"
        width="62"
        height="62"
        rx="13"
        fill={MARK_PATHS.tile}
        stroke={MARK_PATHS.ink}
        strokeOpacity=".4"
        strokeWidth="2"
      />
      <path d={MARK_PATHS.sevens} fill={MARK_PATHS.ink} />
    </svg>
  );
}
// The one Salon77 logo: the mark and "Salon 77.mn", set in the site font so
// it stays sharp at every size. tone="light" is for dark backgrounds (white
// text); markOnly drops the words.
export function Logo({
  href = "/",
  size = "md",
  tone = "dark",
  markOnly = false,
  className = "",
}: {
  href?: string | null;
  size?: "sm" | "md" | "lg";
  tone?: "dark" | "light";
  markOnly?: boolean;
  className?: string;
}) {
  const px = { sm: 30, md: 36, lg: 52 }[size];
  const body = (
    <>
      <LogoMark size={px} />
      {!markOnly && (
        <span className="logo-word" aria-hidden="true">
          Salon <b>77.mn</b>
        </span>
      )}
    </>
  );
  const classes = `logo logo-${size} ${tone === "light" ? "logo-light" : ""} ${className}`;
  return href === null ? (
    <span className={classes} role="img" aria-label="Salon77">
      {body}
    </span>
  ) : (
    <Link href={href} className={classes} aria-label="Salon77 нүүр хуудас">
      {body}
    </Link>
  );
}
