import type { Express } from "express";
import type { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { z } from "zod";
import {
  siNetflix,
  siSpotify,
  siApple,
  siGoogle,
  siPaypal,
} from "simple-icons";
export function installUploads(app: Express, db: PrismaClient) {
  app.get("/api/brands", (_q, r) =>
    r.json(
      [siNetflix, siSpotify, siApple, siGoogle, siPaypal].map((i) => ({
        name: i.title,
        color: "#" + i.hex,
        path: i.path,
        slug: i.slug,
        source: i.source,
        license: i.license ?? null,
      })),
    ),
  );
  app.post("/api/items/:id/logo", async (q, r) => {
    const userId = r.locals.user.id,
      id = String(q.params.id);
    const item = await db.item.findFirst({ where: { id, userId } });
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
    r.json({ ok: true });
  });
}
