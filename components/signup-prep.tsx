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
export function SignupPrep({ heading: Heading }: { heading: "h2" | "h3" }) {
  const phone = site.phone && formatSitePhone(site.phone);
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
