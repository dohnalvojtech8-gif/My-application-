import type { PrismaClient } from "@prisma/client";
import {
  balanceSchema,
  transactionsSchema,
  unseal,
  hash,
  BankError,
  type BankProvider,
} from "./provider.js";

// A provider transaction_id is NOT stable between downloads. entry_reference is.
export function normalizedTransactions(input: unknown[]) {
  const occurrences = new Map<string, number>();
  return input.flatMap((raw) => {
    const t = transactionsSchema.shape.transactions.element.parse(raw);
    if (t.status !== "BOOK") return [];
    const date = t.booking_date || t.transaction_date;
    if (!date)
      throw new BankError(
        502,
        "Zaúčtovaná transakce nemá datum. Import nebyl dokončen.",
      );
    const amount = t.transaction_amount.amount.replace(/^-/, ""),
      currency = t.transaction_amount.currency;
    const kind = t.credit_debit_indicator === "CRDT" ? "INCOME" : "EXPENSE";
    const description = [
      kind === "INCOME" ? t.debtor?.name : t.creditor?.name,
      ...(t.remittance_information || []),
    ]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 1000);
    const fingerprint = hash(
      JSON.stringify([date, amount, currency, kind, description]),
    );
    const occurrence = occurrences.get(fingerprint) || 0;
    occurrences.set(fingerprint, occurrence + 1);
    return [
      {
        sourceKey: t.entry_reference
          ? "ref:" + hash(t.entry_reference)
          : `uncertain:${fingerprint}:${occurrence}`,
        amount,
        currency,
        kind,
        date,
        description,
        uncertain: !t.entry_reference,
      },
    ];
  });
}
export async function syncConnection(
  db: PrismaClient,
  provider: BankProvider,
  userId: string,
  id: string,
) {
  const now = new Date();
  const claim = await db.bankConnection.updateMany({
    where: {
      id,
      userId,
      status: "ACTIVE",
      validUntil: { gt: now },
      nextSyncAt: { lte: now },
      OR: [{ lockUntil: null }, { lockUntil: { lt: now } }],
    },
    data: {
      lockUntil: new Date(Date.now() + 15 * 60000),
      nextSyncAt: new Date(Date.now() + 6 * 3600000),
    },
  });
  if (!claim.count)
    throw new BankError(
      409,
      "Připojení není platné, právě se aktualizuje nebo ještě nenastal čas další aktualizace (nejvýše každých 6 hodin).",
    );
  try {
    const accounts = await db.bankAccount.findMany({
      where: { connectionId: id, userId },
    });
    for (const account of accounts) {
      const uid = encodeURIComponent(unseal(account.remoteSecret));
      const balances = balanceSchema.parse(
        await provider.request(`/accounts/${uid}/balances`),
      ).balances;
      const raw: unknown[] = [];
      let cursor: string | undefined;
      const seen = new Set<string>();
      const from = new Date(Date.now() - 90 * 86400000)
        .toISOString()
        .slice(0, 10);
      for (let page = 0; page < 100; page++) {
        const query = new URLSearchParams({
          date_from: from,
          transaction_status: "BOOK",
        });
        if (cursor) query.set("continuation_key", cursor);
        const result = transactionsSchema.parse(
          await provider.request(`/accounts/${uid}/transactions?${query}`),
        );
        raw.push(...result.transactions);
        if (raw.length > 50000)
          throw new BankError(
            502,
            "Historie překročila limit jedné synchronizace.",
          );
        if (!result.continuation_key) {
          cursor = undefined;
          break;
        }
        if (seen.has(result.continuation_key))
          throw new BankError(502, "Banka opakuje stránku transakcí.");
        seen.add(result.continuation_key);
        cursor = result.continuation_key;
      }
      if (cursor)
        throw new BankError(502, "Historii se nepodařilo načíst celou.");
      const records = normalizedTransactions(raw);
      await db.$transaction(async (tx) => {
        // A concurrent disconnect must win over an in-flight network request.
        const guard = await tx.bankConnection.updateMany({
          where: { id, userId, status: "ACTIVE" },
          data: { syncError: null },
        });
        if (!guard.count) throw new BankError(409, "Připojení bylo odpojeno.");
        await tx.bankAccount.update({
          where: { id: account.id },
          data: { balances },
        });
        if (records.length)
          await tx.bankTransaction.createMany({
            data: records.map((t) => ({ ...t, userId, accountId: account.id })),
            skipDuplicates: true,
          });
      });
    }
    await db.bankConnection.updateMany({
      where: { id, userId, status: "ACTIVE" },
      data: { syncedAt: new Date(), syncError: null },
    });
  } catch (error) {
    await db.bankConnection.updateMany({
      where: { id, userId, status: "ACTIVE" },
      data: {
        syncError:
          "Aktualizace nebyla dokončena. Dříve načtená data zůstávají zachovaná.",
        nextSyncAt: new Date(Date.now() + 3600000),
      },
    });
    throw error;
  } finally {
    await db.bankConnection.updateMany({
      where: { id, userId },
      data: { lockUntil: null },
    });
  }
}
