import { PrismaClient } from "@prisma/client";
import webpush from "web-push";
import { generate } from "./extended.js";
const db = new PrismaClient();
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
try {
  const now = new Date(),
    date = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Prague",
    }).format(now),
    hour = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Prague",
        hour: "2-digit",
        hourCycle: "h23",
      }).format(now),
    );
  for (const user of await db.user.findMany({ where: { blocked: false } })) {
    await generate(
      db,
      user.id,
      new Date(Date.now() + 366 * 86400000).toISOString().slice(0, 10),
    );
    const p = user.preferences as any;
    if (!p?.notifications) continue;
    const quiet =
      p.quietStart > p.quietEnd
        ? hour >= p.quietStart || hour < p.quietEnd
        : hour >= p.quietStart && hour < p.quietEnd;
    if (quiet) continue;
    const until = new Date(Date.now() + (p.leadDays ?? 1) * 86400000)
      .toISOString()
      .slice(0, 10);
    for (const e of await db.entry.findMany({
      where: { userId: user.id, status: "PLANNED", date: { lte: until } },
      include: { item: true },
    })) {
      const title =
        e.date < date
          ? "Platba po termínu"
          : e.date === date
            ? "Dnešní splatnost"
            : "Blížící se platba";
      const claimed = await db.notification.createMany({
        data: [{ userId: user.id, entryId: e.id, date, title }],
        skipDuplicates: true,
      });
      if (!claimed.count || !process.env.VAPID_PRIVATE_KEY) continue;
      for (const s of await db.subscription.findMany({
        where: { userId: user.id },
      })) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: s.keys as any },
            JSON.stringify({ title, date: e.date }),
            { timeout: 10000 },
          );
        } catch (error) {
          const status = (error as any).statusCode;
          if (status === 404 || status === 410)
            await db.subscription.delete({ where: { id: s.id } });
          else console.error("Push delivery failed", status ?? "network");
        }
      }
    }
  }
} finally {
  await db.$disconnect();
}
