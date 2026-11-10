import { beforeAll, afterAll, it, expect, vi } from "vitest";
import request from "supertest";
import { randomUUID, randomBytes } from "node:crypto";
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
    const catalog = await other.get("/api/brands").expect(200);
    expect(catalog.body.total).toBeGreaterThan(3000);
    expect(catalog.body.items).toHaveLength(60);
    const netflix = await other.get("/api/brands?q=netflix").expect(200);
    expect(netflix.body.items.some((i: any) => i.slug === "netflix")).toBe(
      true,
    );
    await other
      .get("/api/brands/netflix/icon")
      .expect("Content-Type", /image\/svg/)
      .expect(200);
    await owner
      .delete("/api/items/" + item.body.id)
      .set("Origin", origin)
      .expect(404);
    const beforeDelete = (await other.get("/api/data")).body;
    await other
      .delete("/api/items/" + item.body.id)
      .set("Origin", origin)
      .expect(200);
    const afterDelete = (await other.get("/api/data")).body;
    expect(afterDelete.items).toHaveLength(0);
    expect(afterDelete.entries.length).toBe(beforeDelete.entries.length);
    expect(afterDelete.balance).toBe(beforeDelete.balance);
    expect(afterDelete.entries[0].item.name).toBe("Soukromé");
    await other
      .post("/api/entries")
      .set("Origin", origin)
      .send({ ...v, key: randomUUID() })
      .expect(404);
    expect((await other.get("/api/series")).body[0].paused).toBe(true);
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
suite(
  "widgety: omezené oprávnění, izolace, idempotence a odvolání",
  async () => {
    const other = request.agent(app),
      owner = request.agent(app);
    const password = "test-password-12345";
    await other
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({ username: "other", password })
      .expect(200);
    const ownerUser = await db.user.findFirst({ where: { role: "OWNER" } });
    await owner
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({ username: ownerUser.username, password })
      .expect(200);
    const item = (
      await other
        .post("/api/items")
        .set("Origin", origin)
        .send({ name: "Widget káva", kind: "EXPENSE", color: "#123456" })
    ).body;
    const action = (
      await other
        .post("/api/quick-actions")
        .set("Origin", origin)
        .send({
          name: "Káva",
          itemId: item.id,
          amount: "49.90",
          mode: "DIRECT",
          showBalance: true,
        })
        .expect(200)
    ).body;
    await owner
      .post("/api/quick-actions")
      .set("Origin", origin)
      .send({ name: "Cizí", itemId: item.id, amount: "1", mode: "DIRECT" })
      .expect(404);
    await other
      .post("/api/widget-devices")
      .set("Origin", origin)
      .send({ name: "Telefon", password: "bad", showBalance: true })
      .expect(403);
    const device = (
      await other
        .post("/api/widget-devices")
        .set("Origin", origin)
        .send({ name: "Telefon", password, showBalance: true })
        .expect(200)
    ).body;
    const auth = "Bearer " + device.token;
    expect(
      (await db.widgetDevice.findUnique({ where: { id: device.id } }))
        .tokenHash,
    ).not.toBe(device.token);
    await request(app).get("/api/widget/snapshot").expect(401);
    await request(app).get("/api/data").set("Authorization", auth).expect(401);
    const before = (
      await request(app)
        .get("/api/widget/snapshot")
        .set("Authorization", auth)
        .expect(200)
    ).body;
    expect(before.actions).toHaveLength(1);
    const incomeItem = (
      await other
        .post("/api/items")
        .set("Origin", origin)
        .send({ name: "Widget příjem", kind: "INCOME", color: "#22aa66" })
        .expect(200)
    ).body;
    const expenses = [action.id],
      incomes: string[] = [];
    for (let n = 0; n < 5; n++) {
      incomes.push(
        (
          await other
            .post("/api/quick-actions")
            .set("Origin", origin)
            .send({
              name: `Příjem ${n}`,
              itemId: incomeItem.id,
              amount: "100",
              mode: "DIRECT",
            })
            .expect(200)
        ).body.id,
      );
      if (n > 0)
        expenses.push(
          (
            await other
              .post("/api/quick-actions")
              .set("Origin", origin)
              .send({
                name: `Výdaj ${n}`,
                itemId: item.id,
                amount: "10",
                mode: "DIRECT",
              })
              .expect(200)
          ).body.id,
        );
    }
    const panel = { incomeFirst: true, expenses, incomes };
    await other
      .put("/api/widget-panel")
      .set("Origin", origin)
      .send(panel)
      .expect(200);
    expect((await other.get("/api/widget-panel")).body).toEqual(panel);
    const panelSnapshot = (
      await request(app).get("/api/widget/snapshot").set("Authorization", auth)
    ).body;
    expect(panelSnapshot.panel.incomeFirst).toBe(true);
    expect(panelSnapshot.panel.expenses.map((a: any) => a.id)).toEqual(
      expenses,
    );
    expect(panelSnapshot.panel.incomes.map((a: any) => a.id)).toEqual(incomes);
    expect(panelSnapshot.balance).toBe(before.balance); // Configuring widgets never books payments.
    await owner
      .put("/api/widget-panel")
      .set("Origin", origin)
      .send(panel)
      .expect(400);
    await other
      .put("/api/widget-panel")
      .set("Origin", "https://evil.example")
      .send(panel)
      .expect(403);
    await other
      .put("/api/widget-panel")
      .set("Origin", origin)
      .send({ ...panel, incomes: expenses })
      .expect(400);
    await other
      .put("/api/widget-panel")
      .set("Origin", origin)
      .send({ ...panel, incomes: incomes.slice(0, 4) })
      .expect(400);
    await other
      .delete("/api/quick-actions/" + expenses[4])
      .set("Origin", origin)
      .expect(200);
    expect(
      (
        await request(app)
          .get("/api/widget/snapshot")
          .set("Authorization", auth)
      ).body.panel.expenses[4],
    ).toBeNull();

    const requestId = randomUUID();
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app)
          .post("/api/widget/actions/" + action.id)
          .set("Authorization", auth)
          .send({ requestId, amount: "99999" }),
      ),
    );
    expect(responses.every((r) => r.status === 200)).toBe(true);
    expect(new Set(responses.map((r) => r.body.entryId)).size).toBe(1);
    const after = (
      await request(app).get("/api/widget/snapshot").set("Authorization", auth)
    ).body;
    expect(BigInt(after.balance)).toBe(BigInt(before.balance) - 4990n);
    await request(app)
      .post("/api/widget/actions/" + action.id)
      .set("Authorization", auth)
      .send({ requestId: "invalid" })
      .expect(400);
    const form = (
      await other
        .post("/api/quick-actions")
        .set("Origin", origin)
        .send({ name: "Formulář", itemId: item.id, amount: "10", mode: "FORM" })
    ).body;
    await request(app)
      .post("/api/widget/actions/" + form.id)
      .set("Authorization", auth)
      .send({ requestId: randomUUID() })
      .expect(404);
    const privateDevice = (
      await other
        .post("/api/widget-devices")
        .set("Origin", origin)
        .send({ name: "Soukromý", password, showBalance: false })
    ).body;
    expect(
      (
        await request(app)
          .get("/api/widget/snapshot")
          .set("Authorization", "Bearer " + privateDevice.token)
      ).body.balance,
    ).toBeNull();
    const foreignDevice = (
      await owner
        .post("/api/widget-devices")
        .set("Origin", origin)
        .send({ name: "Owner", password, showBalance: false })
    ).body;
    await request(app)
      .post("/api/widget/actions/" + action.id)
      .set("Authorization", "Bearer " + foreignDevice.token)
      .send({ requestId: randomUUID() })
      .expect(404);
    await other
      .delete("/api/widget-devices/" + device.id)
      .set("Origin", origin)
      .expect(200);
    await request(app)
      .get("/api/widget/snapshot")
      .set("Authorization", auth)
      .expect(401);
    await db.widgetDevice.update({
      where: { id: privateDevice.id },
      data: { expiresAt: new Date(0) },
    });
    await request(app)
      .get("/api/widget/snapshot")
      .set("Authorization", "Bearer " + privateDevice.token)
      .expect(401);
    const loggedOut = (
      await other
        .post("/api/widget-devices")
        .set("Origin", origin)
        .send({ name: "Odhlášení", password, showBalance: false })
    ).body;
    await other.post("/api/logout").set("Origin", origin).send({}).expect(200);
    await request(app)
      .get("/api/widget/snapshot")
      .set("Authorization", "Bearer " + loggedOut.token)
      .expect(401);
  },
  30000,
);

