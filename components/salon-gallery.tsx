"use client";
import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";
import { initials } from "@/lib/avatar";
import { optimizable } from "@/lib/image";
// Salon photos: one large photo (the cover first), with the rest a tap away
// in a full-screen viewer.
export function SalonGallery({
  name,
  photos,
}: {
  name: string;
  photos: string[];
}) {
  const [open, setOpen] = useState<number | null>(null);
  const count = photos.length;
  if (!count)
    return (
      <div className="pb-cover">
        <span aria-hidden="true">{initials(name)}</span>
      </div>
    );
  const alt = (i: number) => `${name} салоны зураг ${i + 1}`;
  return (
    <>
      <div
        className="sg sg-1"
        role="group"
        aria-label={`${name} салоны зургийн цомог`}
      >
        <div className="sg-strip">
          <button
            type="button"
            className="sg-item"
            aria-label={`${alt(0)}: томоор харах`}
            onClick={() => setOpen(0)}
          >
            <Image
              src={photos[0]}
              alt={alt(0)}
              fill
              unoptimized={!optimizable(photos[0])}
              priority
              sizes="(max-width: 700px) 100vw, 720px"
            />
          </button>
        </div>
        {count > 1 && (
          <button type="button" className="sg-count" onClick={() => setOpen(0)}>
            <Images size={13} /> {count} зураг
          </button>
        )}
      </div>
      {open !== null && (
        <Viewer name={name} photos={photos} open={open} setOpen={setOpen} />
      )}
    </>
  );
}
function Viewer({
  name,
  photos,
  open,
  setOpen,
}: {
  name: string;
  photos: string[];
  open: number;
  setOpen: (
    value: number | null | ((i: number | null) => number | null),
  ) => void;
}) {
  const count = photos.length;
  const alt = (i: number) => `${name} салоны зураг ${i + 1}`;
  const step = useCallback(
    (by: number) => setOpen((i) => (i === null ? i : (i + by + count) % count)),
    [count, setOpen],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [step, setOpen]);
  return (
    <div
      className="sg-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={`${name} салоны зураг`}
      onClick={() => setOpen(null)}
    >
      <button
        type="button"
        className="sg-close"
        aria-label="Хаах"
        onClick={() => setOpen(null)}
      >
        <X size={22} />
      </button>
      <div className="sg-stage" onClick={(e) => e.stopPropagation()}>
        <Image
          src={photos[open]}
          alt={alt(open)}
          fill
          unoptimized={!optimizable(photos[open])}
          sizes="100vw"
        />
      </div>
      {count > 1 && (
        <>
          <button
            type="button"
            className="sg-nav prev"
            aria-label="Өмнөх зураг"
            onClick={(e) => {
              e.stopPropagation();
              step(-1);
            }}
          >
            <ChevronLeft size={26} />
          </button>
          <button
            type="button"
            className="sg-nav next"
            aria-label="Дараагийн зураг"
            onClick={(e) => {
              e.stopPropagation();
              step(1);
            }}
          >
            <ChevronRight size={26} />
          </button>
          <span className="sg-viewer-count">
            {open + 1} / {count}
          </span>
        </>
      )}
    </div>
  );
}
