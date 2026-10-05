import { AuthForm } from "@/components/auth-form";
import { safeAuthNext } from "@/lib/auth-navigation";
import { configured } from "@/lib/env";
export const metadata = { title: "Нэвтрэх" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const next = safeAuthNext((await searchParams).next);
  return <AuthForm signup={false} configured={configured} next={next} />;
}
