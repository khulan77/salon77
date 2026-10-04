import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { adminData } from "@/lib/admin-data";
import { navigation } from "@/lib/navigation";
import { Branches } from "@/components/branches";
import { Team } from "@/components/team";
import { Button } from "@/components/ui/button";
const descriptions: Record<string, string> = {
  calendar:
    "Өдрийн ажлаа нэг дороос төлөвлөөрэй. Календар болон сул цаг харах боломж дараагийн шатанд нэмэгдэнэ.",
  bookings:
    "Цахим болон ажилтны бүртгэсэн захиалгуудыг удирдах боломж дараагийн шатанд нэмэгдэнэ.",
  customers:
    "Үйлчлүүлэгчийн мэдээлэл болон үйлчлүүлсэн түүхийг харах боломж дараагийн шатанд нэмэгдэнэ.",
  services:
    "Үйлчилгээний жагсаалт, үнэ, үргэлжлэх хугацааг удирдах боломж дараагийн шатанд нэмэгдэнэ.",
  "salon-page":
    "Салоноо цахимаар танилцуулах хуудас дараагийн шатанд нэмэгдэнэ.",
  support:
    "Систем дотроос тусламж авах боломж дараагийн шатанд нэмэгдэнэ. Одоогоор тохируулах зааврыг төслийн баримт бичгээс үзнэ үү.",
};
export default async function Page({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const item = navigation
    .flatMap((g) => g.items)
    .find((i) => i.href === `/${module}`);
  if (!item) notFound();
  const data = await adminData();
  if (module === "branches") return <Branches data={data} />;
  if (module === "team") return <Team data={data} />;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ТАНЫ УДИРДЛАГЫН ХЭСЭГ</div>
          <h1>
            {item.title}
            <span className="heading-dot">.</span>
          </h1>
          <p>Бизнесээ хөгжүүлэх шинэ боломжууд.</p>
        </div>
      </div>
      <section className="panel empty-page">
        <div className="empty-page-icon">
          <item.icon size={28} strokeWidth={1.3} />
        </div>
        <span className="subtle-pill">ДАРААГИЙН ШАТАНД НЭМЭГДЭНЭ</span>
        <h2>Шинэ боломж бэлдэж байна</h2>
        <p>
          {descriptions[module] ??
            `«${item.title}» хэсэг дараагийн шатанд нэмэгдэнэ. Салоны өдөр тутмын ажлыг хялбарчлах боломжуудыг үе шаттайгаар хөгжүүлж байна.`}
        </p>
        {module === "salon-page" && data.slug && (
          <div className="url-preview">
            Таны сонгосон хаяг: <strong>salon77.mn/{data.slug}</strong>{" "}
            <ArrowUpRight size={13} style={{ display: "inline" }} />
          </div>
        )}
        <Button variant="outline" asChild>
          <Link href="/">
            <ArrowLeft size={14} /> Хяналтын самбарт буцах
          </Link>
        </Button>
      </section>
    </>
  );
}
