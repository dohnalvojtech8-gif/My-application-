import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { cents } from "./money.js";
import { FinanceError, walletFor, lockLedger } from "./wallets.js";
const amount = z
  .string()
  .refine((v) => {
    try {
      return cents(v) > 0n;
    } catch {
      return false;
    }
  }, "Limit musí být kladná částka.")
  .nullable();
export function installBudgets(app: Express, db: PrismaClient) {
  app.put("/api/wallets/:id/budget", async (q, r) => {
    const v = z
      .object({
        amount,
        paymentLimit: amount,
        period: z.enum(["WEEKLY", "MONTHLY", "YEARLY"]),
        warningPercent: z.number().int().min(1).max(100),
        enabled: z.boolean(),
      })
      .parse(q.body);
    if (v.amount == null && v.paymentLimit == null)
      throw new FinanceError(400, "Vyplňte rozpočet nebo limit jedné platby.");
    const userId = r.locals.user.id;
    r.json(
      await db.$transaction(async (tx) => {
        await lockLedger(tx, userId);
        const w = await walletFor(tx, userId, String(q.params.id), true);
        const data = {
          ...v,
          amount: v.amount == null ? null : cents(v.amount),
          paymentLimit: v.paymentLimit == null ? null : cents(v.paymentLimit),
        };
        return tx.budget.upsert({
          where: { walletId: w.id },
          create: { ...data, userId, walletId: w.id },
          update: data,
        });
      }),
    );
  });
  app.delete("/api/wallets/:id/budget", async (q, r) => {
    await walletFor(db, r.locals.user.id, String(q.params.id), true);
    await db.budget.deleteMany({
      where: { userId: r.locals.user.id, walletId: String(q.params.id) },
    });
    r.json({ ok: true });
  });
}
