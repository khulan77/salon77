import Link from "next/link";
export default function NotFound() {
  return (
    <main className="empty-page">
      <span className="eyebrow">SALON77 · 404</span>
      <h1>Хуудас олдсонгүй.</h1>
      <p>Таны хайсан хуудас байхгүй байна.</p>
      <Link className="button button-primary" href="/">
        Удирдлагын хэсэгт буцах
      </Link>
    </main>
  );
}
