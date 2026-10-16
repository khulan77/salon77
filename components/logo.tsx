import Link from "next/link";
import Image from "next/image";
// The earlier vector mark, kept for generated icons and images.
export const MARK_PATHS = {
  tile: "#b12d62",
  letter:
    "M31.5 16.2c-1.8-1.9-4.5-3-7.4-3-4.4 0-7.6 2.5-7.6 6 0 7.9 15.6 4.7 15.6 12 0 3.6-3.4 6.1-7.9 6.1-3.3 0-6.1-1.2-8-3.3",
  sparkle:
    "M37.5 6.8l1.35 3.1 3.1 1.35-3.1 1.35-1.35 3.1-1.35-3.1-3.1-1.35 3.1-1.35z",
  sparkleFill: "#f4dcae",
};
// The current brand mark: champagne "77" on an obsidian tile.
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
// Mark plus "salon77" wordmark; every screen uses this one component.
export function Logo({
  href = "/",
  size = "md",
  tone = "dark",
  className = "",
}: {
  href?: string;
  size?: "sm" | "md" | "lg";
  tone?: "dark" | "light";
  className?: string;
}) {
  const px = { sm: 26, md: 32, lg: 40 }[size];
  return (
    <Link
      href={href}
      className={`logo logo-${size} ${tone === "light" ? "logo-light" : ""} ${className}`}
      aria-label="Salon77 нүүр хуудас"
    >
      <LogoMark size={px} />
      <span className="logo-word" aria-hidden="true">
        salon<b>77.mn</b>
      </span>
    </Link>
  );
}
