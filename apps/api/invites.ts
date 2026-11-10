import { randomBytes, createHash } from "node:crypto";
import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { FinanceError, lockLedger } from "./wallets.js";

export function normalizeInvite(value: string) {
  const trimmed = value.trim();
  // Preserve the original 64-character invitation format.
  return /^sm-(?:[a-f\d]{4}-){5}[a-f\d]{4}$/i.test(trimmed)
    ? trimmed.toUpperCase()
    : trimmed;
}

// These routes are installed after the session and OWNER middleware.
export function installInvites(app: Express, db: PrismaClient) {
  app.post("/api/admin/invites", async (q, r) => {
    const { count, hours } = z
      .object({
        count: z.number().int().min(1).max(50).default(1),
        hours: z.number().int().min(1).max(168).default(24),
      })
      .parse(q.body ?? {});
    const createdById = r.locals.user.id;
    const expires = new Date(Date.now() + hours * 3600000);
    const codes = Array.from(
      { length: count },
      () =>
        "SM-" +
        randomBytes(12).toString("hex").toUpperCase().match(/.{4}/g)!.join("-"),
    );
    await db.$transaction(async (tx) => {
      await lockLedger(tx, createdById);
      const active = await tx.invite.count({
        where: {
          createdById,
          used: false,
          revokedAt: null,
          expires: { gt: new Date() },
        },
      });
      if (active + count > 500)
        throw new FinanceError(
          400,
          "Lze mít nejvýše 500 nevyužitých platných pozvánek.",
        );
      await tx.invite.createMany({
        data: codes.map((code) => ({
          token: createHash("sha256").update(code).digest("hex"),
          code,
          createdById,
          expires,
        })),
      });
    });
    // Keep compatibility with clients that request a single invitation.
    r.json({ invite: codes[0], count, expires });
  });
  app.get("/api/admin/invites", async (_q, r) => {
    const now = new Date();
    const invites = await db.invite.findMany({
      where: { OR: [{ createdById: r.locals.user.id }, { createdById: null }] },
      orderBy: [{ createdAt: "desc" }, { token: "asc" }],
      take: 1000,
      include: { usedBy: { select: { username: true } } },
    });
    r.json(
      invites.map((i) => {
        const status = i.used
          ? "ACTIVATED"
          : i.revokedAt
            ? "REVOKED"
            : i.expires <= now
              ? "EXPIRED"
              : "PENDING";
        return {
          id: i.token,
          status,
          code: status === "PENDING" ? i.code : null,
          username: i.usedBy?.username ?? null,
          expires: i.expires,
          createdAt: i.createdAt,
          activatedAt: i.usedAt,
        };
      }),
    );
  });
  app.delete("/api/admin/invites/:id", async (q, r) => {
    const result = await db.invite.updateMany({
      where: {
        token: String(q.params.id),
        used: false,
        revokedAt: null,
        OR: [{ createdById: r.locals.user.id }, { createdById: null }],
      },
      data: { revokedAt: new Date(), code: null },
    });
    if (!result.count)
      throw new FinanceError(409, "Pozvánka už byla aktivována nebo zrušena.");
    r.json({ ok: true });
  });
}
