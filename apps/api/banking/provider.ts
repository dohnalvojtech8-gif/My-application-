import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createPrivateKey,
  randomBytes,
  sign,
} from "node:crypto";
import { readFileSync } from "node:fs";
import { z } from "zod";
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const amount = z.object({
  amount: z.string().regex(/^-?\d{1,18}(\.\d{1,8})?$/),
  currency: z.string().regex(/^[A-Z]{3}$/),
});
export const banksSchema = z.object({
  aspsps: z.array(
    z.object({
      name: z.string().max(200),
      country: z.string().length(2),
      psu_types: z.array(z.enum(["personal", "business"])),
      maximum_consent_validity: z.number().int().positive(),
    }),
  ),
});
export const sessionSchema = z.object({
  session_id: z.string().uuid(),
  access: z.object({ valid_until: z.iso.datetime({ offset: true }) }),
  accounts: z
    .array(
      z.object({
        uid: z.string().uuid(),
        identification_hash: z.string().min(1).max(2000),
        currency: z.string().regex(/^[A-Z]{3}$/),
        name: z.string().max(200).optional(),
        account_id: z
          .object({ iban: z.string().max(100).optional() })
          .passthrough()
          .optional(),
      }),
    )
    .max(100),
});
export const balanceSchema = z.object({
  balances: z
    .array(
      z.object({
        balance_amount: amount,
        balance_type: z.string().max(30),
        name: z.string().max(200).optional(),
        reference_date: z.string().max(30).optional(),
      }),
    )
    .max(100),
});
export const transactionsSchema = z.object({
  transactions: z
    .array(
      z.object({
        entry_reference: z.string().max(1000).nullish(),
        transaction_amount: amount,
        credit_debit_indicator: z.enum(["CRDT", "DBIT"]),
        status: z.string(),
        booking_date: z.iso.date().nullish(),
        transaction_date: z.iso.date().nullish(),
        creditor: z.object({ name: z.string().max(500).optional() }).nullish(),
        debtor: z.object({ name: z.string().max(500).optional() }).nullish(),
        remittance_information: z
          .array(z.string().max(2000))
          .max(100)
          .optional(),
      }),
    )
    .max(10000),
  continuation_key: z.string().max(10000).nullish(),
});
export type BankProvider = {
  request(path: string, method?: string, body?: unknown): Promise<unknown>;
};
export class BankError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function dataKey() {
  const key = process.env.BANK_DATA_KEY || "";
  if (!/^[a-f0-9]{64}$/i.test(key))
    throw new BankError(
      503,
      "Bankovní připojení není nastavené provozovatelem.",
    );
  return Buffer.from(key, "hex");
}
export function seal(value: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", dataKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((b) => b.toString("base64url"))
    .join(".");
}
export function unseal(value: string) {
  const [iv, tag, encrypted] = value
    .split(".")
    .map((v) => Buffer.from(v, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", dataKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    "utf8",
  );
}
function signingKey() {
  const source = process.env.BANK_PRIVATE_KEY_FILE
    ? readFileSync(process.env.BANK_PRIVATE_KEY_FILE, "utf8")
    : (process.env.BANK_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  const key = createPrivateKey(source);
  if (
    key.asymmetricKeyType !== "rsa" ||
    (key.asymmetricKeyDetails?.modulusLength || 0) < 2048
  )
    throw Error("Invalid bank signing key");
  return key;
}
export function configured() {
  try {
    dataKey();
    signingKey();
    z.string().uuid().parse(process.env.BANK_APP_ID);
    if (
      !["sandbox", "production"].includes(process.env.BANK_PROVIDER_MODE || "")
    )
      return false;
    return true;
  } catch {
    return false;
  }
}
export function bankJWT() {
  const now = Math.floor(Date.now() / 1000),
    header = Buffer.from(
      JSON.stringify({
        typ: "JWT",
        alg: "RS256",
        kid: process.env.BANK_APP_ID,
      }),
    ).toString("base64url"),
    body = Buffer.from(
      JSON.stringify({
        iss: "enablebanking.com",
        aud: "api.enablebanking.com",
        iat: now,
        exp: now + 300,
      }),
    ).toString("base64url"),
    message = header + "." + body;
  return (
    message +
    "." +
    sign("RSA-SHA256", Buffer.from(message), signingKey()).toString("base64url")
  );
}
export const enableBanking: BankProvider = {
  async request(path, method = "GET", body) {
    if (!configured())
      throw new BankError(
        503,
        "Bankovní připojení není nastavené provozovatelem.",
      );
    if (
      !/^\/(aspsps|auth|sessions|accounts)(\/|\?|$)/.test(path) ||
      path.includes("..")
    )
      throw Error("Invalid banking endpoint");
    const response = await fetch("https://api.enablebanking.com" + path, {
      method,
      redirect: "error",
      signal: AbortSignal.timeout(20000),
      headers: {
        Authorization: "Bearer " + bankJWT(),
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok)
      throw new BankError(
        response.status === 429 ? 429 : 502,
        response.status === 429
          ? "Banka dočasně omezila aktualizace. Zkuste to později."
          : "Banka nebo poskytovatel požadavek odmítli. Zkontrolujte platnost souhlasu a konfiguraci služby.",
      );
    if (response.status === 204) return {};
    const raw = await response.text();
    if (raw.length > 10000000)
      throw new BankError(502, "Odpověď banky je příliš velká.");
    return JSON.parse(raw);
  },
};
