import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { inviteSchema, memberSchema, tokenSchema } from "../validation";
import {
  type Actor,
  requireOwner,
  refreshActor,
  assertActiveBranches,
} from "../access";
import { HttpError } from "../errors";
export const invalidInvitation =
  "Энэ урилга хүчингүй эсвэл хугацаа нь дууссан байна.";
export function tokenHash(token: string) {
  return createHash("sha256").update(tokenSchema.parse(token)).digest("hex");
}
export function invitationStatus(invite: { status: string; expiresAt: Date }) {
  return invite.status === "PENDING" && invite.expiresAt <= new Date()
    ? "EXPIRED"
    : invite.status;
}
export async function createInvitation(
  db: PrismaClient,
  actor: Actor,
  raw: unknown,
) {
  const input = inviteSchema.parse(raw);
  const ids = [...new Set(input.branchIds)];
  const token = randomBytes(32).toString("hex");
  const invitation = await db.$transaction(
    async (tx) => {
      const current = await refreshActor(tx, actor);
      requireOwner(current);
      await assertActiveBranches(tx, current, ids);
      if (
        await tx.salonMember.findFirst({
          where: {
            salonId: current.salonId,
            user: { email: { equals: input.email, mode: "insensitive" } },
          },
        })
      )
        throw new HttpError(
          409,
          "Энэ хэрэглэгч салоны гишүүн болсон байна. Эрхийг нь багийн жагсаалтаас өөрчилнө үү.",
        );
      await tx.invitation.updateMany({
        where: {
          salonId: current.salonId,
          email: input.email,
          status: { in: ["DRAFT", "PENDING", "EXPIRED"] },
        },
        data: { status: "CANCELLED", revokedAt: new Date() },
      });
      return tx.invitation.create({
        data: {
          salonId: current.salonId,
          name: input.name,
          email: input.email,
          role: input.role,
          status: "PENDING",
          tokenHash: tokenHash(token),
          expiresAt: new Date(Date.now() + 7 * 86400000),
          branches: {
            create: ids.map((branchId) => ({
              branchId,
            })),
          },
        },
        select: { id: true, expiresAt: true },
      });
    },
    { isolationLevel: "Serializable" },
  );
  return { ...invitation, token };
}
export async function cancelInvitation(
  db: PrismaClient,
  actor: Actor,
  id: string,
) {
  await db.$transaction(
    async (tx) => {
      const current = await refreshActor(tx, actor);
      requireOwner(current);
      const result = await tx.invitation.updateMany({
        where: {
          id,
          salonId: current.salonId,
          status: { in: ["DRAFT", "PENDING", "EXPIRED"] },
        },
        data: { status: "CANCELLED", revokedAt: new Date() },
      });
      if (!result.count) throw new HttpError(404, invalidInvitation);
    },
    { isolationLevel: "Serializable" },
  );
}
export type InviteIdentity = {
  id: string;
  email: string;
  emailConfirmed: boolean;
};
function checkInviteIdentity(
  invite: {
    email: string;
    status: string;
    expiresAt: Date;
    acceptedAt: Date | null;
    revokedAt: Date | null;
  } | null,
  user: InviteIdentity,
) {
  if (
    !invite ||
    invitationStatus(invite) !== "PENDING" ||
    invite.acceptedAt ||
    invite.revokedAt
  )
    throw new HttpError(410, invalidInvitation);
  if (
    !user.emailConfirmed ||
    invite.email.toLowerCase() !== user.email.toLowerCase()
  )
    throw new HttpError(
      403,
      "Урилга хүлээн авахын тулд уригдсан, баталгаажсан имэйлээрээ нэвтэрнэ үү.",
    );
}
export async function inspectInvitation(
  db: PrismaClient,
  user: InviteIdentity,
  token: string,
) {
  const invite = await db.invitation.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: {
      salon: { select: { name: true, status: true } },
      branches: {
        include: { branch: { select: { name: true, active: true } } },
      },
    },
  });
  checkInviteIdentity(invite, user);
  if (
    !invite ||
    invite.salon.status !== "ACTIVE" ||
    invite.branches.some((b) => !b.branch.active)
  )
    throw new HttpError(410, invalidInvitation);
  return {
    name: invite.name,
    salonName: invite.salon.name,
    role: invite.role,
    branches: invite.branches.map((b) => b.branch.name),
    expiresAt: invite.expiresAt.toISOString(),
  };
}
export async function acceptInvitation(
  db: PrismaClient,
  user: InviteIdentity,
  token: string,
) {
  return db.$transaction(
    async (tx) => {
      const invite = await tx.invitation.findUnique({
        where: { tokenHash: tokenHash(token) },
        include: { salon: true, branches: { include: { branch: true } } },
      });
      checkInviteIdentity(invite, user);
      if (
        !invite ||
        invite.salon.status !== "ACTIVE" ||
        !invite.branches.length ||
        invite.branches.some(
          (b) => !b.branch.active || b.branch.salonId !== invite.salonId,
        )
      )
        throw new HttpError(410, invalidInvitation);
      if (
        await tx.salonMember.findUnique({
          where: {
            salonId_userId: { salonId: invite.salonId, userId: user.id },
          },
        })
      )
        throw new HttpError(409, "Та энэ салоны гишүүн болсон байна.");
      const claimed = await tx.invitation.updateMany({
        where: {
          id: invite.id,
          status: "PENDING",
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { status: "ACCEPTED", acceptedAt: new Date() },
      });
      if (claimed.count !== 1) throw new HttpError(410, invalidInvitation);
      await tx.user.upsert({
        where: { id: user.id },
        create: {
          id: user.id,
          email: user.email.toLowerCase(),
          name: invite.name,
          // They signed in moments ago to accept the invitation.
          lastLoginAt: new Date(),
        },
        update: { email: user.email.toLowerCase() },
      });
      await tx.salonMember.create({
        data: {
          salonId: invite.salonId,
          userId: user.id,
          role: invite.role,
          branches: {
            create: invite.branches.map((b) => ({
              branchId: b.branchId,
            })),
          },
        },
      });
      return { salonId: invite.salonId, role: invite.role };
    },
    { isolationLevel: "Serializable" },
  );
}
export async function updateMember(
  db: PrismaClient,
  actor: Actor,
  id: string,
  raw: unknown,
) {
  const input = memberSchema.parse(raw);
  const ids = [...new Set(input.branchIds)];
  await db.$transaction(
    async (tx) => {
      const current = await refreshActor(tx, actor);
      requireOwner(current);
      const member = await tx.salonMember.findFirst({
        where: { id, salonId: current.salonId },
      });
      if (!member) throw new HttpError(404, "Гишүүн олдсонгүй.");
      // Owner transfer/removal is deliberately not exposed by this operational editor.
      if (member.role === "SALON_OWNER")
        throw new HttpError(
          409,
          "Эзэмшигчийн эрхийг энэ хэсгээс өөрчлөх боломжгүй.",
        );
      await assertActiveBranches(tx, current, ids);
      await tx.memberBranch.deleteMany({
        where: { memberId: id, salonId: current.salonId },
      });
      await tx.salonMember.update({
        where: { id_salonId: { id, salonId: current.salonId } },
        data: {
          role: input.role,
          active: input.active,
          branches: {
            create: ids.map((branchId) => ({
              branchId,
            })),
          },
        },
      });
    },
    { isolationLevel: "Serializable" },
  );
}
export const recordId = z.string().min(1).max(100);
