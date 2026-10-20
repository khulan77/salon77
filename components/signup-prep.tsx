import { Check, Clock, MessageCircle, Phone, ShieldCheck } from "lucide-react";
import { site, formatSitePhone } from "@/lib/site";
// What an owner should have ready before applying. Items marked `later` are
// added after sign-up, so they never block the application itself.
const items = [
  { label: "Салоны нэр" },
  { label: "Утасны дугаар" },
  { label: "Салоны хаяг, байршил" },
  { label: "Инстаграм эсвэл Фэйсбүүк хуудас" },
  { label: "Үйлчилгээний үнийн жагсаалт", later: true },
  { label: "Лого, салоны зураг", later: true },
  { label: "Ажилтнуудын нэр", later: true },
];
// Shared by the business page and the first onboarding step.
export function SignupPrep({
  heading: Heading,
  variant = "default",
}: {
  heading: "h2" | "h3";
  variant?: "default" | "business";
}) {
  const phone = site.phone && formatSitePhone(site.phone);
  if (variant === "business")
    return (
      <div className="bp-preparation">
        <div className="bp-checklists">
          {[false, true].map((later) => (
            <article
              className={`bp-card${later ? " bp-later" : ""}`}
              key={String(later)}
            >
              <div className="bp-card-heading">
                <span className="bp-step">{later ? "02" : "01"}</span>
                <span className="bp-phase">
                  {later ? "Бүртгүүлсний дараа" : "Эхлэхэд хэрэгтэй"}
                </span>
              </div>
              <Heading>
                {later ? "Дараа нь нэмж болно" : "Эхлээд эдгээрийг бэлдээрэй"}
              </Heading>
              <p>
                {later
                  ? "Бүртгэлээ үүсгээд, өөрт тохирох үедээ мэдээллээ гүйцээгээрэй."
                  : "Салоныхоо үндсэн мэдээллийг бэлдвэл хүсэлтээ илгээхэд хялбар."}
              </p>
              <ul>
                {items
                  .filter((item) => Boolean(item.later) === later)
                  .map((item) => (
                    <li key={item.label}>
                      <span className="bp-check">
                        <Check size={14} aria-hidden="true" />
                      </span>
                      {item.label}
                    </li>
                  ))}
              </ul>
            </article>
          ))}
        </div>
        <aside
          className="bp-verification"
          aria-label="Баталгаажуулалтын мэдээлэл"
        >
          <div className="bp-verification-copy">
            <span className="bp-shield">
              <ShieldCheck size={23} aria-hidden="true" />
            </span>
            <div>
              <Heading>Бодит салон. Итгэлтэй захиалга.</Heading>
              <p>
                Үйлчлүүлэгчийг хуурамч бүртгэлээс хамгаалахын тулд салон бүрийг
                шалгаж баталгаажуулдаг.
              </p>
            </div>
          </div>
          <div className="bp-review">
            <Clock size={16} aria-hidden="true" />
            <span>
              Хүсэлтийг ихэвчлэн <strong>{site.reviewTime}</strong> шалгана.
            </span>
          </div>
          {(phone || site.messenger) && (
            <div className="bp-contact">
              <span>Бэлдэхэд тусламж хэрэгтэй юу?</span>
              <div>
                {phone && (
                  <a href={`tel:${site.phone.replace(/\s/g, "")}`}>
                    <Phone size={14} aria-hidden="true" />
                    {phone}
                  </a>
                )}
                {site.messenger && (
                  <a
                    href={`https://m.me/${site.messenger}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle size={14} aria-hidden="true" />
                    Messenger
                  </a>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    );
  return (
    <div className="prep">
      <div className="prep-block">
        <Heading>Бүртгүүлэхэд бэлдэх зүйлс</Heading>
        <ul className="prep-list">
          {items.map((item) => (
            <li key={item.label}>
              <Check size={14} strokeWidth={2.5} />
              <span>
                {item.label}
                {item.later && <small>Бүртгүүлсний дараа нэмж болно</small>}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="prep-block prep-info">
        <div>
          <ShieldCheck size={17} />
          <p>
            <strong>Яагаад бид шалгаж баталгаажуулдаг вэ?</strong>
            Хуурамч салон нэрээр урьдчилгаа авч үйлчлүүлэгчийг залилахаас
            сэргийлэхийн тулд салон бүр бодитой эсэхийг шалгадаг. Ингэснээр
            үйлчлүүлэгч Salon77 дээрх салонд итгэлтэй цаг захиална.
          </p>
        </div>
        <div>
          <Clock size={17} />
          <p>
            <strong>Хэр удах вэ?</strong>
            Хүсэлтийг ихэвчлэн {site.reviewTime} шалгаж баталгаажуулна.
          </p>
        </div>
        {(phone || site.messenger) && (
          <div className="prep-contact">
            <span>Асуух зүйл байвал:</span>
            {phone && (
              <a href={`tel:${site.phone.replace(/\s/g, "")}`}>
                <Phone size={14} /> {phone}
              </a>
            )}
            {site.messenger && (
              <a
                href={`https://m.me/${site.messenger}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle size={14} /> Messenger
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
