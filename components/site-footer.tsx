import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { Logo } from "@/components/logo";
import { site, formatSitePhone } from "@/lib/site";
// Simple outline glyphs; lucide-react ships no brand icons.
function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M14 8.5V6.8c0-.8.5-1.3 1.3-1.3H17V2.3h-2.6C11.9 2.3 10.4 4 10.4 6.4v2.1H8v3.3h2.4v9.9H14v-9.9h2.7l.4-3.3H14z"
        fill="currentColor"
      />
    </svg>
  );
}
function InstagramIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}
// One footer for every public page.
export function SiteFooter() {
  const phone = site.phone && formatSitePhone(site.phone);
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <Logo href="/" />
          <p>
            Гоо сайхны салонд цагаа онлайнаар захиалах, салоноо нэг дороос
            удирдах систем.
          </p>
          {(site.facebook || site.instagram) && (
            <div className="site-footer-social">
              {site.facebook && (
                <a
                  href={site.facebook}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Salon77 Фэйсбүүк хуудас"
                >
                  <FacebookIcon />
                </a>
              )}
              {site.instagram && (
                <a
                  href={site.instagram}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Salon77 Инстаграм хуудас"
                >
                  <InstagramIcon />
                </a>
              )}
            </div>
          )}
        </div>
        <nav aria-label="Үйлчлүүлэгчдэд">
          <h2>Үйлчлүүлэгчдэд</h2>
          <Link href="/home">Салон хайх</Link>
          <Link href="/home#how">Хэрхэн захиалах вэ</Link>
        </nav>
        <nav aria-label="Салонуудад">
          <h2>Салонуудад</h2>
          <Link href="/business">Бизнесээ бүртгүүлэх</Link>
          <Link href="/business#pricing">Үнэ</Link>
          <Link href="/sign-in">Нэвтрэх</Link>
        </nav>
        <div className="site-footer-contact">
          <h2>Холбоо барих</h2>
          {phone && (
            <a href={`tel:${site.phone.replace(/\s/g, "")}`}>
              <Phone size={15} /> {phone}
            </a>
          )}
          <a href={`mailto:${site.email}`}>
            <Mail size={15} /> {site.email}
          </a>
        </div>
      </div>
      <div className="site-footer-bottom">
        <span>© {new Date().getFullYear()} Salon77</span>
        <span>Улаанбаатар хотод хөгжүүлэв.</span>
      </div>
    </footer>
  );
}
