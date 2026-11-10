import { Router, type Express } from "express";
import rateLimit from "express-rate-limit";
import { PrismaClient } from "@prisma/client";
import { randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import { cents, balance } from "./money.js";
const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const preset = z.object({
  name: z.string().trim().min(1).max(50),
  itemId: z.string().uuid(),
  amount: z.string().refine((v) => {
    try {
      return cents(v) > 0n;
    } catch {
      return false;
    }
  }),
  mode: z.enum(["DIRECT", "FORM"]).default("FORM"),
  showBalance: z.boolean().default(false),
});
export function widgetRouter(db: PrismaClient) {
  const router = Router();
  router.use(async (q, r, next) => {
    r.set("Cache-Control", "no-store");
    const token = q.headers.authorization?.match(
      /^Bearer ([a-f0-9]{64})$/,
    )?.[1];
    if (!token) return r.status(401).json({ error: "Widget není připojený" });
    const device = await db.widgetDevice.findUnique({
      where: { tokenHash: digest(token) },
      include: { user: true },
    });
    if (!device || device.expiresAt < new Date() || device.user.blocked)
      return r.status(401).json({
        error: "Připojení widgetu vypršelo. Připojte jej znovu v aplikaci.",
      });
    r.locals.device = device;
    next();
  });
  router.get("/snapshot", async (_q, r) => {
    const d = r.locals.device;
    const actions = await db.quickAction.findMany({
      where: { userId: d.userId },
      orderBy: { createdAt: "asc" },
    });
    const items = await db.item.findMany({
      where: { userId: d.userId, deletedAt: null, hidden: false },
    });
    const available = actions.flatMap((a) => {
      const i = items.find((i) => i.id === a.itemId);
      return i
        ? [
            {
              id: a.id,
              name: a.name,
              itemId: i.id,
              kind: i.kind,
              amount: a.amount.toString(),
              mode: a.mode,
              showBalance: a.showBalance,
              color: i.color,
            },
          ]
        : [];
    });
    const entries = d.showBalance
      ? await db.entry.findMany({
          where: { userId: d.userId, status: "DONE" },
          include: { item: true },
        })
      : [];
    r.json({
      balance: d.showBalance
        ? balance(d.user.opening, entries).toString()
        : null,
      actions: available,
      updatedAt: new Date().toISOString(),
    });
  });
  router.post("/actions/:id", async (q, r) => {
    const { requestId } = z
        .object({ requestId: z.string().uuid() })
        .parse(q.body),
      d = r.locals.device;
    const action = await db.quickAction.findFirst({
      where: { id: String(q.params.id), userId: d.userId, mode: "DIRECT" },
    });
    if (!action)
      return r.status(404).json({ error: "Rychlá akce není dostupná" });
    const item = await db.item.findFirst({
      where: {
        id: action.itemId,
        userId: d.userId,
        deletedAt: null,
        hidden: false,
      },
    });
    if (!item) return r.status(404).json({ error: "Položka není dostupná" });
    const key = `widget:${d.id}:${requestId}`;
    const entry = await db.$transaction(async (tx) => {
      await tx.entry.createMany({
        data: [
          {
            userId: d.userId,
            itemId: item.id,
            amount: action.amount,
            date: new Intl.DateTimeFormat("sv-SE", {
              timeZone: "Europe/Prague",
            }).format(new Date()),
            status: "DONE",
            comment: "Widget · " + action.name,
            key,
            itemSnapshot: {
              name: item.name,
              kind: item.kind,
              color: item.color,
            },
          },
        ],
        skipDuplicates: true,
      });
      return tx.entry.findUniqueOrThrow({
        where: { userId_key: { userId: d.userId, key } },
      });
    });
    r.json({ ok: true, entryId: entry.id });
  });
  return router;
}
export function installWidgetSettings(app: Express, db: PrismaClient) {
  app.get("/api/quick-actions", async (_q, r) =>
    r.json(
      await db.quickAction.findMany({
        where: { userId: r.locals.user.id },
        orderBy: { createdAt: "asc" },
      }),
    ),
  );
  app.post("/api/quick-actions", async (q, r) => {
    const v = preset.parse(q.body),
      userId = r.locals.user.id;
    if (
      !(await db.item.findFirst({
        where: { id: v.itemId, userId, deletedAt: null, hidden: false },
      }))
    )
      return r.status(404).json({ error: "Položka není dostupná" });
    if ((await db.quickAction.count({ where: { userId } })) >= 20)
      return r.status(400).json({ error: "Nejvýše 20 rychlých akcí" });
    r.json(
      await db.quickAction.create({
        data: { ...v, userId, amount: cents(v.amount) },
      }),
    );
  });
  app.delete("/api/quick-actions/:id", async (q, r) =>
    r.json(
      await db.quickAction.deleteMany({
        where: { id: String(q.params.id), userId: r.locals.user.id },
      }),
    ),
  );
  app.get("/api/widget-devices", async (_q, r) =>
    r.json(
      await db.widgetDevice.findMany({
        where: { userId: r.locals.user.id },
        select: { id: true, name: true, expiresAt: true, showBalance: true },
      }),
    ),
  );
  app.post(
    "/api/widget-devices",
    rateLimit({ windowMs: 900000, limit: 20 }),
    async (q, r) => {
      const v = z
        .object({
          name: z.string().min(1).max(80),
          password: z.string().max(128),
          showBalance: z.boolean(),
        })
        .parse(q.body);
      const { default: argon2 } = await import("argon2");
      if (!(await argon2.verify(r.locals.user.password, v.password)))
        return r.status(403).json({ error: "Nesprávné heslo" });
      if (
        (await db.widgetDevice.count({
          where: { userId: r.locals.user.id },
        })) >= 10
      )
        return r.status(400).json({ error: "Odeberte nejprve staré zařízení" });
      const token = randomBytes(32).toString("hex");
      const device = await db.widgetDevice.create({
        data: {
          userId: r.locals.user.id,
          name: v.name,
          tokenHash: digest(token),
          showBalance: v.showBalance,
          expiresAt: new Date(Date.now() + 30 * 86400000),
        },
      });
      r.json({ id: device.id, token, expiresAt: device.expiresAt });
    },
  );
  app.delete("/api/widget-devices/:id", async (q, r) =>
    r.json(
      await db.widgetDevice.deleteMany({
        where: { id: String(q.params.id), userId: r.locals.user.id },
      }),
    ),
  );
}
