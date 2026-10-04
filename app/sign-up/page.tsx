import { AuthForm } from "@/components/auth-form";
import { configured } from "@/lib/env";
export const metadata = { title: "Бүртгүүлэх" };
export default function Page() {
  return <AuthForm signup configured={configured} />;
}
