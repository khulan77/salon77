"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Trash2 } from "lucide-react";
import { userFacingError } from "@/lib/ui-language";
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
// Photo of one service or staff member. It is stored as soon as it is picked,
// so it needs a saved record to attach to.
export function PhotoField({
  target,
  id,
  url,
  round = false,
  onChange,
}: {
  target: "service" | "staff" | "product" | "branch" | "logo";
  id: string | null;
  url: string | null;
  round?: boolean;
  onChange: (url: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endpoint = `/api/photo?target=${target}&id=${encodeURIComponent(id ?? "")}`;
  async function call(init: RequestInit) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(endpoint, init);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error);
      onChange(data.imageUrl);
    } catch (e) {
      setError(
        userFacingError(e, "Зургийг хадгалж чадсангүй. Дахин оролдоно уу."),
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  function pick(file?: File) {
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES)
      return setError("Зургийн хэмжээ 4 МБ-аас ихгүй байна.");
    const body = new FormData();
    body.set("file", file);
    call({ method: "POST", body });
  }
  return (
    <div className="photo-field">
      <span className={`photo-field-frame ${round ? "round" : ""}`}>
        {url ? (
          <Image src={url} alt="" fill unoptimized sizes="96px" />
        ) : (
          <ImagePlus size={22} aria-hidden="true" />
        )}
      </span>
      <div>
        <strong>{target === "logo" ? "Салоны лого" : "Зураг"}</strong>
        {id ? (
          <>
            <p>
              {target === "product"
                ? "Жагсаалтад барааг хурдан таньна. 4 МБ хүртэл."
                : target === "logo"
                  ? "Удирдлагын хэсгийн цэс болон захиалгын хуудсанд харагдана. Дөрвөлжин зураг сайхан харагдана. 4 МБ хүртэл."
                  : target === "branch"
                    ? "Энэ салбарыг сонгоход захиалгын хуудасны дээд хэсэгт харагдана. Хэвтээ зураг сайхан харагдана. 4 МБ хүртэл."
                    : "Захиалгын хуудсанд харагдана. 4 МБ хүртэл."}
            </p>
            <div className="photo-field-actions">
              <input
                ref={input}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(e) => pick(e.target.files?.[0])}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => input.current?.click()}
              >
                {busy
                  ? "Хадгалж байна…"
                  : target === "logo"
                    ? url
                      ? "Лого солих"
                      : "Лого оруулах"
                    : url
                      ? "Зураг солих"
                      : "Зураг сонгох"}
              </button>
              {url && (
                <button
                  type="button"
                  className="danger"
                  disabled={busy}
                  onClick={() => call({ method: "DELETE" })}
                >
                  <Trash2 size={13} /> Зураг устгах
                </button>
              )}
            </div>
          </>
        ) : (
          <p>Эхлээд хадгалаад, дараа нь засах дээр дарж зураг нэмнэ.</p>
        )}
        {error && (
          <p className="photo-field-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
