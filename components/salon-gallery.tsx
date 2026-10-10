"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";
import { initials } from "@/lib/avatar";
// Salon photos: a swipeable strip on phones, a mosaic on wider screens, and a
// full-screen viewer on tap.
export function SalonGallery({
  name,
  photos,
}: {
  name: string;
  photos: string[];
}) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const count = photos.length;
  const step = useCallback(
    (by: number) => setOpen((i) => (i === null ? i : (i + by + count) % count)),
    [count],
  );
  useEffect(() => {
    if (open === null) return;
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
  }, [open, step]);
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
        className={`sg sg-${Math.min(count, 5)}`}
        role="group"
        aria-label={`${name} салоны зургийн цомог`}
      >
        <div
          className="sg-strip"
          ref={strip}
          onScroll={(e) => {
            const el = e.currentTarget;
            setIndex(Math.round(el.scrollLeft / el.clientWidth));
          }}
        >
          {photos.map((src, i) => (
            <button
              key={src}
              type="button"
              className="sg-item"
              aria-label={`${alt(i)}: томоор харах`}
              onClick={() => setOpen(i)}
            >
              <Image
                src={src}
                alt={alt(i)}
                fill
                unoptimized
                priority={i === 0}
                sizes="(max-width: 700px) 100vw, 720px"
              />
              {i === 4 && count > 5 && (
                <span className="sg-more" aria-hidden="true">
                  +{count - 5}
                </span>
              )}
            </button>
          ))}
        </div>
        {count > 1 && (
          <span className="sg-count" aria-hidden="true">
            <Images size={13} /> {index + 1} / {count}
          </span>
        )}
      </div>
      {open !== null && (
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
              unoptimized
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
      )}
    </>
  );
}
