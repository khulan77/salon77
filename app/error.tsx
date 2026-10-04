"use client";
import Link from "next/link";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="empty-page">
      <h1>Хуудсыг ачаалж чадсангүй.</h1>
      <p>Холболт болон хандах эрхээ шалгаад дахин оролдоно уу.</p>
      <button className="button button-primary" onClick={reset}>
        Дахин оролдох
      </button>
      <Link className="text-link" href="/sign-in">
        Нэвтрэх хуудас руу буцах
      </Link>
    </main>
  );
}
