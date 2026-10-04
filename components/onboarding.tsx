"use client";
import { userFacingError } from "@/lib/ui-language";
import {
  localizeInvalidField,
  clearFieldValidity,
} from "@/lib/form-validation";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, ImagePlus } from "lucide-react";
import { Button } from "./ui/button";
export function Onboarding({ preview }: { preview: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState({
    name: "",
    phone: "",
    instagram: "",
    description: "",
    slug: "",
    branch: { name: "", district: "", address: "", phone: "" },
  });
  const titles = [
    "Салоныхоо тухай танилцуулаарай.",
    "Салоныхоо цахим хаягийг сонгоорой.",
    "Эхний салбараа бүртгээрэй.",
    "Салоныхоо өнгө төрхийг бүрдүүлье.",
    "Таны Salon77 бэлэн боллоо.",
  ];
  const descriptions = [
    "Үндсэн мэдээллээс эхэлье. Бусдыг нь дараа нэмж болно.",
    "Салоны танилцуулга хуудсандаа тогтооход хялбар хаяг сонгоорой.",
    "Эхний салбараа нэмээрэй. Бусад салбараа дараа бүртгэж болно.",
    "Лого болон нүүр зураг оруулах боломж дараагийн шатанд нэмэгдэнэ.",
  ];
  async function next(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (step === 0) {
      if (!data.slug)
        setData({
          ...data,
          slug: data.name
            .toLowerCase()
            .normalize("NFKD")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, ""),
          branch: { ...data.branch, phone: data.phone },
        });
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
    if (step === 2) {
      setStep(3);
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
        body: JSON.stringify(data),
      });
      const body = await result.json();
      if (!result.ok) throw new Error(body.error);
      setStep(4);
      router.refresh();
    } catch (e) {
      setError(
        userFacingError(e, "Салон үүсгэж чадсангүй. Дахин оролдоно уу."),
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
        <Link href="/">Удирдлагын хэсэгт буцах ↗</Link>
      </header>
      <main className="onboarding-container">
        <div
          className="onboarding-steps"
          aria-label={`5 алхмын ${step + 1} дахь алхам`}
        >
          {titles.map((t, i) => (
            <div
              className={`onboarding-step ${i <= step ? "done" : ""}`}
              key={t}
            />
          ))}
        </div>
        <section className="onboarding-card">
          {step < 4 ? (
            <>
              <div className="eyebrow">ЭХЛЭХ ТОХИРГОО · {step + 1} / 5</div>
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
                          setData({ ...data, name: e.target.value })
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
                      Инстаграм хаяг · заавал биш
                      <input
                        maxLength={100}
                        value={data.instagram}
                        onChange={(e) =>
                          setData({ ...data, instagram: e.target.value })
                        }
                        placeholder="@salon77"
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
                        onChange={(e) =>
                          setData({
                            ...data,
                            slug: e.target.value.toLowerCase(),
                          })
                        }
                        placeholder="tanii-salon"
                      />
                      <small>
                        Латин жижиг үсэг, тоо, зураас ашиглана уу. Хаягийн
                        боломжийг үргэлжлүүлэх болон хадгалах үед шалгана.
                      </small>
                    </label>
                    <div className="url-preview">
                      salon77.mn/<strong>{data.slug || "tanii-salon"}</strong>
                    </div>
                  </>
                )}
                {step === 2 && (
                  <>
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
                        placeholder="Жишээ: Төв салбар"
                      />
                    </label>
                    <label className="field">
                      Дүүрэг
                      <input
                        required
                        maxLength={100}
                        value={data.branch.district}
                        onChange={(e) =>
                          setData({
                            ...data,
                            branch: {
                              ...data.branch,
                              district: e.target.value,
                            },
                          })
                        }
                        placeholder="Жишээ: Сүхбаатар"
                      />
                    </label>
                    <label className="field">
                      Хаяг
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
                    <label className="field">
                      Салбарын утас
                      <input
                        type="tel"
                        required
                        maxLength={30}
                        value={data.branch.phone}
                        onChange={(e) =>
                          setData({
                            ...data,
                            branch: { ...data.branch, phone: e.target.value },
                          })
                        }
                      />
                    </label>
                  </>
                )}
                {step === 3 && (
                  <div
                    className="empty-page"
                    style={{ minHeight: 200, padding: "15px 0" }}
                  >
                    <div className="empty-page-icon">
                      <ImagePlus size={27} />
                    </div>
                    <h2 style={{ fontSize: 17 }}>Зургаа дараа нэмж болно</h2>
                    <p>
                      Лого болон нүүр зургаа дараа оруулах боломжтой.
                      <br />
                      Одоо салоныхоо үндсэн тохиргоог дуусгая.
                    </p>
                  </div>
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
                      : step === 3
                        ? "Алгасаж, салон үүсгэх"
                        : "Үргэлжлүүлэх"}
                    <ArrowRight size={14} />
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <div className="onboarding-success">
              <CheckCircle2 size={52} strokeWidth={1.2} />
              <h1>{titles[4]}</h1>
              <p>Салон тань бэлэн боллоо. Ажлаа эхлүүлээрэй.</p>
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
