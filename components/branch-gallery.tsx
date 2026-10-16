"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import {
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { userFacingError } from "@/lib/ui-language";
type Photo = { id: string; url: string };
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_PHOTOS = 10;
// A branch's photos on its card: the main photo on top, the rest below. Tap a
// photo to move it, make it the main one or delete it.
export function BranchGallery({
  branchId,
  branchName,
  initial,
  editable,
}: {
  branchId: string;
  branchName: string;
  initial: Photo[];
  editable: boolean;
}) {
  const [photos, setPhotos] = useState(initial);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  async function call(url: string, init: RequestInit, fallback: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(url, init);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error);
      setPhotos(data);
      return data as Photo[];
    } catch (e) {
      setError(userFacingError(e, fallback));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  async function upload(files: FileList) {
    // One request per photo keeps each upload under the size limit.
    for (const file of Array.from(files)) {
      if (file.size > MAX_IMAGE_BYTES) {
        setError(`«${file.name}»: зургийн хэмжээ 4 МБ-аас ихгүй байна.`);
        continue;
      }
      const body = new FormData();
      body.set("file", file);
      const list = await call(
        `/api/branch-gallery?branchId=${encodeURIComponent(branchId)}`,
        { method: "POST", body },
        "Зургийг хадгалж чадсангүй. Дахин оролдоно уу.",
      );
      if (!list) break;
    }
  }
  const move = (id: string, direction: "earlier" | "later" | "first") =>
    call(
      `/api/branch-gallery?id=${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      },
      direction === "first"
        ? "Үндсэн зургийг сонгож чадсангүй."
        : "Дарааллыг өөрчилж чадсангүй.",
    );
  const main = photos[0];
  const index = photos.findIndex((p) => p.id === selected);
  const current = index >= 0 ? photos[index] : null;
  const count = photos.length;
  if (!count && !editable) return null;
  return (
    <div
      className="bg"
      role="group"
      aria-label={`${branchName} салбарын зургууд`}
    >
      <div className="bg-main">
        {main ? (
          <>
            <Image
              src={main.url}
              alt={`${branchName} салбарын үндсэн зураг`}
              fill
              unoptimized
              sizes="(max-width: 960px) 100vw, 360px"
            />
            <span className="bg-badge">
              <Star size={11} /> Үндсэн зураг
            </span>
          </>
        ) : (
          <button
            type="button"
            className="bg-empty"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            <ImagePlus size={22} strokeWidth={1.5} />
            {busy ? "Хуулж байна…" : "Салбарын зураг нэмэх"}
          </button>
        )}
        {count > 0 && (
          <span className="bg-count">
            {count} / {MAX_PHOTOS}
          </span>
        )}
      </div>
      {(count > 1 || (editable && count > 0)) && (
        <div className="bg-thumbs">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className={`bg-thumb ${p.id === selected ? "is-selected" : ""}`}
              aria-pressed={editable ? p.id === selected : undefined}
              aria-label={`${i + 1}-р зураг${i === 0 ? " (үндсэн)" : ""}${editable ? ": сонгох" : ""}`}
              disabled={!editable}
              onClick={() => setSelected(p.id === selected ? null : p.id)}
            >
              <Image src={p.url} alt="" fill unoptimized sizes="56px" />
            </button>
          ))}
          {editable && count < MAX_PHOTOS && (
            <button
              type="button"
              className="bg-thumb bg-add"
              aria-label="Зураг нэмэх"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              <Plus size={18} />
            </button>
          )}
        </div>
      )}
      {editable && current && (
        <div className="bg-tools" role="group" aria-label="Сонгосон зураг">
          <div className="bg-tools-move">
            <button
              type="button"
              aria-label="Урагшлуулах"
              disabled={busy || index === 0}
              onClick={() => move(current.id, "earlier")}
            >
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              aria-label="Хойшлуулах"
              disabled={busy || index === count - 1}
              onClick={() => move(current.id, "later")}
            >
              <ChevronRight size={15} />
            </button>
          </div>
          <button
            type="button"
            disabled={busy || index === 0}
            onClick={() => move(current.id, "first")}
          >
            <Star size={13} />
            {index === 0 ? "Үндсэн зураг" : "Үндсэн болгох"}
          </button>
          <button
            type="button"
            className="danger"
            disabled={busy}
            onClick={async () => {
              if (!window.confirm("Энэ зургийг устгах уу?")) return;
              const list = await call(
                `/api/branch-gallery?id=${encodeURIComponent(current.id)}`,
                { method: "DELETE" },
                "Зургийг устгаж чадсангүй.",
              );
              if (list) setSelected(null);
            }}
          >
            <Trash2 size={13} /> Устгах
          </button>
        </div>
      )}
      {error && (
        <p className="pf-error" role="alert">
          {error}
        </p>
      )}
      {editable && (
        <input
          ref={input}
          type="file"
          hidden
          multiple
          accept="image/jpeg,image/png,image/webp"
          aria-label={`${branchName} салбарын зургийн файл`}
          onChange={(e) => e.target.files?.length && upload(e.target.files)}
        />
      )}
    </div>
  );
}
