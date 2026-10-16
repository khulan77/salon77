// Only absolute https links are shown, whatever the environment holds.
function profileUrl(value: string | undefined) {
  const url = value?.trim() ?? "";
  return /^https:\/\/[^\s]+$/.test(url) ? url : "";
}
// Public company details shown on the landing page. Empty values are hidden,
// so nothing placeholder-like ever reaches visitors.
export const site = {
  name: "Salon77",
  // Shown in booking-link examples; the live address comes from APP_URL.
  domain: "salon77.mn",
  // Social profiles come from the environment; an empty value hides the icon.
  facebook: profileUrl(process.env.NEXT_PUBLIC_FACEBOOK_URL),
  instagram: profileUrl(process.env.NEXT_PUBLIC_INSTAGRAM_URL),
  // Mongolian numbers are formatted as "9911 2233".
  phone: "85563793",
  email: "salon77.mn@gmail.com",
  // Facebook page username, linked as m.me/<username> for Messenger.
  messenger: "",
  // How soon a new salon application is reviewed; shown to applicants.
  reviewTime: "24 цагийн дотор",
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
