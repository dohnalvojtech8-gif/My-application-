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
  await db.budget.deleteMany();
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
    expect(entry.body.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
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
    expect(
      (await other.get("/api/data")).body.entries.find(
        (e: any) => e.id === entry.body.id,
      ).createdAt,
    ).toBe(entry.body.createdAt);
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

suite(
  "více účtů: izolace, atomické převody, opakování, widgety a obnova",
  async () => {
    const password = "test-password-12345";
    const ownerUser = await db.user.findFirst({ where: { role: "OWNER" } });
    const admin = request.agent(app).set("X-Forwarded-For", "198.51.100.40");
    await admin
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({ username: ownerUser.username, password })
      .expect(200);
    async function account(username: string, ip: string) {
      const invitation = await admin
        .post("/api/admin/invites")
        .set("Origin", origin)
        .send({})
        .expect(200);
      const agent = request.agent(app).set("X-Forwarded-For", ip);
      await agent
        .post("/api/auth/register")
        .set("Origin", origin)
        .send({ username, password, invite: invitation.body.invite })
        .expect(201);
      await agent
        .post("/api/auth/login")
        .set("Origin", origin)
        .send({ username, password })
        .expect(200);
      return agent;
    }
    const a = await account("wallet_user", "198.51.100.41"),
      b = await account("wallet_foreign", "198.51.100.42");
    const main = (await a.get("/api/data")).body.wallets[0],
      foreign = (await b.get("/api/data")).body.wallets[0];
    const savings = (
      await a
        .post("/api/wallets")
        .set("Origin", origin)
        .send({
          name: "Spoření",
          kind: "SAVINGS",
          color: "#8b5cf6",
          opening: "1000.25",
        })
        .expect(201)
    ).body;
    const category = (
      await a
        .post("/api/items")
        .set("Origin", origin)
        .send({ name: "Test účtů", kind: "EXPENSE", color: "#e11d48" })
        .expect(200)
    ).body;
    await a
      .patch("/api/wallets/" + foreign.id)
      .set("Origin", origin)
      .send({ name: "Cizí", kind: "BANK", color: "#ffffff", opening: "0" })
      .expect(404);
    const entry = {
      itemId: category.id,
      walletId: savings.id,
      date: "2026-01-01",
      amount: "25.10",
      key: randomUUID(),
    };
    await a
      .post("/api/entries")
      .set("Origin", origin)
      .send({ ...entry, walletId: foreign.id })
      .expect(404);
    await a.post("/api/entries").set("Origin", origin).send(entry).expect(200);
    const transfer = {
      fromId: savings.id,
      toId: main.id,
      amount: "200.15",
      date: "2026-01-01",
      key: randomUUID(),
    };
    const writes = await Promise.all(
      Array.from({ length: 4 }, () =>
        a.post("/api/transfers").set("Origin", origin).send(transfer),
      ),
    );
    expect(writes.every((r) => r.status === 200)).toBe(true);
    expect(new Set(writes.map((r) => r.body.id)).size).toBe(1);
    await a
      .post("/api/transfers")
      .set("Origin", origin)
      .send({ ...transfer, amount: "201" })
      .expect(409);
    await a
      .post("/api/transfers")
      .set("Origin", origin)
      .send({ ...transfer, key: randomUUID(), toId: foreign.id })
      .expect(404);
    await a
      .post("/api/transfers")
      .set("Origin", origin)
      .send({ ...transfer, key: randomUUID(), toId: savings.id })
      .expect(400);
    let data = (await a.get("/api/data")).body;
    expect(data.balance).toBe("97515");
    expect(data.entries).toHaveLength(1);
    expect(data.transfers).toHaveLength(1);
    expect(data.wallets.find((w: any) => w.id === savings.id).balance).toBe(
      "77500",
    );
    expect(data.wallets.find((w: any) => w.id === main.id).balance).toBe(
      "20015",
    );
    expect(
      (await admin.get("/api/data")).body.wallets.some(
        (w: any) => w.id === savings.id,
      ),
    ).toBe(false);
    const user = await db.user.findUnique({
      where: { username: "wallet_user" },
    });
    await expect(
      db.entry.create({
        data: {
          userId: user.id,
          walletId: foreign.id,
          itemId: category.id,
          amount: 1n,
          status: "DONE",
          date: "2026-01-01",
          key: randomUUID(),
        },
      }),
    ).rejects.toThrow();
    const series = (
      await a
        .post("/api/series")
        .set("Origin", origin)
        .send({
          walletId: savings.id,
          itemId: category.id,
          amount: "10",
          start: "2026-11-10",
          frequency: "MONTHLY",
          interval: 1,
          count: 3,
        })
        .expect(200)
    ).body;
    await a
      .post("/api/series/generate")
      .set("Origin", origin)
      .send({ horizon: "2027-02-01" })
      .expect(200);
    const generated = (await a.get("/api/data")).body.entries.filter(
      (e: any) => e.seriesId === series.id,
    );
    expect(generated).toHaveLength(3);
    expect(generated.every((e: any) => e.walletId === savings.id)).toBe(true);
    const action = (
      await a
        .post("/api/quick-actions")
        .set("Origin", origin)
        .send({
          name: "Z účtu",
          itemId: category.id,
          walletId: savings.id,
          amount: "5",
          mode: "DIRECT",
        })
        .expect(200)
    ).body;
    const device = (
      await a
        .post("/api/widget-devices")
        .set("Origin", origin)
        .send({ name: "Test", password, showBalance: true })
        .expect(200)
    ).body;
    await request(app)
      .post("/api/widget/actions/" + action.id)
      .set("Authorization", "Bearer " + device.token)
      .send({ requestId: randomUUID() })
      .expect(200);
    data = (await a.get("/api/data")).body;
    expect(data.balance).toBe("97015");
    expect(
      data.entries.find((e: any) => e.comment === "Widget · Z účtu").walletId,
    ).toBe(savings.id);
    const snap = await request(app)
      .get("/api/widget/snapshot")
      .set("Authorization", "Bearer " + device.token)
      .expect(200);
    expect(snap.body.balance).toBe(data.balance);
    const backup = (await a.get("/api/backup")).body;
    await b.post("/api/restore").set("Origin", origin).send(backup).expect(200);
    const restored = (await b.get("/api/data")).body;
    expect(restored.balance).toBe(data.balance);
    expect(restored.transfers).toHaveLength(1);
    expect(restored.wallets).toHaveLength(2);
    expect(restored.series).toHaveLength(1);
    expect(restored.wallets.map((w: any) => w.id)).not.toContain(savings.id);
    await b
      .post("/api/series/generate")
      .set("Origin", origin)
      .send({ horizon: "2027-02-01" })
      .expect(200);
    expect((await b.get("/api/data")).body.entries).toHaveLength(
      data.entries.length,
    );
    await a
      .post("/api/wallets/" + savings.id + "/archive")
      .set("Origin", origin)
      .send({ archived: true })
      .expect(200);
    expect((await a.get("/api/data")).body.balance).toBe("97015");
    await a
      .post("/api/entries")
      .set("Origin", origin)
      .send({ ...entry, key: randomUUID() })
      .expect(404);
    await request(app)
      .post("/api/widget/actions/" + action.id)
      .set("Authorization", "Bearer " + device.token)
      .send({ requestId: randomUUID() })
      .expect(404);
    await a
      .post("/api/wallets/" + main.id + "/archive")
      .set("Origin", origin)
      .send({ archived: true })
      .expect(400);
    await a
      .post("/api/wallets/" + savings.id + "/archive")
      .set("Origin", origin)
      .send({ archived: false })
      .expect(200);
    await a
      .delete("/api/transfers/" + writes[0].body.id)
      .set("Origin", origin)
      .expect(200);
    data = (await a.get("/api/data")).body;
    expect(data.balance).toBe("97015");
    expect(data.wallets.find((w: any) => w.id === main.id).balance).toBe("0");
  },
  20000,
);

suite(
  "migrace původního zůstatku a všech plateb zachová historii v platném výchozím účtu",
  async () => {
    const { readdirSync, readFileSync } = await import("node:fs");
    const { z } = await import("zod");
    const schema = "migration_" + randomUUID().replaceAll("-", "");
    await db.$transaction(
      async (tx: any) => {
        await tx.$executeRawUnsafe('CREATE SCHEMA "' + schema + '"');
        await tx.$executeRawUnsafe('SET LOCAL search_path TO "' + schema + '"');
        const folders = readdirSync("prisma/migrations")
          .filter((n) => /^\d/.test(n) && n <= "20261110040000_wallets")
          .sort();
        async function apply(folder: string) {
          const sql = readFileSync(
            "prisma/migrations/" + folder + "/migration.sql",
            "utf8",
          ).replace(/^--.*$/gm, "");
          for (const statement of sql
            .split(";")
            .map((s) => s.trim())
            .filter((s) => s && s !== "BEGIN" && s !== "COMMIT"))
            await tx.$executeRawUnsafe(statement);
        }
        for (const folder of folders.slice(0, -1)) await apply(folder);
        const user = randomUUID(),
          item = randomUUID(),
          entry = randomUUID(),
          series = randomUUID(),
          quick = randomUUID();
        await tx.$executeRaw`INSERT INTO "User" (id,username,password,opening) VALUES (${user},'legacy','hash',12345)`;
        await tx.$executeRaw`INSERT INTO "Item" (id,"userId",name,kind) VALUES (${item},${user},'Původní','EXPENSE')`;
        await tx.$executeRaw`INSERT INTO "Entry" (id,"userId","itemId",amount,date,status,key) VALUES (${entry},${user},${item},2345,'2026-01-01','DONE','legacy')`;
        await tx.$executeRaw`INSERT INTO "Series" (id,"userId","itemId",amount,start,frequency) VALUES (${series},${user},${item},100,'2026-01-01','MONTHLY')`;
        await tx.$executeRaw`INSERT INTO "QuickAction" (id,"userId","itemId",amount,name) VALUES (${quick},${user},${item},100,'Rychlá')`;
        await apply(folders.at(-1)!);
        const wallets = await tx.$queryRaw`SELECT * FROM "Wallet"`;
        expect(wallets).toHaveLength(1);
        expect(z.string().uuid().safeParse(wallets[0].id).success).toBe(true);
        expect(wallets[0].opening).toBe(12345n);
        const entries = await tx.$queryRaw`SELECT * FROM "Entry"`;
        expect(entries).toHaveLength(1);
        expect(entries[0].id).toBe(entry);
        expect(entries[0].amount).toBe(2345n);
        expect(entries[0].walletId).toBe(wallets[0].id);
        expect(
          (await tx.$queryRaw`SELECT "walletId" FROM "Series"`)[0].walletId,
        ).toBe(wallets[0].id);
        expect(
          (await tx.$queryRaw`SELECT "walletId" FROM "QuickAction"`)[0]
            .walletId,
        ).toBe(wallets[0].id);
        await apply("20261110050000_invite_management");
        await apply("20261110060000_entry_chronology");
        expect(
          (
            await tx.$queryRaw`SELECT "createdAt" FROM "Entry" WHERE id=${entry}`
          )[0].createdAt,
        ).toBeNull();
        await apply("20261112010000_budgets_currencies_merchants");
        expect(
          (
            await tx.$queryRaw`SELECT merchant,amount FROM "Entry" WHERE id=${entry}`
          )[0],
        ).toEqual({ merchant: "", amount: 2345n });
        expect(
          (await tx.$queryRaw`SELECT currency FROM "Wallet"`)[0].currency,
        ).toBe("CZK");
        const newEntry = randomUUID();
        await tx.$executeRaw`INSERT INTO "Entry" (id,"userId","walletId","itemId",amount,date,status,key) VALUES (${newEntry},${user},${wallets[0].id},${item},100,'2026-01-01','DONE','with-creation-time')`;
        expect(
          (
            await tx.$queryRaw`SELECT "createdAt" FROM "Entry" WHERE id=${newEntry}`
          )[0].createdAt,
        ).toBeInstanceOf(Date);
        await tx.$executeRawUnsafe('DROP SCHEMA "' + schema + '" CASCADE');
      },
      { timeout: 20000 },
    );
  },
  25000,
);

suite(
  "hromadné pozvánky: stavy, jednorázová aktivace, expirace, zrušení a oprávnění",
  async () => {
    const password = "test-password-12345";
    const ownerUser = await db.user.findFirst({ where: { role: "OWNER" } });
    const admin = request.agent(app).set("X-Forwarded-For", "198.51.100.80");
    const visitor = request.agent(app).set("X-Forwarded-For", "198.51.100.81");
    await admin
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({ username: ownerUser.username, password })
      .expect(200);
    await visitor.get("/api/admin/invites").expect(401);
    await admin
      .post("/api/admin/invites")
      .set("Origin", origin)
      .send({ count: 51 })
      .expect(400);
    await admin
      .post("/api/admin/invites")
      .set("Origin", origin)
      .send({ count: 0 })
      .expect(400);
    await admin
      .post("/api/admin/invites")
      .set("Origin", origin)
      .send({ count: 1.5 })
      .expect(400);
    await admin
      .post("/api/admin/invites")
      .set("Origin", origin)
      .send({ count: 3, hours: 999 })
      .expect(400);
    await admin.post("/api/admin/invites").send({ count: 3 }).expect(403);
    const before = new Set(
      (await admin.get("/api/admin/invites")).body.map((i: any) => i.id),
    );
    const batch = await admin
      .post("/api/admin/invites")
      .set("Origin", origin)
      .send({ count: 5, hours: 72 })
      .expect(200);
    expect(batch.body.count).toBe(5);
    const invitations = (await admin.get("/api/admin/invites")).body.filter(
      (i: any) => !before.has(i.id),
    );
    expect(invitations).toHaveLength(5);
    expect(new Set(invitations.map((i: any) => i.code)).size).toBe(5);
    expect(
      invitations.every(
        (i: any) =>
          i.status === "PENDING" && i.code.startsWith("SM-") && !i.username,
      ),
    ).toBe(true);
    expect(Date.parse(invitations[0].expires) - Date.now()).toBeGreaterThan(
      71 * 3600000,
    );
    const [used, revoked, expired, rollback, race] = invitations;
    await visitor
      .post("/api/auth/register")
      .set("Origin", origin)
      .send({
        username: "invited_new",
        password,
        invite: ` ${used.code.toLowerCase()} `,
      })
      .expect(201);
    await visitor
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({ username: "invited_new", password })
      .expect(200);
    const clean = (await visitor.get("/api/data")).body;
    expect(clean.user.role).toBe("USER");
    expect(clean.entries).toHaveLength(0);
    expect(clean.items).toHaveLength(0);
    expect(clean.balance).toBe("0");
    await visitor.get("/api/admin/invites").expect(403);
    await visitor
      .post("/api/admin/invites")
      .set("Origin", origin)
      .send({ count: 1 })
      .expect(403);
    await visitor
      .delete("/api/admin/invites/" + revoked.id)
      .set("Origin", origin)
      .expect(403);
    let list = (await admin.get("/api/admin/invites")).body;
    expect(list.find((i: any) => i.id === used.id)).toMatchObject({
      status: "ACTIVATED",
      username: "invited_new",
      code: null,
    });
    expect(
      (await db.invite.findUnique({ where: { token: used.id } })).code,
    ).toBeNull();
    await visitor
      .post("/api/auth/register")
      .set("Origin", origin)
      .send({ username: "invite_reuse", password, invite: used.code })
      .expect(400);
    await admin
      .delete("/api/admin/invites/" + used.id)
      .set("Origin", origin)
      .expect(409);
    await admin
      .delete("/api/admin/invites/" + revoked.id)
      .set("Origin", origin)
      .expect(200);
    await visitor
      .post("/api/auth/register")
      .set("Origin", origin)
      .send({ username: "invite_revoked", password, invite: revoked.code })
      .expect(400);
    await db.invite.update({
      where: { token: expired.id },
      data: { expires: new Date(Date.now() - 1000) },
    });
    await visitor
      .post("/api/auth/register")
      .set("Origin", origin)
      .send({ username: "invite_expired", password, invite: expired.code })
      .expect(400);
    // A rejected duplicate username rolls back consumption of the invitation.
    await visitor
      .post("/api/auth/register")
      .set("Origin", origin)
      .send({ username: "invited_new", password, invite: rollback.code })
      .expect(409);
    expect(
      (await db.invite.findUnique({ where: { token: rollback.id } })).used,
    ).toBe(false);
    await visitor
      .post("/api/auth/register")
      .set("Origin", origin)
      .send({
        username: "invited_after_retry",
        password,
        invite: rollback.code,
      })
      .expect(201);
    const results = await Promise.all(
      ["invite_race_a", "invite_race_b"].map((username) =>
        request(app)
          .post("/api/auth/register")
          .set("X-Forwarded-For", "198.51.100.82")
          .set("Origin", origin)
          .send({ username, password, invite: race.code }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 400]);
    list = (await admin.get("/api/admin/invites")).body;
    expect(list.find((i: any) => i.id === revoked.id)).toMatchObject({
      status: "REVOKED",
      code: null,
    });
    expect(list.find((i: any) => i.id === expired.id)).toMatchObject({
      status: "EXPIRED",
      code: null,
    });
    const activated = list.find((i: any) => i.id === race.id);
    expect(activated.status).toBe("ACTIVATED");
    expect(["invite_race_a", "invite_race_b"]).toContain(activated.username);
  },
  20000,
);

suite(
  "rozpočty, deset měn, obchodníci, design a obnova s oddělením uživatelů",
  async () => {
    const password = "test-password-12345",
      owner = await db.user.findFirst({ where: { role: "OWNER" } });
    const admin = request.agent(app).set("X-Forwarded-For", "198.51.100.101");
    await admin
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({ username: owner.username, password })
      .expect(200);
    async function createUser(username: string, ip: string) {
      const invite = (
        await admin
          .post("/api/admin/invites")
          .set("Origin", origin)
          .send({})
          .expect(200)
      ).body.invite;
      const agent = request.agent(app).set("X-Forwarded-For", ip);
      await agent
        .post("/api/auth/register")
        .set("Origin", origin)
        .send({ username, password, invite })
        .expect(201);
      await agent
        .post("/api/auth/login")
        .set("Origin", origin)
        .send({ username, password })
        .expect(200);
      return agent;
    }
    const a = await createUser("currencies_user", "198.51.100.102"),
      b = await createUser("currencies_restore", "198.51.100.103");
    const main = (await a.get("/api/data")).body.wallets[0];
    const wallets: any[] = [main];
    for (const currency of [
      "EUR",
      "USD",
      "GBP",
      "CHF",
      "PLN",
      "HUF",
      "SEK",
      "NOK",
      "DKK",
    ]) {
      const w = await a
        .post("/api/wallets")
        .set("Origin", origin)
        .send({
          name: currency,
          kind: "BANK",
          color: "#123456",
          currency,
          opening: "100.25",
        })
        .expect(201);
      wallets.push(w.body);
    }
    const eur = wallets[1];
    let data = (await a.get("/api/data")).body;
    expect(data.balance).toBe("0");
    expect(data.balancesByCurrency.EUR).toBe("10025");
    expect(data.balancesByCurrency.USD).toBe("10025");
    await a
      .patch("/api/wallets/" + eur.id)
      .set("Origin", origin)
      .send({ ...eur, currency: "USD", opening: "100.25" })
      .expect(400);
    const category = (
      await a
        .post("/api/items")
        .set("Origin", origin)
        .send({ name: "Nákupy", kind: "EXPENSE", color: "#123456" })
        .expect(200)
    ).body;
    const entry = {
      walletId: eur.id,
      itemId: category.id,
      date: "2026-11-10",
      amount: "30.10",
      merchant: "Action",
      key: randomUUID(),
    };
    const payment = (
      await a.post("/api/entries").set("Origin", origin).send(entry).expect(200)
    ).body;
    await a
      .patch("/api/entries/" + payment.id)
      .set("Origin", origin)
      .send({ ...entry, walletId: main.id })
      .expect(400);
    const budget = {
      amount: "50",
      paymentLimit: "20",
      period: "MONTHLY",
      warningPercent: 80,
      enabled: true,
    };
    await a
      .put("/api/wallets/" + eur.id + "/budget")
      .set("Origin", origin)
      .send(budget)
      .expect(200);
    await a
      .put("/api/wallets/" + eur.id + "/budget")
      .set("Origin", origin)
      .send({ ...budget, amount: "0" })
      .expect(400);
    await a
      .put("/api/wallets/" + eur.id + "/budget")
      .set("Origin", origin)
      .send({ ...budget, warningPercent: 101 })
      .expect(400);
    await a
      .put("/api/wallets/" + eur.id + "/budget")
      .send(budget)
      .expect(403);
    for (const stranger of [admin, b]) {
      await stranger
        .put("/api/wallets/" + eur.id + "/budget")
        .set("Origin", origin)
        .send(budget)
        .expect(404);
      await stranger
        .delete("/api/wallets/" + eur.id + "/budget")
        .set("Origin", origin)
        .expect(404);
      expect((await stranger.get("/api/data")).body.budgets).not.toContainEqual(
        expect.objectContaining({ walletId: eur.id }),
      );
    }
    const transfer = {
      fromId: main.id,
      toId: eur.id,
      amount: "2500",
      receivedAmount: "100",
      date: "2026-11-10",
      key: randomUUID(),
    };
    await a
      .post("/api/transfers")
      .set("Origin", origin)
      .send({ ...transfer, receivedAmount: undefined })
      .expect(400);
    const writes = await Promise.all(
      [1, 2].map(() =>
        a
          .post("/api/transfers")
          .set("Origin", origin)
          .send(transfer)
          .expect(200),
      ),
    );
    expect(writes[0].body.id).toBe(writes[1].body.id);
    await a
      .post("/api/transfers")
      .set("Origin", origin)
      .send({ ...transfer, receivedAmount: "101" })
      .expect(409);
    data = (await a.get("/api/data")).body;
    expect(data.balancesByCurrency.CZK).toBe("-250000");
    expect(data.balancesByCurrency.EUR).toBe("17015");
    expect(data.entries[0].merchant).toBe("Action");
    expect(data.budgets[0].amount).toBe("5000");
    const series = (
      await a
        .post("/api/series")
        .set("Origin", origin)
        .send({
          walletId: eur.id,
          itemId: category.id,
          amount: "1",
          start: "2026-11-20",
          frequency: "MONTHLY",
          interval: 1,
          count: 1,
          merchant: "Lidl",
        })
        .expect(200)
    ).body;
    await a
      .post("/api/series/generate")
      .set("Origin", origin)
      .send({ horizon: "2026-11-30" })
      .expect(200);
    expect(
      (await a.get("/api/data")).body.entries.find(
        (e: any) => e.seriesId === series.id,
      ).merchant,
    ).toBe("Lidl");
    const action = (
      await a
        .post("/api/quick-actions")
        .set("Origin", origin)
        .send({
          walletId: eur.id,
          itemId: category.id,
          name: "Káva EUR",
          amount: "2",
          merchant: "Kavárna",
          mode: "DIRECT",
        })
        .expect(200)
    ).body;
    const device = (
      await a
        .post("/api/widget-devices")
        .set("Origin", origin)
        .send({ name: "Test EUR", password, showBalance: true })
        .expect(200)
    ).body;
    const snapshot = (
      await request(app)
        .get("/api/widget/snapshot")
        .set("Authorization", "Bearer " + device.token)
        .expect(200)
    ).body;
    expect(snapshot.balance).toBe("-250000");
    expect(snapshot.currency).toBe("CZK");
    expect(snapshot.actions[0].currency).toBe("EUR");
    await request(app)
      .post("/api/widget/actions/" + action.id)
      .set("Authorization", "Bearer " + device.token)
      .send({ requestId: randomUUID() })
      .expect(200);
    expect(
      (await a.get("/api/data")).body.entries.find(
        (e: any) => e.merchant === "Kavárna",
      ).amount,
    ).toBe("200");
    const { defaultDesign } = await import("../apps/shared/design");
    const design = {
      ...defaultDesign,
      theme: "dark",
      accent: "#7655c6",
      showChart: false,
    };
    await a
      .put("/api/preferences/design")
      .set("Origin", origin)
      .send({ ...design, accent: "url(javascript:alert(1))" })
      .expect(400);
    await a
      .put("/api/preferences/design")
      .set("Origin", origin)
      .send(design)
      .expect(200);
    await a
      .put("/api/preferences")
      .set("Origin", origin)
      .send({ incomeMode: "grid" })
      .expect(200);
    expect((await a.get("/api/data")).body.user.preferences).toMatchObject({
      incomeMode: "grid",
      design,
    });
    expect(
      (await b.get("/api/data")).body.user.preferences?.design,
    ).toBeUndefined();
    const backup = (await a.get("/api/backup")).body;
    expect(backup.version).toBe(3);
    await b
      .post("/api/restore")
      .set("Origin", origin)
      .send({
        ...backup,
        transfers: backup.transfers.map((t: any) => ({
          ...t,
          receivedAmount: null,
        })),
      })
      .expect(400);
    await b.post("/api/restore").set("Origin", origin).send(backup).expect(200);
    const restored = (await b.get("/api/data")).body;
    expect(restored.balancesByCurrency).toEqual(
      (await a.get("/api/data")).body.balancesByCurrency,
    );
    expect(restored.budgets[0].amount).toBe("5000");
    expect(restored.budgets[0].walletId).not.toBe(eur.id);
    expect(restored.entries.some((e: any) => e.merchant === "Action")).toBe(
      true,
    );
    await a
      .delete("/api/wallets/" + eur.id + "/budget")
      .set("Origin", origin)
      .expect(200);
    expect((await a.get("/api/data")).body.budgets).toHaveLength(0);
  },
  30000,
);
