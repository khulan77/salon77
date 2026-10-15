"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Clock3,
  MapPin,
  Scissors,
  UserRoundPlus,
  Users,
} from "lucide-react";
import { Button } from "./ui/button";
import { requestJson } from "@/lib/client-request";
import { userFacingError } from "@/lib/ui-language";
import type { AdminData } from "@/lib/admin-data";
// First steps for a new salon, shown above the calendar until the salon can
// take bookings: a branch, services, staff and their hours.
export function SetupSteps({ data }: { data: AdminData }) {
  const steps = [
    {
      title: "Салбар",
      text: "Байршил, ажлын цаг",
      href: "/branches",
      icon: MapPin,
      done: data.branches.length > 0,
    },
    {
      title: "Үйлчилгээ",
      text: "Үнэ, хугацаа",
      href: "/services",
      icon: Scissors,
      done: data.setup.services,
    },
    {
      title: "Ажилтан",
      text: "Хийдэг үйлчилгээ",
      href: "/employees",
      icon: Users,
      done: data.setup.staff,
    },
    {
      title: "Ажлын хуваарь",
      text: "Гараг, цаг",
      href: "/employees",
      icon: Clock3,
      done: data.setup.hours,
    },
  ];
  const done = steps.filter((s) => s.done).length;
  if (data.role !== "SALON_OWNER" || done === steps.length) return null;
  return (
    <section className="panel setup-steps" aria-labelledby="setup-title">
      <div className="setup-steps-head">
        <div>
          <span className="eyebrow purple-text">ЭХЛЭХ АЛХМУУД</span>
          <h2 id="setup-title">Салоноо захиалга авахад бэлдэе</h2>
        </div>
        <strong>
          {steps.length} алхмаас {done} нь бэлэн
        </strong>
      </div>
      <div className="progress-track">
        <span style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <div className="setup-steps-list">
        {steps.map((s) => (
          <Link
            key={s.title}
            href={s.href}
            className={`checklist-item ${s.done ? "complete" : ""}`}
          >
            <span className="check-circle">
              {s.done ? <Check size={12} /> : <s.icon size={15} />}
            </span>
            <div>
              <strong>{s.title}</strong>
              <span>{s.text}</span>
            </div>
            <ArrowRight size={14} />
          </Link>
        ))}
      </div>
      {(!data.setup.staff || !data.setup.hours) && (
        <SoloSetup preview={data.preview} ready={data.setup.services} />
      )}
    </section>
  );
}
// One-person salons: register the owner as the master with default hours.
function SoloSetup({ preview, ready }: { preview: boolean; ready: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function start() {
    setPending(true);
    setError("");
    try {
      await requestJson("/api/staff/solo", "POST");
      router.refresh();
    } catch (e) {
      setError(userFacingError(e, "Тохируулж чадсангүй. Дахин оролдоно уу."));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="solo-setup">
      <span className="check-circle">
        <UserRoundPlus size={15} />
      </span>
      <div>
        <strong>Ганцаараа ажилладаг уу?</strong>
        <span>
          {ready
            ? "Таныг ажилтнаар бүртгэж, бүх үйлчилгээг оноон, салбарын цагаар Даваа–Бямба гарагийн хуваарь үүсгэнэ."
            : "Эхлээд үйлчилгээгээ нэмээд, дараа нь нэг товчоор өөрийгөө ажилтан болгоно."}
        </span>
        {error && (
          <span className="solo-error" role="alert">
            {error}
          </span>
        )}
      </div>
      <Button
        size="sm"
        variant="outline"
        disabled={preview || !ready || pending}
        onClick={start}
      >
        {pending ? "Тохируулж байна…" : "Би өөрөө үйлчилгээ үзүүлдэг"}
      </Button>
    </div>
  );
}
