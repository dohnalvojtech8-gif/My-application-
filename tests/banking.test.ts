import { expect, it } from "vitest";
import { generateKeyPairSync, randomBytes, verify } from "node:crypto";
import { bankJWT, seal, unseal } from "../apps/api/banking/provider";
import { normalizedTransactions } from "../apps/api/banking/sync";
it("bankovní klíče: šifrování odhalí změnu a JWT má ověřitelný podpis", () => {
  process.env.BANK_DATA_KEY = randomBytes(32).toString("hex");
  const value = seal("session-secret");
  expect(value).not.toContain("session-secret");
  expect(unseal(value)).toBe("session-secret");
  const parts = value.split(".");
  const changed = Buffer.from(parts[2], "base64url");
  changed[0] ^= 1;
  parts[2] = changed.toString("base64url");
  expect(() => unseal(parts.join("."))).toThrow();
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  process.env.BANK_PRIVATE_KEY = privateKey
    .export({ type: "pkcs8", format: "pem" })
    .toString();
  process.env.BANK_APP_ID = "test-app";
  const [head, body, signature] = bankJWT().split(".");
  expect(
    verify(
      "RSA-SHA256",
      Buffer.from(head + "." + body),
      publicKey,
      Buffer.from(signature, "base64url"),
    ),
  ).toBe(true);
  expect(JSON.parse(Buffer.from(body, "base64url").toString()).aud).toBe(
    "api.enablebanking.com",
  );
});
it("bankovní identita nepoužívá nestálé transaction_id a neztratí stejné nákupy", () => {
  const raw = {
    transaction_amount: { amount: "12.30", currency: "EUR" },
    credit_debit_indicator: "DBIT",
    status: "BOOK",
    booking_date: "2026-11-10",
    creditor: { name: "Káva" },
  };
  const rows = normalizedTransactions([raw, raw, { ...raw, status: "PDNG" }]);
  expect(rows).toHaveLength(2);
  expect(rows[0].sourceKey).not.toBe(rows[1].sourceKey);
  expect(rows.every((r) => r.uncertain)).toBe(true);
  const first = normalizedTransactions([
    { ...raw, entry_reference: "immutable", transaction_id: "one" },
  ]);
  const second = normalizedTransactions([
    { ...raw, entry_reference: "immutable", transaction_id: "two" },
  ]);
  expect(first).toEqual(second);
  expect(first[0].amount).toBe("12.30");
});
