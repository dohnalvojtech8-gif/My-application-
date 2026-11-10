import type { Express } from "express";
import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { cents, signedCents, balance } from "./money.js";

type DB = PrismaClient | Prisma.TransactionClient;
export class FinanceError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function walletFor(
  db: DB,
  userId: string,
  id?: string,
  allowArchived = false,
) {
  const wallet = await db.wallet.findFirst({
    where: { userId, ...(id ? { id } : { isDefault: true }) },
  });
  if (!wallet || (wallet.archived && !allowArchived))
    throw new FinanceError(404, "Finanční účet není dostupný.");
  return wallet;
}
// Lock the user row in every money write so archiving and transfers cannot race new entries.
export async function lockLedger(db: Prisma.TransactionClient, userId: string) {
  await db.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
}
export async function ledger(db: DB, userId: string) {
  const [wallets, entries, transfers, items, series] = await Promise.all([
    db.wallet.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    }),
    db.entry.findMany({
      where: { userId },
      include: { item: true },
      orderBy: [{ date: "desc" }, { id: "asc" }],
    }),
    db.transfer.findMany({
      where: { userId },
      orderBy: [{ date: "desc" }, { id: "asc" }],
    }),
    db.item.findMany({
      where: { userId },
      orderBy: [{ favorite: "desc" }, { position: "asc" }, { name: "asc" }],
    }),
    db.series.findMany({ where: { userId }, orderBy: { start: "asc" } }),
  ]);
  const rows = entries.map((e) => ({
    ...e,
    item: { ...e.item, ...((e.itemSnapshot as object) || {}) },
  }));
  const accounts = wallets.map((w) => ({
    ...w,
    balance:
      balance(
        w.opening,
        rows.filter((e) => e.walletId === w.id),
      ) +
      transfers.reduce(
        (sum, t) =>
          sum +
          (t.toId === w.id ? t.amount : t.fromId === w.id ? -t.amount : 0n),
        0n,
      ),
  }));
  return {
    wallets: accounts,
    entries: rows,
    transfers,
    items: items.filter((i) => !i.deletedAt),
    series: series.map((s) => ({
      ...s,
      item: items.find((i) => i.id === s.itemId),
    })),
    opening: wallets.reduce((n, w) => n + w.opening, 0n),
    balance: accounts.reduce((n, w) => n + w.balance, 0n),
  };
}
const amount = z.string().refine((v) => {
  try {
    return cents(v) > 0n;
  } catch {
    return false;
  }
}, "Zadejte kladnou částku s nejvýše dvěma desetinnými místy.");
const walletSchema = z.object({
  name: z.string().trim().min(1).max(60),
  kind: z.enum(["BANK", "CASH", "SAVINGS", "OTHER"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  opening: z.string().refine((v) => {
    try {
      signedCents(v);
      return true;
    } catch {
      return false;
    }
  }, "Neplatný počáteční zůstatek."),
});
export function installWallets(app: Express, db: PrismaClient) {
  app.post("/api/wallets", async (q, r) => {
    const v = walletSchema.parse(q.body),
      userId = r.locals.user.id;
    const result = await db.$transaction(async (tx) => {
      await lockLedger(tx, userId);
      if ((await tx.wallet.count({ where: { userId } })) >= 50)
        throw new FinanceError(400, "Lze vytvořit nejvýše 50 účtů.");
      return tx.wallet.create({
        data: { ...v, userId, opening: signedCents(v.opening) },
      });
    });
    r.status(201).json(result);
  });
  app.patch("/api/wallets/:id", async (q, r) => {
    const v = walletSchema.parse(q.body),
      userId = r.locals.user.id;
    r.json(
      await db.$transaction(async (tx) => {
        await lockLedger(tx, userId);
        const old = await walletFor(tx, userId, String(q.params.id), true);
        if (old.isDefault)
          await tx.user.update({
            where: { id: userId },
            data: { opening: signedCents(v.opening) },
          });
        return tx.wallet.update({
          where: { id: old.id },
          data: { ...v, opening: signedCents(v.opening) },
        });
      }),
    );
  });
  app.post("/api/wallets/:id/archive", async (q, r) => {
    const archived = z.boolean().parse(q.body.archived),
      userId = r.locals.user.id;
    r.json(
      await db.$transaction(async (tx) => {
        await lockLedger(tx, userId);
        const w = await walletFor(tx, userId, String(q.params.id), true);
        if (w.isDefault && archived)
          throw new FinanceError(400, "Výchozí účet nelze archivovat.");
        if (archived)
          await tx.series.updateMany({
            where: { userId, walletId: w.id },
            data: { paused: true },
          });
        return tx.wallet.update({ where: { id: w.id }, data: { archived } });
      }),
    );
  });
  app.post("/api/transfers", async (q, r) => {
    const v = z
      .object({
        fromId: z.string().uuid(),
        toId: z.string().uuid(),
        amount,
        date: z.iso.date(),
        comment: z.string().max(500).default(""),
        key: z.string().uuid(),
      })
      .parse(q.body);
    const today = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Prague",
    }).format(new Date());
    if (v.fromId === v.toId || v.date > today)
      throw new FinanceError(
        400,
        "Vyberte dva různé účty a dnešní nebo minulé datum.",
      );
    const userId = r.locals.user.id;
    r.json(
      await db.$transaction(async (tx) => {
        await lockLedger(tx, userId);
        const old = await tx.transfer.findUnique({
          where: { userId_key: { userId, key: v.key } },
        });
        if (old) {
          if (
            old.fromId !== v.fromId ||
            old.toId !== v.toId ||
            old.amount !== cents(v.amount) ||
            old.date !== v.date ||
            old.comment !== v.comment
          )
            throw new FinanceError(
              409,
              "Identifikátor již patří jinému převodu. Obnovte formulář.",
            );
          return old;
        }
        await walletFor(tx, userId, v.fromId);
        await walletFor(tx, userId, v.toId);
        return tx.transfer.create({
          data: { ...v, userId, amount: cents(v.amount) },
        });
      }),
    );
  });
  app.delete("/api/transfers/:id", async (q, r) => {
    await db.$transaction(async (tx) => {
      await lockLedger(tx, r.locals.user.id);
      const result = await tx.transfer.deleteMany({
        where: { id: String(q.params.id), userId: r.locals.user.id },
      });
      if (!result.count) throw new FinanceError(404, "Převod neexistuje.");
    });
    r.json({ ok: true });
  });
}
