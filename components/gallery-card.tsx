"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Images, Plus, Trash2 } from "lucide-react";
import { userFacingError } from "@/lib/ui-language";
type Photo = { id: string; url: string };
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_PHOTOS = 10;
export function GalleryCard({ preview }: { preview: boolean }) {
  const [photos, setPhotos] = useState<Photo[] | null>(preview ? [] : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    fetch("/api/salon-gallery", { signal: controller.signal })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setPhotos(data);
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setPhotos([]);
        setError(userFacingError(e, "Зургийн цомгийг ачаалж чадсангүй."));
      });
    return () => controller.abort();
  }, [preview]);
  async function call(url: string, init: RequestInit, fallback: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(url, init);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error);
      setPhotos(data);
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
      await call(
        "/api/salon-gallery",
        { method: "POST", body },
        "Зургийг хадгалж чадсангүй. Дахин оролдоно уу.",
      );
    }
  }
  const move = (id: string, direction: "earlier" | "later") =>
    call(
      `/api/salon-gallery?id=${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      },
      "Дарааллыг өөрчилж чадсангүй.",
    );
  const count = photos?.length ?? 0;
  const locked = preview || busy || photos === null;
  return (
    <section className="panel settings-card" aria-labelledby="gallery-title">
      <div className="settings-card-heading">
        <span className="settings-icon">
          <Images size={17} />
        </span>
        <div>
          <h2 id="gallery-title">
            Зургийн цомог{" "}
            <span className="muted-text">
              {count} / {MAX_PHOTOS}
            </span>
          </h2>
          <p>
            Салоны орчин, ажлын байр, хийсэн ажлынхаа зургийг оруулаарай.
            Үйлчлүүлэгчид захиалгын хуудас болон нүүр хуудаснаас харна.
          </p>
        </div>
      </div>
      {error && (
        <p className="pf-error" role="alert">
          {error}
        </p>
      )}
      <div className="gallery-grid">
        {photos?.map((p, i) => (
          <div
            key={p.id}
            className={`gallery-tile ${i === 0 ? "is-first" : ""}`}
          >
            <Image
              src={p.url}
              alt={`Цомгийн зураг ${i + 1}`}
              fill
              unoptimized
              sizes="200px"
            />
            <div className="gallery-tools">
              <div>
                <button
                  type="button"
                  aria-label={`${i + 1}-р зургийг урагшлуулах`}
                  disabled={locked || i === 0}
                  onClick={() => move(p.id, "earlier")}
                >
                  <ChevronLeft size={15} />
                </button>
                <button
                  type="button"
                  aria-label={`${i + 1}-р зургийг хойшлуулах`}
                  disabled={locked || i === count - 1}
                  onClick={() => move(p.id, "later")}
                >
                  <ChevronRight size={15} />
                </button>
              </div>
              <button
                type="button"
                className="danger"
                aria-label={`${i + 1}-р зургийг устгах`}
                disabled={locked}
                onClick={() => {
                  if (window.confirm("Энэ зургийг устгах уу?"))
                    void call(
                      `/api/salon-gallery?id=${encodeURIComponent(p.id)}`,
                      { method: "DELETE" },
                      "Зургийг устгаж чадсангүй.",
                    );
                }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
        {count < MAX_PHOTOS && (
          <button
            type="button"
            className="gallery-add"
            disabled={locked}
            onClick={() => input.current?.click()}
          >
            <Plus size={20} />
            {busy ? "Хуулж байна…" : "Зураг нэмэх"}
          </button>
        )}
      </div>
      <p className="field-hint">
        Тод, гэрэлтэй, хэвтээ зураг хамгийн сайхан харагдана. Зураг бүр 4 МБ
        хүртэл. Эхний зураг цомгийг тэргүүлнэ.
      </p>
      <input
        ref={input}
        type="file"
        hidden
        multiple
        accept="image/jpeg,image/png,image/webp"
        aria-label="Цомгийн зургийн файл"
        onChange={(e) => e.target.files?.length && upload(e.target.files)}
      />
    </section>
  );
}
