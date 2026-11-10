import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { z } from "zod";
import { brands, brandMap } from "./catalog.js";
export function installUploads(app: Express, db: PrismaClient) {
  app.get("/api/brands", (q, r) => {
    const term = String(q.query.q || "")
      .toLowerCase()
      .slice(0, 100);
    const offset = Math.max(0, Number(q.query.offset) || 0);
    const found = brands.filter((i) =>
      (i.name + " " + i.slug).toLowerCase().includes(term),
    );
    r.json({
      total: found.length,
      items: found.slice(offset, offset + 60).map(({ path, ...i }) => i),
    });
  });
  app.get("/api/brands/:slug/icon", (q, r) => {
    const b = brandMap.get(String(q.params.slug));
    if (!b) return r.sendStatus(404);
    r.set("Cache-Control", "private, max-age=86400")
      .type("image/svg+xml")
      .send(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${b.color}" d="${b.path}"/></svg>`,
      );
  });
  app.post("/api/items/:id/logo", async (q, r) => {
    const userId = r.locals.user.id,
      id = String(q.params.id);
    const item = await db.item.findFirst({
      where: { id, userId, deletedAt: null },
    });
    if (!item) return r.status(404).json({ error: "Nenalezeno" });
    const { data } = z
      .object({
        data: z
          .string()
          .max(800000)
          .regex(/^[A-Za-z0-9+/=]+$/),
      })
      .parse(q.body);
    const input = Buffer.from(data, "base64");
    const metadata = await sharp(input, {
      limitInputPixels: 16000000,
    }).metadata();
    if (!["png", "jpeg", "webp"].includes(metadata.format || ""))
      return r.status(400).json({ error: "Povoleno PNG, JPEG a WebP" });
    const output = await sharp(input, { limitInputPixels: 16000000 })
      .rotate()
      .resize(256, 256, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    await db.item.update({
      where: { id },
      data: {
        appearance: {
          ...(item.appearance as object),
          logo: "data:image/webp;base64," + output.toString("base64"),
        },
      },
    });
    r.json({ logo: "data:image/webp;base64," + output.toString("base64") });
  });
}
