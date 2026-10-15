"use client";
import { userFacingError } from "@/lib/ui-language";
import {
  localizeInvalidField,
  clearFieldValidity,
} from "@/lib/form-validation";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Hourglass } from "lucide-react";
import { Button } from "./ui/button";
import { slugify } from "@/lib/slug";
import { ApplicationFields } from "./application-fields";
import { DistrictSelect } from "./district-select";
import { hasSocial, socialRequired } from "@/lib/salon-application";
import { site } from "@/lib/site";
import { signOut } from "@/app/auth/actions";
export function Onboarding({
  preview,
  hasSalon,
}: {
  preview: boolean;
  hasSalon: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [manyBranches, setManyBranches] = useState(false);
  const [data, setData] = useState({
    name: "",
    phone: "",
    instagram: "",
    facebook: "",
    serviceTypes: [] as string[],
    staffCount: "",
    description: "",
    slug: "",
    // A one-location salon never sees the branch name.
    branch: { name: "Үндсэн салбар", district: "", address: "" },
  });
  const titles = [
    "Салоныхоо тухай танилцуулаарай.",
    "Салоныхоо хаяг, байршлыг оруулаарай.",
    "Салоноо баталгаажуулахад туслаарай.",
    "Таны хүсэлтийг хүлээн авлаа.",
  ];
  const descriptions = [
    "Үндсэн мэдээллээс эхэлье. Бусдыг нь дараа нэмж болно.",
    "Цахим хаягаа сонгоод салон хаана байрладгийг оруулаарай. Бусад салбараа дараа нэмж болно.",
    "Бид салон бүрийг шалгаж баталгаажуулдаг. Доорх мэдээлэл үүнд тусална.",
  ];
  const steps = titles.length - 1;
  async function next(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (step === 0) {
      setStep(1);
      return;
    }
    if (step === 1) {
      if (
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug) ||
        data.slug.length < 3
      ) {
        setError(
          "Доод тал нь 3 тэмдэгт оруулна уу. Латин жижиг үсэг, тоо, дан зураас ашиглаарай.",
        );
        return;
      }
      if (!preview) {
        setPending(true);
        try {
          const response = await fetch(
            `/api/onboarding?slug=${encodeURIComponent(data.slug)}`,
          );
          const body = await response.json();
          if (!response.ok) throw new Error(body.error);
          if (!body.available)
            throw new Error(
              "Энэ хаягийг ашиглах боломжгүй. Өөр хаяг сонгоно уу.",
            );
        } catch (e) {
          setError(
            userFacingError(e, "Хаягийг шалгаж чадсангүй. Дахин оролдоно уу."),
          );
          setPending(false);
          return;
        }
        setPending(false);
      }
      setStep(2);
      return;
    }
    if (!hasSocial(data)) {
      setError(socialRequired);
      return;
    }
    if (!data.serviceTypes.length) {
      setError("Үйлчилгээний төрлөөс дор хаяж нэгийг сонгоно уу.");
      return;
    }
    if (preview) {
      setError(
        "Салоноо үүсгэхийн тулд бүртгүүлж, системийн холболтыг тохируулна уу.",
      );
      return;
    }
    setPending(true);
    try {
      const result = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          staffCount: Number(data.staffCount),
          // The branch is reached on the salon's own number.
          branch: { ...data.branch, phone: data.phone },
        }),
      });
      const body = await result.json();
      if (!result.ok) throw new Error(body.error);
      setStep(steps);
      router.refresh();
    } catch (e) {
      setError(
        userFacingError(e, "Хүсэлт илгээж чадсангүй. Дахин оролдоно уу."),
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="onboarding-page">
      <header className="onboarding-header">
        <Link href="/" className="brand">
          <span className="brand-symbol">
            s<span>·</span>
          </span>
          <span>
            salon<span className="brand-number">77</span>
            <span className="brand-dot">.</span>
          </span>
        </Link>
        {/* Without a salon, "/" would only send the user back here. */}
        {preview || hasSalon ? (
          <Link href="/">Удирдлагын хэсэгт буцах ↗</Link>
        ) : (
          <form action={signOut}>
            <button type="submit" className="onboarding-sign-out">
              Гарах
            </button>
          </form>
        )}
      </header>
      <main className="onboarding-container">
        <div
          className="onboarding-steps"
          aria-label={`${steps} алхмын ${Math.min(step + 1, steps)} дахь алхам`}
        >
          {titles.slice(0, steps).map((t, i) => (
            <div
              className={`onboarding-step ${i <= step ? "done" : ""}`}
              key={t}
            />
          ))}
        </div>
        <section className="onboarding-card">
          {step < steps ? (
            <>
              <div className="eyebrow">
                ЭХЛЭХ ТОХИРГОО · {step + 1} / {steps}
              </div>
              <h1>{titles[step]}</h1>
              <p>{descriptions[step]}</p>
              {preview && (
                <div className="notice">
                  Та салон үүсгэх алхмуудтай танилцаж байна.{" "}
                  <Link href="/sign-up">Бүртгүүлэх</Link> холбоосоор бүртгүүлж,
                  салоноо хадгалаарай.
                </div>
              )}
              {error && (
                <div role="alert" className="error-message">
                  {error}
                </div>
              )}
              <form
                onInvalidCapture={localizeInvalidField}
                onInputCapture={clearFieldValidity}
                onSubmit={next}
              >
                {step === 0 && (
                  <>
                    <label className="field">
                      Салоны нэр
                      <input
                        required
                        maxLength={100}
                        value={data.name}
                        onChange={(e) =>
                          setData({
                            ...data,
                            name: e.target.value,
                            // Follows the name until the owner edits it.
                            slug: slugEdited
                              ? data.slug
                              : slugify(e.target.value),
                          })
                        }
                        placeholder="Салоныхоо нэрийг оруулна уу"
                      />
                    </label>
                    <label className="field">
                      Утасны дугаар
                      <input
                        type="tel"
                        required
                        maxLength={30}
                        value={data.phone}
                        onChange={(e) =>
                          setData({ ...data, phone: e.target.value })
                        }
                        placeholder="+976"
                      />
                    </label>
                    <label className="field">
                      Товч танилцуулга · заавал биш
                      <textarea
                        maxLength={1000}
                        value={data.description}
                        onChange={(e) =>
                          setData({ ...data, description: e.target.value })
                        }
                        placeholder="Салоныхоо онцлогийг товч бичээрэй"
                      />
                    </label>
                  </>
                )}
                {step === 1 && (
                  <>
                    <label className="field">
                      Салоны цахим хаяг
                      <input
                        required
                        minLength={3}
                        maxLength={63}
                        value={data.slug}
                        onChange={(e) => {
                          setSlugEdited(true);
                          setData({
                            ...data,
                            slug: e.target.value.toLowerCase(),
                          });
                        }}
                        placeholder="tanii-salon"
                      />
                      <small>
                        Латин жижиг үсэг, тоо, зураас ашиглана уу. Хаягийн
                        боломжийг үргэлжлүүлэх болон хадгалах үед шалгана.
                      </small>
                    </label>
                    <div className="url-preview">
                      {site.domain}/
                      <strong>{data.slug || "tanii-salon"}</strong>/book
                    </div>
                    <DistrictSelect
                      value={data.branch.district}
                      onChange={(e) =>
                        setData({
                          ...data,
                          branch: { ...data.branch, district: e.target.value },
                        })
                      }
                    />
                    <label className="field">
                      Байршлын хаяг
                      <textarea
                        required
                        maxLength={500}
                        value={data.branch.address}
                        onChange={(e) =>
                          setData({
                            ...data,
                            branch: { ...data.branch, address: e.target.value },
                          })
                        }
                        placeholder="Гудамж, байр, давхар"
                      />
                    </label>
                    {manyBranches ? (
                      <label className="field">
                        Салбарын нэр
                        <input
                          required
                          maxLength={100}
                          value={data.branch.name}
                          onChange={(e) =>
                            setData({
                              ...data,
                              branch: { ...data.branch, name: e.target.value },
                            })
                          }
                          placeholder="Жишээ: Зайсан салбар"
                        />
                        <small>
                          Бусад салбараа дараа «Салбарууд» хэсгээс нэмнэ.
                        </small>
                      </label>
                    ) : (
                      <button
                        type="button"
                        className="text-action quiet"
                        onClick={() => setManyBranches(true)}
                      >
                        Олон салбартай
                      </button>
                    )}
                  </>
                )}
                {step === 2 && (
                  <ApplicationFields
                    value={data}
                    onChange={(patch) => setData({ ...data, ...patch })}
                  />
                )}
                <div className="form-actions">
                  {step > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending}
                      onClick={() => {
                        setStep(step - 1);
                        setError("");
                      }}
                    >
                      <ArrowLeft size={14} /> Буцах
                    </Button>
                  )}
                  <Button disabled={pending}>
                    {pending
                      ? "Түр хүлээнэ үү…"
                      : step === steps - 1
                        ? "Хүсэлт илгээх"
                        : "Үргэлжлүүлэх"}
                    <ArrowRight size={14} />
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <div className="onboarding-success">
              <Hourglass size={52} strokeWidth={1.2} />
              <h1>{titles[steps]}</h1>
              <p>
                Бид мэдээллийг тань шалгаад салоныг баталгаажуулна. Энэ хооронд
                үйлчилгээ, ажилтан, зургаа бэлдээрэй. Баталгаажмагц салон тань
                нийтэд харагдаж, онлайн захиалга авч эхэлнэ.
              </p>
              <Button asChild>
                <Link href="/">
                  Удирдлагын хэсэгт орох <ArrowRight size={15} />
                </Link>
              </Button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
