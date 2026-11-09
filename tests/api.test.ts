import { beforeAll, afterAll, it, expect } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
const enabled = !!process.env.TEST_DATABASE_URL;
const suite = enabled ? it : it.skip;
let app: any, db: any;
const origin = "http://localhost:3000";
beforeAll(async () => {
  if (!enabled) return;
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.NODE_ENV = "test";
  ({ app, db } = await import("../apps/api/server"));
  await db.event.deleteMany();
  await db.notification.deleteMany();
  await db.subscription.deleteMany();
  await db.entry.deleteMany();
  await db.series.deleteMany();
  await db.item.deleteMany();
  await db.session.deleteMany();
  await db.user.deleteMany();
  await db.invite.deleteMany();
  await db.bootstrap.deleteMany();
});
afterAll(async () => {
  await db?.$disconnect();
});
suite(
  "registrace, izolace, CSRF, CRUD, potvrzení a idempotence na PostgreSQL",
  async () => {
    const creds = { username: "owner", password: "test-password-12345" };
    const registrations = await Promise.all([
      request(app).post("/api/auth/register").set("Origin", origin).send(creds),
      request(app)
        .post("/api/auth/register")
        .set("Origin", origin)
        .send({ ...creds, username: "racer" }),
    ]);
    expect(registrations.map((r) => r.status).sort()).toEqual([201, 409]);
    const winner = await db.user.findFirst();
    expect(winner.role).toBe("OWNER");
    expect(
      (
        await request(app)
          .post("/api/auth/register")
          .set("Origin", origin)
          .send({ ...creds, username: "third" })
      ).status,
    ).toBe(409);
    const owner = request.agent(app),
      other = request.agent(app);
    await owner
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({ ...creds, username: winner.username })
      .expect(200);
    const invitation = await owner
      .post("/api/admin/invites")
      .set("Origin", origin)
      .send({})
      .expect(200);
    await other
      .post("/api/auth/register")
      .set("Origin", origin)
      .send({ ...creds, username: "other", invite: invitation.body.invite })
      .expect(201);
    await request(app)
      .post("/api/auth/register")
      .set("Origin", origin)
      .send({ ...creds, username: "reuse", invite: invitation.body.invite })
      .expect(400);
    await other
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({ ...creds, username: "other" })
      .expect(200);
    await other.get("/api/admin/users").expect(403);
    await owner.post("/api/items").send({ name: "bad" }).expect(403);
    const item = await other
      .post("/api/items")
      .set("Origin", origin)
      .send({ name: "Soukromé", kind: "EXPENSE", color: "#123456" })
      .expect(200);
    const v = {
      itemId: item.body.id,
      amount: "12.29",
      date: "2099-01-01",
      key: randomUUID(),
    };
    await owner.post("/api/entries").set("Origin", origin).send(v).expect(404);
    const entry = await other
      .post("/api/entries")
      .set("Origin", origin)
      .send(v)
      .expect(200);
    await other.post("/api/entries").set("Origin", origin).send(v).expect(200);
    expect((await other.get("/api/data")).body.entries).toHaveLength(1);
    expect((await other.get("/api/data")).body.balance).toBe("0");
    expect((await owner.get("/api/data")).body.entries).toHaveLength(0);
    expect(
      (
        await owner
          .delete("/api/entries/" + entry.body.id)
          .set("Origin", origin)
      ).body.count,
    ).toBe(0);
    await other
      .patch("/api/entries/" + entry.body.id)
      .set("Origin", origin)
      .send({ ...v, amount: "15.30", date: "2020-01-01" })
      .expect(200);
    expect((await other.get("/api/data")).body.balance).toBe("0");
    await other
      .post("/api/entries/" + entry.body.id + "/confirm")
      .set("Origin", origin)
      .send({ date: "2020-01-02" })
      .expect(200);
    expect((await other.get("/api/data")).body.balance).toBe("-1530");
    await other
      .post("/api/series")
      .set("Origin", origin)
      .send({
        itemId: item.body.id,
        amount: "10",
        start: "2026-01-31",
        frequency: "MONTHLY",
        interval: 1,
        count: 3,
      })
      .expect(200);
    for (let i = 0; i < 2; i++)
      await other
        .post("/api/series/generate")
        .set("Origin", origin)
        .send({ horizon: "2026-12-31" })
        .expect(200);
    const data = (await other.get("/api/data")).body;
    expect(data.entries).toHaveLength(4);
    expect(data.balance).toBe("-1530");
    await other
      .delete("/api/entries/" + entry.body.id)
      .set("Origin", origin)
      .expect(200);
    expect((await other.get("/api/data")).body.balance).toBe("0");
    const planned = (await other.get("/api/data")).body.entries[0];
    await other
      .delete("/api/entries/" + planned.id)
      .set("Origin", origin)
      .expect(200);
    await other
      .post("/api/series/generate")
      .set("Origin", origin)
      .send({ horizon: "2026-12-31" });
    expect(
      (await other.get("/api/data")).body.entries.find(
        (e: any) => e.id === planned.id,
      ).status,
    ).toBe("SKIPPED");
    await owner
      .post("/api/items/" + item.body.id + "/logo")
      .set("Origin", origin)
      .send({ data: "dGVzdA==" })
      .expect(404);
    await other
      .post("/api/items/" + item.body.id + "/logo")
      .set("Origin", origin)
      .send({ data: "PHN2Zz48L3N2Zz4=" })
      .expect(400);
    await other
      .patch("/api/items/" + item.body.id)
      .set("Origin", origin)
      .send({ name: "Přejmenovaná", kind: "EXPENSE", color: "#123456" })
      .expect(200);
    expect((await other.get("/api/data")).body.entries[0].item.name).toBe(
      "Soukromé",
    );
    const backup = (await other.get("/api/backup")).body;
    await owner
      .post("/api/restore")
      .set("Origin", origin)
      .send(backup)
      .expect(200);
    const restored = (await owner.get("/api/data")).body;
    expect(restored.items[0].id).not.toBe(item.body.id);
    expect(restored.entries).toHaveLength(3);
    await owner
      .post("/api/restore")
      .set("Origin", origin)
      .send(backup)
      .expect(400);
    const otherUser = await db.user.findUnique({
      where: { username: "other" },
    });
    await owner
      .post("/api/admin/users/" + otherUser.id + "/block")
      .set("Origin", origin)
      .send({ blocked: true })
      .expect(200);
    await other.get("/api/data").expect(401);
    await owner
      .post("/api/admin/users/" + otherUser.id + "/block")
      .set("Origin", origin)
      .send({ blocked: false })
      .expect(200);
  },
  30000,
);
