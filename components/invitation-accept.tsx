"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "./ui/button";
import { userFacingError, roleLabel } from "@/lib/ui-language";
export function InvitationAccept({
  token,
  invitation,
  error: initialError,
}: {
  token: string;
  invitation?: {
    salonName: string;
    name: string;
    role: string;
    branches: string[];
  };
  error?: string;
}) {
  const [error, setError] = useState(initialError ?? "");
  const [pending, setPending] = useState(false);
  const router = useRouter();
  async function accept() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      router.replace(result.redirectTo);
      router.refresh();
    } catch (e) {
      setError(
        userFacingError(e, "Урилга хүлээн авч чадсангүй. Дахин оролдоно уу."),
      );
      setPending(false);
    }
  }
  return (
    <main className="onboarding-container">
      <section className="onboarding-card">
        <div className="eyebrow">SALON77</div>
        <h1>Багт нэгдэх урилга</h1>
        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}
        {invitation && (
          <>
            <p>
              «{invitation.salonName}» салонд{" "}
              {roleLabel(invitation.role).toLowerCase()} эрхээр нэгдэнэ.
            </p>
            <div className="notice">
              <strong>{invitation.name}</strong>
              <br />
              Хариуцах салбарууд: {invitation.branches.join(", ")}
            </div>
            <Button disabled={pending} onClick={accept}>
              <CheckCircle2 size={16} />
              {pending ? "Түр хүлээнэ үү…" : "Урилга хүлээн авах"}
            </Button>
          </>
        )}
        <p style={{ marginTop: 20 }}>
          <Link href="/">Удирдлагын хэсэгт буцах</Link>
        </p>
      </section>
    </main>
  );
}
