import type { Express, RequestHandler } from "express";
import type { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { allowedOrigins } from "../origin.js";
import { cents } from "../money.js";
import {
  BankError,
  configured,
  enableBanking,
  banksSchema,
  sessionSchema,
  hash,
  seal,
  unseal,
  type BankProvider,
} from "./provider.js";
import { syncConnection } from "./sync.js";
const wrap =
  (fn: RequestHandler): RequestHandler =>
  async (q, r, next) => {
    try {
      await fn(q, r, next);
    } catch (e) {
      if (e instanceof BankError) r.status(e.status).json({ error: e.message });
      else next(e);
    }
  };
const connectionSelect = {
  id: true,
  bank: true,
  country: true,
  psuType: true,
  status: true,
  validUntil: true,
  syncedAt: true,
  nextSyncAt: true,
  syncError: true,
  createdAt: true,
} as const;
export function installBanking(
  app: Express,
  db: PrismaClient,
  provider: BankProvider = enableBanking,
) {
  app.get(
    "/api/banks",
    wrap(async (_q, r) => {
      const connections = await db.bankConnection.findMany({
        where: { userId: r.locals.user.id },
        select: {
          ...connectionSelect,
          accounts: {
            select: {
              id: true,
              name: true,
              ibanMasked: true,
              currency: true,
              balances: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      r.json({
        configured: configured(),
        mode: process.env.BANK_PROVIDER_MODE || null,
        connections,
      });
    }),
  );
  app.get(
    "/api/banks/catalog",
    wrap(async (q, r) => {
      const country = z
        .string()
        .regex(/^[A-Z]{2}$/)
        .parse(q.query.country);
      const banks = banksSchema.parse(
        await provider.request("/aspsps?country=" + country),
      ).aspsps;
      r.json(banks.filter((b) => b.country === country));
    }),
  );
  app.post(
    "/api/banks/connect",
    wrap(async (q, r) => {
      const v = z
        .object({
          bank: z.string().min(1).max(200),
          country: z.string().regex(/^[A-Z]{2}$/),
          psuType: z.enum(["personal", "business"]),
        })
        .parse(q.body);
      const bank = banksSchema
        .parse(await provider.request("/aspsps?country=" + v.country))
        .aspsps.find(
          (b) =>
            b.name === v.bank &&
            b.country === v.country &&
            b.psu_types.includes(v.psuType),
        );
      if (!bank)
        throw new BankError(
          400,
          "Banka nepodporuje vybranou zemi nebo typ účtu.",
        );
      const redirect = new URL(
        process.env.BANK_REDIRECT_URL ||
          (process.env.APP_ORIGIN || "") + "/bank/callback",
      );
      if (
        !allowedOrigins().has(redirect.origin) ||
        redirect.pathname !== "/bank/callback" ||
        redirect.search ||
        redirect.hash
      )
        throw new BankError(
          503,
          "Provozovatel musí nastavit bankovní návratovou adresu.",
        );
      const userId = r.locals.user.id;
      if (
        (await db.bankConnection.count({
          where: {
            userId,
            status: { in: ["ACTIVE", "PENDING", "EXCHANGING"] },
          },
        })) >= 20
      )
        throw new BankError(400, "Nejdříve odpojte některé staré připojení.");
      const state = randomBytes(32).toString("hex");
      const connection = await db.bankConnection.create({
        data: {
          ...v,
          userId,
          stateHash: hash(state),
          stateExpires: new Date(Date.now() + 15 * 60000),
        },
      });
      try {
        const result = z.object({ url: z.string().url() }).parse(
          await provider.request("/auth", "POST", {
            access: {
              valid_until: new Date(
                Date.now() +
                  Math.min(bank.maximum_consent_validity, 180 * 86400) * 1000,
              ).toISOString(),
            },
            aspsp: { name: v.bank, country: v.country },
            state,
            redirect_url: redirect.href,
            psu_type: v.psuType,
            language: "cs",
          }),
        );
        const target = new URL(result.url);
        if (
          target.protocol !== "https:" ||
          target.hostname !== "auth.enablebanking.com" ||
          target.username ||
          target.password
        )
          throw new BankError(
            502,
            "Poskytovatel vrátil neplatnou autorizační adresu.",
          );
        r.json({ url: target.href });
      } catch (e) {
        await db.bankConnection.update({
          where: { id: connection.id },
          data: { status: "FAILED" },
        });
        throw e;
      }
    }),
  );
  app.post(
    "/api/banks/complete",
    wrap(async (q, r) => {
      const v = z
          .object({
            code: z.string().min(1).max(2000),
            state: z.string().regex(/^[a-f0-9]{64}$/),
          })
          .parse(q.body),
        userId = r.locals.user.id;
      const connection = await db.bankConnection.findFirst({
        where: { userId, stateHash: hash(v.state) },
      });
      if (!connection)
        throw new BankError(
          400,
          "Návrat z banky nepatří tomuto účtu nebo vypršel.",
        );
      if (connection.status === "ACTIVE") return r.json({ ok: true });
      const claimed = await db.bankConnection.updateMany({
        where: {
          id: connection.id,
          userId,
          status: "PENDING",
          stateExpires: { gt: new Date() },
        },
        data: { status: "EXCHANGING" },
      });
      if (!claimed.count)
        throw new BankError(
          409,
          "Připojení již bylo zpracováno nebo vypršelo. Zahajte nové připojení.",
        );
      try {
        const session = sessionSchema.parse(
          await provider.request("/sessions", "POST", { code: v.code }),
        );
        // Save revocation capability before the account transaction, even if the latter fails.
        const stored = await db.bankConnection.updateMany({
          where: { id: connection.id, userId, status: "EXCHANGING" },
          data: {
            sessionSecret: seal(session.session_id),
            validUntil: new Date(session.access.valid_until),
          },
        });
        if (!stored.count) {
          try {
            await provider.request(
              "/sessions/" + encodeURIComponent(session.session_id),
              "DELETE",
            );
          } catch {
            await db.bankConnection.updateMany({
              where: { id: connection.id, userId },
              data: {
                status: "REVOKING",
                sessionSecret: seal(session.session_id),
                syncError: "Zopakujte odpojení u poskytovatele.",
              },
            });
          }
          throw new BankError(409, "Připojení bylo mezitím odpojeno.");
        }
        await db.$transaction(async (tx) => {
          for (const a of session.accounts) {
            const identity = hash(a.identification_hash + "|" + a.currency),
              iban = a.account_id?.iban || "";
            await tx.bankAccount.upsert({
              where: { userId_identity: { userId, identity } },
              create: {
                userId,
                connectionId: connection.id,
                identity,
                remoteSecret: seal(a.uid),
                currency: a.currency,
                name: a.name || connection.bank,
                ibanMasked: iban
                  ? "•••• " + iban.slice(-4)
                  : "Účet " + a.currency,
              },
              update: {
                connectionId: connection.id,
                remoteSecret: seal(a.uid),
                name: a.name || connection.bank,
              },
            });
          }
          const activated = await tx.bankConnection.updateMany({
            where: { id: connection.id, userId, status: "EXCHANGING" },
            data: {
              status: "ACTIVE",
              syncError: session.accounts.length
                ? null
                : "Banka nevrátila účty. U omezeného přístupu poskytovatele nejprve povolte své účty.",
            },
          });
          if (!activated.count)
            throw new BankError(409, "Připojení bylo mezitím odpojeno.");
        });
        r.json({ ok: true, accounts: session.accounts.length });
      } catch (e) {
        await db.bankConnection.updateMany({
          where: { id: connection.id, userId, status: "EXCHANGING" },
          data: { status: "FAILED" },
        });
        throw e;
      }
    }),
  );
  app.post(
    "/api/banks/:id/sync",
    wrap(async (q, r) => {
      await syncConnection(db, provider, r.locals.user.id, String(q.params.id));
      r.json({ ok: true });
    }),
  );
  app.delete(
    "/api/banks/:id",
    wrap(async (q, r) => {
      const where = { id: String(q.params.id), userId: r.locals.user.id };
      const connection = await db.bankConnection.findFirst({ where });
      if (!connection) throw new BankError(404, "Připojení neexistuje.");
      // Stop local refreshes immediately; retain the secret until remote revocation succeeds.
      await db.bankConnection.updateMany({
        where,
        data: { status: "REVOKING" },
      });
      const current = await db.bankConnection.findFirstOrThrow({ where });
      if (current.sessionSecret)
        await provider.request(
          "/sessions/" + encodeURIComponent(unseal(current.sessionSecret)),
          "DELETE",
        );
      await db.bankConnection.updateMany({
        where,
        data: { status: "REVOKED", sessionSecret: null, syncError: null },
      });
      r.json({ ok: true });
    }),
  );
  app.get(
    "/api/bank-transactions",
    wrap(async (q, r) => {
      const query = z
        .object({
          state: z
            .enum(["NEW", "IMPORTED", "LINKED", "IGNORED"])
            .default("NEW"),
          cursor: z.string().uuid().optional(),
        })
        .parse(q.query);
      const rows = await db.bankTransaction.findMany({
        where: { userId: r.locals.user.id, state: query.state },
        orderBy: { id: "asc" },
        take: 51,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
        include: { account: { select: { name: true, ibanMasked: true } } },
      });
      r.json({
        rows: rows.slice(0, 50),
        next: rows.length > 50 ? rows[49].id : null,
      });
    }),
  );
  app.post(
    "/api/bank-transactions/:id/resolve",
    wrap(async (q, r) => {
      const v = z
        .object({
          action: z.enum(["IMPORT", "LINK", "IGNORE"]),
          itemId: z.string().uuid().optional(),
          entryId: z.string().uuid().optional(),
          czkAmount: z.string().optional(),
          confirmUncertain: z.boolean().default(false),
        })
        .parse(q.body);
      const userId = r.locals.user.id,
        id = String(q.params.id);
      const result = await db.$transaction(async (tx) => {
        // Lock the row before reading it: parallel clicks cannot each create a ledger entry.
        await tx.$queryRaw`SELECT id FROM "BankTransaction" WHERE id = ${id} AND "userId" = ${userId} FOR UPDATE`;
        const t = await tx.bankTransaction.findFirst({ where: { id, userId } });
        if (!t) throw new BankError(404, "Transakce neexistuje.");
        if (t.state !== "NEW") return { ok: true, entryId: t.entryId };
        if (v.action === "IGNORE") {
          await tx.bankTransaction.update({
            where: { id },
            data: { state: "IGNORED" },
          });
          return { ok: true };
        }
        if (t.uncertain && !v.confirmUncertain)
          throw new BankError(
            400,
            "Banka neposkytla stálý identifikátor. Nejprve ověřte, zda už platba není evidovaná.",
          );
        const amount =
          t.currency === "CZK" ? cents(t.amount) : cents(v.czkAmount || "");
        if (amount <= 0n) throw new BankError(400, "Částka musí být kladná.");
        let entryId: string;
        if (v.action === "LINK") {
          if (!v.entryId)
            throw new BankError(400, "Vyberte existující platbu.");
          const entry = await tx.entry.findFirst({
            where: { id: v.entryId, userId, status: "DONE", amount },
            include: { item: true },
          });
          if (!entry || entry.item.kind !== t.kind)
            throw new BankError(
              400,
              "Platba musí patřit vám a mít stejnou částku a směr.",
            );
          if (
            await tx.bankTransaction.findFirst({ where: { entryId: entry.id } })
          )
            throw new BankError(409, "Tato platba už je spárovaná.");
          entryId = entry.id;
        } else {
          if (!v.itemId)
            throw new BankError(
              400,
              "Vyberte příjmovou nebo výdajovou položku.",
            );
          const item = await tx.item.findFirst({
            where: {
              id: v.itemId,
              userId,
              kind: t.kind,
              deletedAt: null,
              hidden: false,
            },
          });
          if (!item)
            throw new BankError(400, "Položka není dostupná nebo má jiný typ.");
          entryId = (
            await tx.entry.create({
              data: {
                userId,
                itemId: item.id,
                amount,
                date: t.date,
                status: "DONE",
                key: "bank:" + t.id,
                comment: t.description,
                itemSnapshot: {
                  name: item.name,
                  kind: item.kind,
                  color: item.color,
                },
              },
            })
          ).id;
        }
        await tx.bankTransaction.update({
          where: { id },
          data: { state: v.action === "LINK" ? "LINKED" : "IMPORTED", entryId },
        });
        return { ok: true, entryId };
      });
      r.json(result);
    }),
  );
}
