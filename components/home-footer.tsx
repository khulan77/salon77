import Link from "next/link";
import Image from "next/image";
import { ArrowUp, Mail, Phone } from "lucide-react";
import { site } from "@/lib/site";
// The light public footer of /home and /business (styled in app/home.css).
const DIRECTORY = "/home";
export function HomeFooter({ categories }: { categories: string[] }) {
  return (
    <footer className="hx-footer">
      <div className="hx-footer-inner">
        <div className="hx-footer-brand">
          <Image
            src="/salon77-mn-logo.png"
            alt="Salon77.mn"
            width={792}
            height={198}
          />
          <p>
            Улаанбаатар хотын гоо сайхны салонуудыг нэг дор харж, цагаа
            онлайнаар захиалах платформ.
          </p>
          <span className="hx-footer-tag">Premium beauty & wellness</span>
        </div>
        <nav aria-label="Үйлчилгээнүүд">
          <h3>Үйлчилгээнүүд</h3>
          {categories.map((c) => (
            <Link
              key={c}
              href={`${DIRECTORY}?query=${encodeURIComponent(c)}#salons`}
            >
              {c}
            </Link>
          ))}
        </nav>
        <nav aria-label="Салонуудад">
          <h3>Салонуудад</h3>
          <Link href="/business">Бизнесээ бүртгүүлэх</Link>
          <Link href="/business#pricing">Үнэ</Link>
          <Link href="/sign-in">Нэвтрэх</Link>
        </nav>
        <div className="hx-footer-contact">
          <h3>Холбоо барих</h3>
          <a href={`tel:${site.phone}`}>
            <span>
              <Phone size={15} />
            </span>
            {site.phone.replace(/^(\d{4})(\d{4})$/, "$1 $2")}
          </a>
          <a href={`mailto:${site.email}`}>
            <span>
              <Mail size={15} />
            </span>
            {site.email}
          </a>
        </div>
      </div>
      <div className="hx-footer-bottom">
        <div>
          <span>© {new Date().getFullYear()} Salon77 · Улаанбаатар</span>
          <a href="#top" className="hx-top">
            Дээш буцах <ArrowUp size={14} />
          </a>
        </div>
      </div>
    </footer>
  );
}
