import Link from "next/link";
import Image from "next/image";
// The Salon77 mark: the gold "77" on its obsidian tile (public/salon77-mark.png;
// app/icon.svg, apple-icon and the share image are made from it).
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <Image
      className="logo-mark"
      src="/salon77-mark.png"
      alt=""
      width={size}
      height={size}
      aria-hidden="true"
    />
  );
}
// The one Salon77 logo: the mark, "SALON 77.MN" and the line beneath it, set
// in the site font so it stays sharp at every size. tone="light" is for dark
// backgrounds (white text); markOnly drops the words; tagline={false} drops
// the small line.
export function Logo({
  href = "/",
  size = "md",
  tone = "dark",
  markOnly = false,
  tagline = true,
  className = "",
}: {
  href?: string | null;
  size?: "sm" | "md" | "lg";
  tone?: "dark" | "light";
  markOnly?: boolean;
  tagline?: boolean;
  className?: string;
}) {
  const px = { sm: 30, md: 36, lg: 52 }[size];
  const body = (
    <>
      <LogoMark size={px} />
      {!markOnly && (
        <span className="logo-text" aria-hidden="true">
          <span className="logo-word">
            Salon <b>77.mn</b>
          </span>
          {tagline && (
            <small className="logo-tagline">
              Premium beauty &amp; wellness <i />
            </small>
          )}
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
