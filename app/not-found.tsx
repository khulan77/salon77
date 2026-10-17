import Link from "next/link";
import { Logo } from "@/components/logo";
export default function NotFound() {
  return (
    <main className="empty-page">
      <Logo className="page-logo" />
      <span className="eyebrow">404</span>
      <h1>Хуудас олдсонгүй.</h1>
      <p>Таны хайсан хуудас байхгүй байна.</p>
      <Link className="button button-primary" href="/">
        Удирдлагын хэсэгт буцах
      </Link>
    </main>
  );
}
