// Public company details shown on the landing page. Empty values are hidden,
// so nothing placeholder-like ever reaches visitors.
export const site = {
  name: "Salon77",
  // Shown in booking-link examples; the live address comes from APP_URL.
  domain: "salon77.mn",
  // Shown as "@handle" and linked to instagram.com/<handle>.
  instagram: "",
  // Mongolian numbers are formatted as "9911 2233".
  phone: "85563793",
  // Where salons transfer their monthly fee; shown on /billing.
  bank: {
    name: "Голомт банк",
    holder: "Дарханбаатар Хулан",
    account: "3665164068",
    iban: "MN880015003665164068",
  },
  about:
    "Salon77 бол Монголын гоо сайхны салон, хумс, сормуус, үсчин, спа зэрэг цаг захиалгаар ажилладаг бизнест зориулсан цаг захиалга, удирдлагын систем юм. Инстаграм мессеж, утас, дэвтэрт тархсан захиалгыг нэг дор цэгцэлж, эзэд, ресепшн, ажилтан бүрийн өдөр тутмын ажлыг хөнгөвчлөх зорилготой. Улаанбаатарт, монгол салонуудын бодит ажлын урсгалд тулгуурлан хөгжүүлж байна.",
};
export function formatSitePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 8
    ? `${digits.slice(0, 4)} ${digits.slice(4)}`
    : phone;
}
