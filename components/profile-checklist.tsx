import Link from "next/link";
import { Check, Circle } from "lucide-react";
import type { ProfileItem } from "@/lib/services/publish";
// What is still missing before the directory lists the salon's booking page.
export function ProfileChecklist({
  items,
  note = "Бүгдийг бөглөмөгц захиалгын хуудас тань салонуудын жагсаалтад гарч, олон нийтэд нээгдэнэ.",
}: {
  items: ProfileItem[];
  note?: string;
}) {
  const left = items.filter((i) => !i.done).length;
  if (!left) return null;
  return (
    <section
      className="panel profile-checklist"
      aria-labelledby="profile-checklist-title"
    >
      <div className="profile-checklist-head">
        <h2 id="profile-checklist-title">
          Захиалгын хуудас нээгдэхэд дутуу байгаа зүйлс
        </h2>
        <span>
          {items.length}-аас {items.length - left} бэлэн
        </span>
      </div>
      <p>{note}</p>
      <ul>
        {items.map((i) => (
          <li key={i.key} className={i.done ? "done" : ""}>
            {i.done ? (
              <Check size={14} aria-hidden />
            ) : (
              <Circle size={14} aria-hidden />
            )}
            {i.done ? (
              <span>{i.label}</span>
            ) : (
              <Link href={i.href}>{i.label}</Link>
            )}
            <small>{i.done ? "Бэлэн" : "Дутуу"}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}