suite(
  "banky: autorizace, stránkování, izolace, souběžný import a odpojení",
  async () => {
    const { enableBanking } = await import("../apps/api/banking/provider");
    process.env.BANK_DATA_KEY = randomBytes(32).toString("hex");
    process.env.BANK_REDIRECT_URL = origin + "/bank/callback";
    const own = request.agent(app).set("X-Forwarded-For", "198.51.100.24"),
      foreign = request.agent(app).set("X-Forwarded-For", "198.51.100.25");
    const password = "test-password-12345";
    await own
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({ username: "other", password })
      .expect(200);
    const ownerUser = await db.user.findFirst({ where: { role: "OWNER" } });
    await foreign
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({ username: ownerUser.username, password })
      .expect(200);
    const uid = randomUUID(),
      session = randomUUID();
    let state = "",
      exchanges = 0,
      revoked = false;
    const stub = vi
      .spyOn(enableBanking, "request")
      .mockImplementation(async (path, method, body: any) => {
        if (path.startsWith("/aspsps"))
          return {
            aspsps: [
              {
                name: "Revolut",
                country: "CZ",
                psu_types: ["personal", "business"],
                maximum_consent_validity: 86400,
              },
            ],
          };
        if (path === "/auth") {
          state = body.state;
          expect(body.psu_type).toBe("business");
          return { url: "https://auth.enablebanking.com/ais/start?test=1" };
        }
        if (path === "/sessions") {
          exchanges++;
          return {
            session_id: session,
            access: {
              valid_until: new Date(Date.now() + 86400000).toISOString(),
            },
            accounts: [
              {
                uid,
                identification_hash: "same-account",
                currency: "CZK",
                name: "Revolut",
                account_id: { iban: "CZ00000012345678" },
              },
            ],
          };
        }
        if (method === "DELETE") {
          revoked = true;
          return {};
        }
        if (path.endsWith("/balances"))
          return {
            balances: [
              {
                balance_amount: { currency: "CZK", amount: "1000.00" },
                balance_type: "CLBD",
              },
            ],
          };
        if (path.includes("/transactions"))
          return {
            transactions: [
              {
                entry_reference: path.includes("continuation_key")
                  ? "second"
                  : "first",
                transaction_amount: {
                  amount: path.includes("continuation_key") ? "10.00" : "49.90",
                  currency: "CZK",
                },
                credit_debit_indicator: "DBIT",
                status: "BOOK",
                booking_date: "2026-11-10",
                creditor: { name: "Obchod" },
              },
            ],
            continuation_key: path.includes("continuation_key")
              ? null
              : "next-page",
          };
        throw Error("Unexpected test provider request");
      });
    try {
      await own
        .post("/api/banks/connect")
        .set("Origin", origin)
        .send({ bank: "Revolut", country: "CZ", psuType: "business" })
        .expect(200);
      await foreign
        .post("/api/banks/complete")
        .set("Origin", origin)
        .send({ code: "code", state })
        .expect(400);
      await own
        .post("/api/banks/complete")
        .set("Origin", origin)
        .send({ code: "code", state })
        .expect(200);
      await own
        .post("/api/banks/complete")
        .set("Origin", origin)
        .send({ code: "code", state })
        .expect(200);
      expect(exchanges).toBe(1);
      const c = (await own.get("/api/banks")).body.connections[0];
      expect(c.sessionSecret).toBeUndefined();
      expect(c.accounts[0].remoteSecret).toBeUndefined();
      expect(c.accounts[0].ibanMasked).toBe("•••• 5678");
      await foreign
        .post("/api/banks/" + c.id + "/sync")
        .set("Origin", origin)
        .send({})
        .expect(409);
      const sync = await Promise.all([
        own
          .post("/api/banks/" + c.id + "/sync")
          .set("Origin", origin)
          .send({}),
        own
          .post("/api/banks/" + c.id + "/sync")
          .set("Origin", origin)
          .send({}),
      ]);
      expect(sync.map((s) => s.status).sort()).toEqual([200, 409]);
      const rows = (await own.get("/api/bank-transactions")).body.rows;
      expect(rows).toHaveLength(2);
      expect(
        (await foreign.get("/api/bank-transactions")).body.rows,
      ).toHaveLength(0);
      await db.bankConnection.update({
        where: { id: c.id },
        data: { nextSyncAt: new Date(0) },
      });
      await own
        .post("/api/banks/" + c.id + "/sync")
        .set("Origin", origin)
        .send({})
        .expect(200);
      expect((await own.get("/api/bank-transactions")).body.rows).toHaveLength(
        2,
      );
      const data = (await own.get("/api/data")).body,
        item = data.items.find((i: any) => i.kind === "EXPENSE" && !i.hidden),
        row = rows.find((t: any) => t.amount === "49.90");
      await foreign
        .post("/api/bank-transactions/" + row.id + "/resolve")
        .set("Origin", origin)
        .send({ action: "IMPORT", itemId: item.id })
        .expect(404);
      const imports = await Promise.all(
        Array.from({ length: 4 }, () =>
          own
            .post("/api/bank-transactions/" + row.id + "/resolve")
            .set("Origin", origin)
            .send({ action: "IMPORT", itemId: item.id }),
        ),
      );
      expect(imports.every((r) => r.status === 200)).toBe(true);
      expect(new Set(imports.map((r) => r.body.entryId)).size).toBe(1);
      const after = (await own.get("/api/data")).body;
      expect(BigInt(after.balance)).toBe(BigInt(data.balance) - 4990n);
      const second = rows.find((t: any) => t.amount === "10.00");
      const manual = (
        await own.post("/api/entries").set("Origin", origin).send({
          itemId: item.id,
          amount: "10",
          date: "2026-11-10",
          key: randomUUID(),
        })
      ).body;
      await own
        .post("/api/bank-transactions/" + second.id + "/resolve")
        .set("Origin", origin)
        .send({ action: "LINK", entryId: manual.id })
        .expect(200);
      expect(BigInt((await own.get("/api/data")).body.balance)).toBe(
        BigInt(after.balance) - 1000n,
      );
      const foreignMoney = await db.bankTransaction
        .create({
          data: {
            userId: ownerUser.id,
            accountId: c.accounts[0].id,
            sourceKey: "foreign",
            amount: "1",
            currency: "CZK",
            kind: "EXPENSE",
            date: "2026-11-10",
            description: "test",
          },
        })
        .then(
          () => true,
          () => false,
        );
      expect(foreignMoney).toBe(false);
      await own
        .delete("/api/banks/" + c.id)
        .set("Origin", origin)
        .expect(200);
      expect(revoked).toBe(true);
      await own
        .post("/api/banks/" + c.id + "/sync")
        .set("Origin", origin)
        .send({})
        .expect(409);
      for (const project of ["desktop", "mobile"])
        await db.bankTransaction.create({
          data: {
            userId: (await db.user.findUnique({ where: { username: "other" } }))
              .id,
            accountId: c.accounts[0].id,
            sourceKey: "ui-" + project,
            amount: "20.00",
            currency: "EUR",
            kind: "EXPENSE",
            date: "2026-11-10",
            description: "Bankovní test " + project,
            uncertain: true,
          },
        });
      // Keep only synthetic, anonymized imported entries for subsequent UI tests.
    } finally {
      stub.mockRestore();
      delete process.env.BANK_DATA_KEY;
      delete process.env.BANK_REDIRECT_URL;
    }
  },
  30000,
);
