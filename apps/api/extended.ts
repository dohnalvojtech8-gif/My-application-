import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import argon2 from "argon2";
import { cents } from "./money.js";
import { occurrence } from "./recurrence.js";
const preferences = z.object({
  incomeMode: z.enum(["list", "grid"]).default("list"),
  expenseMode: z.enum(["list", "grid"]).default("grid"),
  quickAmounts: z
    .array(z.string().regex(/^\d{1,8}(\.\d{1,2})?$/))
    .max(12)
    .default(["100", "200", "500"]),
  leadDays: z.number().int().min(0).max(30).default(1),
  quietStart: z.number().int().min(0).max(23).default(22),
  quietEnd: z.number().int().min(0).max(23).default(7),
  notifications: z.boolean().default(false),
});
const seriesSchema = z.object({
  itemId: z.string().uuid(),
  amount: z.string().refine((v) => {
    try {
      return cents(v) > 0n;
    } catch {
      return false;
    }
  }),
  start: z.iso.date(),
  end: z.iso.date().nullable().default(null),
  count: z.number().int().min(1).max(10000).nullable().default(null),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
  interval: z.number().int().min(1).max(365),
  comment: z.string().max(1000).default(""),
});
export async function generate(
  db: PrismaClient,
  userId: string,
  horizon: string,
) {
  const series = await db.series.findMany({ where: { userId, paused: false } });
  for (const s of series) {
    const item = await db.item.findFirst({
      where: { id: s.itemId, userId, deletedAt: null },
    });
    if (!item) continue;
    const rows = [];
    for (let i = 0; i < (s.count ?? 10000); i++) {
      const date = occurrence(s.start, s.frequency, s.interval, i);
      if (date > horizon || (s.end && date > s.end)) break;
      rows.push({
        userId,
        itemSnapshot: { name: item.name, kind: item.kind, color: item.color },
        itemId: s.itemId,
        amount: s.amount,
        date,
        status: "PLANNED",
        comment: s.comment,
        key: `series:${s.id}:${i}`,
        seriesId: s.id,
        occurrence: i,
      });
    }
    if (rows.length)
      await db.entry.createMany({ data: rows, skipDuplicates: true });
  }
}
export function installExtended(app: Express, db: PrismaClient) {
  app.put("/api/preferences", async (q, r) => {
    const v = preferences.parse(q.body);
    await db.user.update({
      where: { id: r.locals.user.id },
      data: { preferences: v },
    });
    r.json(v);
  });
  app.post("/api/password", async (q, r) => {
    const v = z
      .object({
        current: z.string().max(128),
        password: z.string().min(12).max(128),
      })
      .parse(q.body);
    if (!(await argon2.verify(r.locals.user.password, v.current)))
      return r.status(403).json({ error: "Nesprávné heslo" });
    await db.$transaction([
      db.user.update({
        where: { id: r.locals.user.id },
        data: { password: await argon2.hash(v.password) },
      }),
      db.session.deleteMany({ where: { userId: r.locals.user.id } }),
      db.widgetDevice.deleteMany({ where: { userId: r.locals.user.id } }),
    ]);
    r.clearCookie("sid").json({ ok: true });
  });
  app.get("/api/admin/invites", async (_q, r) =>
    r.json(
      await db.invite.findMany({
        select: { token: true, expires: true, used: true },
      }),
    ),
  );
  app.delete("/api/admin/invites/:id", async (q, r) =>
    r.json(
      await db.invite.deleteMany({ where: { token: String(q.params.id) } }),
    ),
  );
  app.get("/api/series", async (_q, r) =>
    r.json(await db.series.findMany({ where: { userId: r.locals.user.id } })),
  );
  app.post("/api/series", async (q, r) => {
    const v = seriesSchema.parse(q.body),
      userId = r.locals.user.id;
    if (v.end && v.end < v.start)
      return r.status(400).json({ error: "Konec předchází začátku" });
    if (
      !(await db.item.findFirst({
        where: { id: v.itemId, userId, deletedAt: null },
      }))
    )
      return r.status(404).json({ error: "Položka neexistuje" });
    r.json(
      await db.series.create({
        data: { ...v, userId, amount: cents(v.amount) },
      }),
    );
  });
  app.put("/api/series/:id", async (q, r) => {
    const v = seriesSchema.parse(q.body),
      userId = r.locals.user.id,
      id = String(q.params.id);
    if (
      !(await db.item.findFirst({
        where: { id: v.itemId, userId, deletedAt: null },
      })) ||
      !(await db.series.findFirst({ where: { id, userId } }))
    )
      return r.status(404).json({ error: "Nenalezeno" });
    await db.$transaction(async (tx) => {
      await tx.series.update({
        where: { id },
        data: { ...v, amount: cents(v.amount) },
      });
      await tx.entry.deleteMany({
        where: { seriesId: id, userId, status: "PLANNED" },
      });
    });
    r.json({ ok: true });
  });
  app.patch("/api/series/:id", async (q, r) => {
    const paused = z.boolean().parse(q.body.paused);
    r.json(
      await db.series.updateMany({
        where: { id: String(q.params.id), userId: r.locals.user.id },
        data: { paused },
      }),
    );
  });
  app.post("/api/series/generate", async (q, r) => {
    const horizon = z.iso.date().parse(q.body.horizon);
    await generate(db, r.locals.user.id, horizon);
    r.json({ ok: true });
  });
  app.post("/api/entries/:id/skip", async (q, r) =>
    r.json(
      await db.entry.updateMany({
        where: {
          id: String(q.params.id),
          userId: r.locals.user.id,
          status: "PLANNED",
        },
        data: { status: "SKIPPED" },
      }),
    ),
  );
  app.get("/api/notifications", async (_q, r) =>
    r.json(
      await db.notification.findMany({
        where: { userId: r.locals.user.id },
        orderBy: { date: "desc" },
        take: 100,
      }),
    ),
  );
  app.post("/api/notifications/:id/read", async (q, r) =>
    r.json(
      await db.notification.updateMany({
        where: { id: String(q.params.id), userId: r.locals.user.id },
        data: { read: true },
      }),
    ),
  );
  app.get("/api/push/key", (_q, r) =>
    r.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null }),
  );
  app.post("/api/push", async (q, r) => {
    const v = z
      .object({
        endpoint: z
          .url()
          .refine(
            (v) =>
              new URL(v).protocol === "https:" &&
              [
                "fcm.googleapis.com",
                "updates.push.services.mozilla.com",
                "web.push.apple.com",
              ].some(
                (host) =>
                  new URL(v).hostname === host ||
                  new URL(v).hostname.endsWith("." + host),
              ),
          ),
        keys: z.object({
          p256dh: z.string().max(200),
          auth: z.string().max(100),
        }),
      })
      .parse(q.body);
    const existing = await db.subscription.findUnique({
      where: { endpoint: v.endpoint },
    });
    if (existing && existing.userId !== r.locals.user.id)
      return r.status(409).json({ error: "Odběr již existuje" });
    r.json(
      await db.subscription.upsert({
        where: { endpoint: v.endpoint },
        create: { ...v, userId: r.locals.user.id },
        update: { keys: v.keys },
      }),
    );
  });
  app.get("/api/backup", async (_q, r) => {
    const userId = r.locals.user.id;
    const [items, entries, series] = await Promise.all([
      db.item.findMany({ where: { userId } }),
      db.entry.findMany({ where: { userId } }),
      db.series.findMany({ where: { userId } }),
    ]);
    r.set(
      "Content-Disposition",
      'attachment; filename="systematic-money-backup.json"',
    ).json({
      version: 1,
      exportedAt: new Date(),
      opening: r.locals.user.opening,
      preferences: r.locals.user.preferences,
      items,
      entries,
      series,
    });
  });
}
