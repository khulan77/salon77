import { AuthForm } from "@/components/auth-form";
import { configured } from "@/lib/env";
export const metadata = { title: "Нэвтрэх" };
export default function Page() {
  return <AuthForm signup={false} configured={configured} />;
}
