"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { Feedback } from "./ui/feature-dialog";
import { requestJson } from "@/lib/client-request";
import { templatesFor } from "@/lib/service-templates";
import { SERVICE_TYPES, type ServiceType } from "@/lib/salon-application";
import { formatDuration, userFacingError } from "@/lib/ui-language";
import {
  localizeInvalidField,
  clearFieldValidity,
} from "@/lib/form-validation";
// Shown while the catalog is empty: pick common services for the salon's
// service types, type their prices and save them in one go.
export function ServiceTemplates({
  serviceTypes,
  disabled,
}: {
  serviceTypes: string[];
  disabled: boolean;
}) {
  const router = useRouter();
  const templates = templatesFor(serviceTypes);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const count = Object.keys(picked).length;
  if (!templates.length) return null;
  const groups = (Object.keys(SERVICE_TYPES) as ServiceType[])
    .map((type) => ({
      type,
      items: templates.filter((t) => t.type === type),
    }))
    .filter((g) => g.items.length);
  function toggle(id: string, on: boolean) {
    setPicked((current) => {
      const next = { ...current };
      if (on) next[id] = "";
      else delete next[id];
      return next;
    });
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      await requestJson("/api/services/templates", "POST", {
        items: Object.entries(picked).map(([id, price]) => ({
          id,
          priceMnt: Number(price),
        })),
      });
      setPicked({});
      router.refresh();
    } catch (e) {
      setError(
        userFacingError(e, "Үйлчилгээг хадгалж чадсангүй. Дахин оролдоно уу."),
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section
      className="panel service-templates"
      aria-labelledby="service-templates-title"
    >
      <h2 id="service-templates-title">
        <Sparkles size={16} aria-hidden="true" />
        Бэлэн үйлчилгээнээс эхлэх
      </h2>
      <p>
        Таны сонгосон төрлийн түгээмэл үйлчилгээнүүд. Хэрэгтэйгээ сонгоод үнээ
        бичнэ үү. Ангилал автоматаар үүсч, үндсэн салбарт холбогдоно.
      </p>
      <Feedback error={error} />
      <form
        onSubmit={submit}
        onInvalidCapture={localizeInvalidField}
        onInputCapture={clearFieldValidity}
      >
        {groups.map((g) => (
          <fieldset key={g.type}>
            <legend>{SERVICE_TYPES[g.type]}</legend>
            {g.items.map((t) => {
              const on = t.id in picked;
              return (
                <div className="template-row" key={t.id}>
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => toggle(t.id, e.target.checked)}
                    />
                    {t.name}
                    <small>{formatDuration(t.durationMinutes)}</small>
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={1000000000}
                    step={1}
                    required={on}
                    disabled={!on}
                    aria-label={`${t.name} үнэ, төгрөг`}
                    placeholder="Үнэ · ₮"
                    value={picked[t.id] ?? ""}
                    onChange={(e) =>
                      setPicked({ ...picked, [t.id]: e.target.value })
                    }
                  />
                </div>
              );
            })}
          </fieldset>
        ))}
        <div className="form-actions">
          <Button disabled={pending || disabled || !count}>
            {pending
              ? "Хадгалж байна…"
              : count
                ? `Сонгосон ${count} үйлчилгээг хадгалах`
                : "Үйлчилгээ сонгоно уу"}
          </Button>
        </div>
      </form>
    </section>
  );
}
