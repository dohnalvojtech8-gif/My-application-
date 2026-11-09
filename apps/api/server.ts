import { allowedOrigins } from "./origin.js";
import { installRestore } from "./restore.js";
import { installUploads } from "./uploads.js";
import { installExtended } from "./extended.js";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookies from "cookie-parser";
import { randomBytes, createHash } from "node:crypto";
import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { cents, balance, signedCents } from "./money.js";
export const db = new PrismaClient(),
  app = express();
const token = () => randomBytes(32).toString("hex");
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const today = () =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague" }).format(
    new Date(),
  );
app.set("trust proxy", 1);
app.set("json replacer", (_k: string, v: unknown) =>
  typeof v === "bigint" ? v.toString() : v,
);
app.use(helmet(), express.json({ limit: "1mb" }), cookies());
app.use("/api", rateLimit({ windowMs: 60000, limit: 180 }));
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    !allowedOrigins().has(req.headers.origin || "")
  )
    return res
      .status(403)
      .json({
        error:
          "Adresa aplikace není povolená. Provozovatel musí zkontrolovat APP_ORIGIN na serveru.",
      });
  next();
});
const credentials = z.object({
  username: z
    .string()
    .min(3, "Uživatelské jméno musí mít alespoň 3 znaky.")
    .max(64, "Uživatelské jméno smí mít nejvýše 64 znaků.")
    .regex(
      /^[\p{L}\p{N}_-]+$/u,
      "Jméno může obsahovat písmena, číslice, pomlčku a podtržítko; nikoli mezery nebo e-mail.",
    ),
  password: z
    .string()
    .min(12, "Heslo musí mít alespoň 12 znaků.")
    .max(128, "Heslo smí mít nejvýše 128 znaků."),
  invite: z.string().optional(),
});
app.get("/api/health", async (_q, r) => {
  await db.bootstrap.findUnique({ where: { id: 1 } });
  r.json({ ok: true });
});
app.get("/api/setup", async (_q, r) =>
  r.json({ open: !(await db.bootstrap.findUnique({ where: { id: 1 } })) }),
);
app.use("/api/auth", rateLimit({ windowMs: 900000, limit: 20 }));
app.post("/api/auth/register", async (q, r) => {
  const c = credentials.parse(q.body);
  const password = await argon2.hash(c.password);
  await db.$transaction(async (tx) => {
    let role = "USER";
    if (c.invite) {
      const changed = await tx.invite.updateMany({
        where: {
          token: hash(c.invite),
          used: false,
          expires: { gt: new Date() },
        },
        data: { used: true },
      });
      if (changed.count !== 1) throw Error("Neplatná pozvánka");
    } else {
      await tx.bootstrap.create({ data: { id: 1 } });
      role = "OWNER";
    }
    await tx.user.create({ data: { username: c.username, password, role } });
  });
  r.status(201).json({ ok: true });
});
app.post("/api/auth/login", async (q, r) => {
  const c = credentials.parse(q.body),
    u = await db.user.findUnique({ where: { username: c.username } });
  if (!u || u.blocked || !(await argon2.verify(u.password, c.password)))
    return r.status(401).json({ error: "Neplatné přihlášení" });
  const t = token();
  await db.session.create({
    data: {
      token: hash(t),
      userId: u.id,
      expires: new Date(Date.now() + 86400000 * 7),
    },
  });
  r.cookie("sid", t, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 86400000 * 7,
    path: "/",
  }).json({ ok: true });
});
app.use("/api", async (q, r, next) => {
  const s = await db.session.findUnique({
    where: { token: hash(q.cookies.sid || "") },
    include: { user: true },
  });
  if (!s || s.expires < new Date() || s.user.blocked)
    return r.status(401).json({ error: "Přihlaste se" });
  r.locals.user = s.user;
  if (!["GET", "HEAD", "OPTIONS"].includes(q.method))
    r.once("finish", () => {
      if (r.statusCode < 400)
        void db.event
          .create({
            data: {
              userId: s.user.id,
              action: q.method + " " + (q.route?.path || q.path),
            },
          })
          .catch(() => console.error("Audit event write failed"));
    });
  next();
});
app.post("/api/logout", async (q, r) => {
  await db.session.deleteMany({ where: { token: hash(q.cookies.sid || "") } });
  r.clearCookie("sid").json({ ok: true });
});
app.get("/api/data", async (_q, r) => {
  const u = r.locals.user;
  const [items, entries] = await Promise.all([
    db.item.findMany({
      where: { userId: u.id },
      orderBy: [{ favorite: "desc" }, { position: "asc" }, { name: "asc" }],
    }),
    db.entry.findMany({
      where: { userId: u.id },
      include: { item: true },
      orderBy: { date: "desc" },
    }),
  ]);
  r.json({
    user: {
      username: u.username,
      role: u.role,
      opening: u.opening,
      preferences: u.preferences,
    },
    items,
    entries: entries.map((e) => ({
      ...e,
      item: { ...e.item, ...((e.itemSnapshot as object) || {}) },
    })),
    balance: balance(u.opening, entries),
  });
});
const itemSchema = z.object({
  name: z.string().min(1).max(80),
  kind: z.enum(["INCOME", "EXPENSE"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  defaultAmount: z
    .string()
    .refine((v) => {
      try {
        return cents(v) >= 0n;
      } catch {
        return false;
      }
    })
    .transform(cents)
    .optional(),
  hidden: z.boolean().optional(),
  favorite: z.boolean().optional(),
  important: z.boolean().optional(),
  position: z.number().int().min(0).optional(),
  appearance: z
    .object({
      brand: z
        .enum(["netflix", "spotify", "apple", "google", "paypal"])
        .optional(),
      icon: z.string().max(40).optional(),
      background: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .optional(),
      text: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .optional(),
      gradient: z.boolean().optional(),
      logo: z
        .string()
        .regex(/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/)
        .max(200000)
        .optional(),
    })
    .optional(),
});
app.post("/api/items", async (q, r) =>
  r.json(
    await db.item.create({
      data: { ...itemSchema.parse(q.body), userId: r.locals.user.id },
    }),
  ),
);
app.patch("/api/items/:id", async (q, r) => {
  const data = itemSchema.parse(q.body);
  const existing = await db.item.findFirst({
    where: { id: String(q.params.id), userId: r.locals.user.id },
  });
  if (!existing || existing.kind !== data.kind)
    return r.status(400).json({ error: "Typ položky nelze změnit" });
  r.json(
    await db.item.updateMany({
      where: { id: existing.id, userId: r.locals.user.id },
      data,
    }),
  );
});
const entrySchema = z.object({
  itemId: z.string().uuid(),
  amount: z.string().refine((v) => {
    try {
      return cents(v) > 0n;
    } catch {
      return false;
    }
  }),
  date: z.iso.date(),
  comment: z.string().max(1000).default(""),
  key: z.string().uuid(),
});
app.post("/api/entries", async (q, r) => {
  const v = entrySchema.parse(q.body),
    userId = r.locals.user.id;
  const item = await db.item.findFirst({ where: { id: v.itemId, userId } });
  if (!item) return r.status(404).json({ error: "Položka neexistuje" });
  r.json(
    await db.entry.upsert({
      where: { userId_key: { userId, key: v.key } },
      create: {
        ...v,
        userId,
        itemSnapshot: { name: item.name, kind: item.kind, color: item.color },
        amount: cents(v.amount),
        status: v.date > today() ? "PLANNED" : "DONE",
      },
      update: {},
    }),
  );
});
app.post("/api/entries/:id/confirm", async (q, r) => {
  const date = z.iso.date().parse(q.body.date);
  if (date > today())
    return r.status(400).json({ error: "Budoucí datum nelze potvrdit" });
  r.json(
    await db.entry.updateMany({
      where: {
        id: String(q.params.id),
        userId: r.locals.user.id,
        status: "PLANNED",
      },
      data: { status: "DONE", date },
    }),
  );
});
app.delete("/api/entries/:id", async (q, r) => {
  const where = { id: String(q.params.id), userId: r.locals.user.id };
  const entry = await db.entry.findFirst({ where });
  if (entry?.seriesId)
    return r.json(
      await db.entry.updateMany({ where, data: { status: "SKIPPED" } }),
    );
  r.json(await db.entry.deleteMany({ where }));
});
app.put("/api/settings", async (q, r) => {
  const opening = z.string().parse(q.body.opening);
  await db.user.update({
    where: { id: r.locals.user.id },
    data: { opening: signedCents(opening) },
  });
  r.json({ ok: true });
});
app.patch("/api/entries/:id", async (q, r) => {
  const v = entrySchema.omit({ key: true }).parse(q.body),
    userId = r.locals.user.id;
  const old = await db.entry.findFirst({
    where: { id: String(q.params.id), userId },
  });
  const item = await db.item.findFirst({ where: { id: v.itemId, userId } });
  if (!old || !item) return r.status(404).json({ error: "Nenalezeno" });
  r.json(
    await db.entry.updateMany({
      where: { id: old.id, userId },
      data: {
        ...v,
        itemSnapshot:
          old.itemId === v.itemId
            ? (old.itemSnapshot ?? {
                name: item.name,
                kind: item.kind,
                color: item.color,
              })
            : { name: item.name, kind: item.kind, color: item.color },
        amount: cents(v.amount),
        status:
          old.status === "PLANNED" || v.date > today() ? "PLANNED" : "DONE",
      },
    }),
  );
});
app.use("/api/admin", (_q, r, next) =>
  r.locals.user.role === "OWNER"
    ? next()
    : r.status(403).json({ error: "Zakázáno" }),
);
app.get("/api/admin/users", async (_q, r) =>
  r.json(
    await db.user.findMany({
      select: { id: true, username: true, role: true, blocked: true },
    }),
  ),
);
app.post("/api/admin/invites", async (_q, r) => {
  const t = token();
  await db.invite.create({
    data: { token: hash(t), expires: new Date(Date.now() + 86400000) },
  });
  r.json({ invite: t });
});
app.post("/api/admin/users/:id/block", async (q, r) =>
  r.json(
    await db.user.updateMany({
      where: { id: String(q.params.id), role: "USER" },
      data: { blocked: z.boolean().parse(q.body.blocked) },
    }),
  ),
);
app.get("/api/events", async (_q, r) =>
  r.json(
    await db.event.findMany({
      where: { userId: r.locals.user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ),
);
installExtended(app, db);
installUploads(app, db);
installRestore(app, db);
app.use("/api", (_q, r) => r.status(404).json({ error: "Nenalezeno" }));
app.use(express.static("dist/web"));
app.get("/{*path}", (_q, r) => r.sendFile("index.html", { root: "dist/web" }));
app.use(
  (
    err: unknown,
    _q: express.Request,
    r: express.Response,
    _n: express.NextFunction,
  ) => {
    const code =
      typeof err === "object" && err && "code" in err ? String(err.code) : "";
    console.error({ error: err instanceof Error ? err.name : "Error", code });
    if (err instanceof z.ZodError)
      return r
        .status(400)
        .json({ error: err.issues.map((i) => i.message).join(" ") });
    if (code === "P2002")
      return r
        .status(409)
        .json({
          error:
            "Účet již existuje nebo je registrace vlastníka uzavřena. Přihlaste se; další účet vyžaduje pozvánku.",
        });
    if (
      code.startsWith("P1") ||
      ["P2021", "P2022"].includes(code) ||
      (err instanceof Error && err.name === "PrismaClientInitializationError")
    )
      return r
        .status(503)
        .json({
          error:
            "Databáze není připravená. Provozovatel musí ověřit DATABASE_URL a spustit databázové migrace. Nejde o chybu hesla.",
        });
    r.status(400).json({
      error: "Požadavek nelze provést. Zkontrolujte údaje.",
    });
  },
);
if (process.env.NODE_ENV !== "test")
  app.listen(Number(process.env.PORT || 3000), "0.0.0.0");
