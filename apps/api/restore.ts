import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";
const amount = z
  .string()
  .regex(/^\d{1,16}$/)
  .transform(BigInt);
const item = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(80),
  kind: z.enum(["INCOME", "EXPENSE"]),
  color: z.string().regex(/^#[a-fA-F0-9]{6}$/),
  hidden: z.boolean().default(false),
  favorite: z.boolean().default(false),
  important: z.boolean().default(false),
  position: z.number().int().min(0).default(0),
  defaultAmount: amount.default(0n),
});
const entry = z.object({
  itemId: z.string().uuid(),
  amount,
  date: z.iso.date(),
  status: z.enum(["PLANNED", "DONE", "SKIPPED"]),
  comment: z.string().max(1000).default(""),
});
export function installRestore(app: Express, db: PrismaClient) {
  app.post("/api/restore", async (q, r) => {
    const v = z
      .object({
        version: z.literal(1),
        opening: z
          .string()
          .regex(/^-?\d{1,16}$/)
          .transform(BigInt),
        items: z.array(item).max(1000),
        entries: z.array(entry).max(10000),
      })
      .parse(q.body);
    const userId = r.locals.user.id;
    const ids = new Set(v.items.map((i) => i.id));
    if (
      ids.size !== v.items.length ||
      v.entries.some((e) => !ids.has(e.itemId))
    )
      return r.status(400).json({ error: "Záloha obsahuje neplatné odkazy" });
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      if (
        (await tx.entry.count({ where: { userId } })) ||
        (await tx.item.count({ where: { userId } }))
      )
        throw Error("Obnovu lze provést pouze do prázdného účtu");
      const map = new Map<string, string>();
      for (const i of v.items) {
        const { id, ...data } = i;
        const created = await tx.item.create({ data: { ...data, userId } });
        map.set(id, created.id);
      }
      await tx.entry.createMany({
        data: v.entries.map((e, i) => ({
          ...e,
          itemId: map.get(e.itemId)!,
          userId,
          key: "restore:" + crypto.randomUUID(),
        })),
      });
      await tx.user.update({
        where: { id: userId },
        data: { opening: v.opening },
      });
    });
    r.json({ ok: true });
  });
}
