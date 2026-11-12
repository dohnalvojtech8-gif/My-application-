import { currencyCodes } from "../shared/currencies.js";
import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { lockLedger, walletFor } from "./wallets.js";
const amount = z
  .string()
  .regex(/^\d{1,16}$/)
  .transform(BigInt);
const opening = z
  .string()
  .regex(/^-?\d{1,16}$/)
  .transform(BigInt);
const hex = z.string().regex(/^#[a-fA-F0-9]{6}$/);
const item = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(80),
  kind: z.enum(["INCOME", "EXPENSE"]),
  color: hex,
  hidden: z.boolean().default(false),
  favorite: z.boolean().default(false),
  important: z.boolean().default(false),
  position: z.number().int().min(0).default(0),
  defaultAmount: amount.default(0n),
  deletedAt: z
    .string()
    .datetime()
    .nullable()
    .optional()
    .transform((v) => (v ? new Date(v) : null)),
});
const entry = z.object({
  itemId: z.string().uuid(),
  walletId: z.string().uuid().optional(),
  amount,
  date: z.iso.date(),
  createdAt: z
    .string()
    .datetime()
    .nullable()
    .optional()
    .transform((value) => (value ? new Date(value) : null)),
  status: z.enum(["PLANNED", "DONE", "SKIPPED"]),
  merchant: z.string().trim().max(120).default(""),
  comment: z.string().max(1000).default(""),
  seriesId: z.string().uuid().nullable().optional(),
  occurrence: z.number().int().min(0).nullable().optional(),
  itemSnapshot: z
    .object({
      name: z.string().max(80),
      kind: z.enum(["INCOME", "EXPENSE"]),
      color: hex,
    })
    .nullable()
    .optional(),
});
const wallet = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(60),
  kind: z.enum(["BANK", "CASH", "SAVINGS", "OTHER"]),
  color: hex,
  currency: z.enum(currencyCodes),
  opening,
  isDefault: z.boolean(),
  archived: z.boolean(),
});
const series = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
  walletId: z.string().uuid(),
  amount,
  start: z.iso.date(),
  end: z.iso.date().nullable(),
  count: z.number().int().min(1).max(10000).nullable(),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
  interval: z.number().int().min(1).max(365),
  paused: z.boolean(),
  merchant: z.string().trim().max(120).default(""),
  comment: z.string().max(1000),
});
const transfer = z.object({
  receivedAmount: amount
    .refine((n) => n > 0n)
    .nullable()
    .optional(),
  fromId: z.string().uuid(),
  toId: z.string().uuid(),
  createdAt: z
    .string()
    .datetime()
    .nullable()
    .optional()
    .transform((value) => (value ? new Date(value) : null)),
  amount: amount.refine((n) => n > 0n),
  date: z.iso.date(),
  comment: z.string().max(500),
});
export function installRestore(app: Express, db: PrismaClient) {
  app.post("/api/restore", async (q, r) => {
    const body =
      q.body?.version === 1
        ? {
            ...q.body,
            wallets: undefined,
            transfers: undefined,
            series: undefined,
            budgets: undefined,
          }
        : q.body;
    const v = z
      .object({
        version: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        budgets: z
          .array(
            z
              .object({
                walletId: z.string().uuid(),
                amount: amount.refine((n) => n > 0n).nullable(),
                paymentLimit: amount.refine((n) => n > 0n).nullable(),
                period: z.enum(["WEEKLY", "MONTHLY", "YEARLY"]),
                warningPercent: z.number().int().min(1).max(100),
                enabled: z.boolean(),
              })
              .refine((b) => b.amount != null || b.paymentLimit != null),
          )
          .max(50)
          .optional(),
        opening,
        items: z.array(item).max(1000),
        entries: z.array(entry).max(10000),
        wallets: z.array(wallet).max(50).optional(),
        series: z.array(series).max(1000).optional(),
        transfers: z.array(transfer).max(10000).optional(),
      })
      .parse(body);
    const userId = r.locals.user.id,
      itemIds = new Set(v.items.map((i) => i.id)),
      walletIds = new Set(v.wallets?.map((w) => w.id)),
      seriesIds = new Set(v.series?.map((s) => s.id));
    const invalidBudget =
      (v.budgets || []).some((b) => !walletIds.has(b.walletId)) ||
      new Set((v.budgets || []).map((b) => b.walletId)).size !==
        (v.budgets || []).length;
    const invalidExchange = (v.transfers || []).some((t) => {
      const from = v.wallets?.find((w) => w.id === t.fromId),
        to = v.wallets?.find((w) => w.id === t.toId);
      return from?.currency === to?.currency
        ? t.receivedAmount != null && t.receivedAmount !== t.amount
        : t.receivedAmount == null;
    });
    if (
      invalidBudget ||
      invalidExchange ||
      itemIds.size !== v.items.length ||
      v.entries.some((e) => !itemIds.has(e.itemId)) ||
      (v.version >= 2 &&
        (!v.wallets?.length ||
          walletIds.size !== v.wallets.length ||
          v.wallets.filter((w) => w.isDefault && !w.archived).length !== 1 ||
          v.wallets.filter((w) => w.isDefault).length !== 1 ||
          v.entries.some(
            (e) =>
              !e.walletId ||
              !walletIds.has(e.walletId) ||
              (e.seriesId &&
                (!seriesIds.has(e.seriesId) || e.occurrence == null)),
          ) ||
          (v.series || []).some(
            (s) =>
              !walletIds.has(s.walletId) ||
              !itemIds.has(s.itemId) ||
              (s.end && s.end < s.start),
          ) ||
          seriesIds.size !== (v.series || []).length ||
          (v.transfers || []).some(
            (t) =>
              t.fromId === t.toId ||
              !walletIds.has(t.fromId) ||
              !walletIds.has(t.toId),
          )))
    )
      return r
        .status(400)
        .json({ error: "Záloha obsahuje neplatné odkazy účtů nebo položek." });
    await db.$transaction(
      async (tx) => {
        await lockLedger(tx, userId);
        const main = await walletFor(tx, userId);
        if (
          (await tx.entry.count({ where: { userId } })) ||
          (await tx.item.count({ where: { userId } })) ||
          (await tx.transfer.count({ where: { userId } })) ||
          (await tx.series.count({ where: { userId } })) ||
          (await tx.budget.count({ where: { userId } })) ||
          (await tx.wallet.count({ where: { userId } })) !== 1 ||
          main.opening !== 0n
        )
          throw Error("Obnovu lze provést pouze do prázdného účtu");
        const wallets = new Map<string, string>();
        if (v.version >= 2) {
          for (const w of v.wallets!) {
            const { id, ...data } = w;
            const created = w.isDefault
              ? await tx.wallet.update({ where: { id: main.id }, data })
              : await tx.wallet.create({ data: { ...data, userId } });
            wallets.set(id, created.id);
            if (w.isDefault)
              await tx.user.update({
                where: { id: userId },
                data: { opening: w.opening },
              });
          }
        } else {
          await tx.wallet.update({
            where: { id: main.id },
            data: { opening: v.opening },
          });
          await tx.user.update({
            where: { id: userId },
            data: { opening: v.opening },
          });
        }
        const items = new Map<string, string>(),
          seriesMap = new Map<string, string>();
        for (const i of v.items) {
          const { id, ...data } = i;
          items.set(
            id,
            (await tx.item.create({ data: { ...data, userId } })).id,
          );
        }
        if (v.version >= 2)
          for (const s of v.series || []) {
            const { id, ...data } = s;
            seriesMap.set(
              id,
              (
                await tx.series.create({
                  data: {
                    ...data,
                    userId,
                    itemId: items.get(s.itemId)!,
                    walletId: wallets.get(s.walletId)!,
                  },
                })
              ).id,
            );
          }
        await tx.entry.createMany({
          data: v.entries.map((e) => {
            const seriesId = e.seriesId ? seriesMap.get(e.seriesId) : undefined;
            return {
              ...e,
              itemSnapshot: e.itemSnapshot || undefined,
              userId,
              walletId: v.version >= 2 ? wallets.get(e.walletId!)! : main.id,
              itemId: items.get(e.itemId)!,
              seriesId: seriesId || null,
              occurrence: seriesId ? e.occurrence : null,
              key: seriesId
                ? `series:${seriesId}:${e.occurrence}`
                : "restore:" + randomUUID(),
            };
          }),
        });
        if (v.budgets?.length)
          await tx.budget.createMany({
            data: v.budgets.map((b) => ({
              ...b,
              userId,
              walletId: wallets.get(b.walletId)!,
            })),
          });
        if (v.version >= 2 && v.transfers?.length)
          await tx.transfer.createMany({
            data: v.transfers.map((t) => ({
              ...t,
              userId,
              fromId: wallets.get(t.fromId)!,
              toId: wallets.get(t.toId)!,
              key: "restore:" + randomUUID(),
            })),
          });
      },
      { timeout: 20000 },
    );
    r.json({ ok: true });
  });
}
