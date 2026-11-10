import { test, expect } from "@playwright/test";
test("bankovní přehled odděluje cizí měny a import vyžaduje kontrolu", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.getByLabel("Uživatelské jméno").fill("other");
  await page.getByLabel("Heslo (alespoň 12 znaků)").fill("test-password-12345");
  await page.getByRole("button", { name: "Přihlásit se", exact: true }).click();
  await page.locator("nav").getByRole("button", { name: "Nastavení" }).click();
  await page.locator("summary").filter({ hasText: "Bankovní účty" }).click();
  const row = page
    .locator("section.card")
    .filter({ hasText: "Bankovní test " + info.project.name });
  await expect(row).toBeVisible();
  await expect(row).toContainText("20.00 EUR");
  const before = await (await page.request.get("/api/data")).json();
  await row
    .getByLabel("Položka pro import")
    .selectOption(
      before.items.find((i: any) => i.kind === "EXPENSE" && !i.hidden).id,
    );
  await row.getByLabel("Částka pro evidenci v Kč").fill("500");
  await row
    .getByRole("button", { name: "Přidat do evidence", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Banka neposkytla stálý identifikátor" }),
  ).toBeVisible();
  await row.getByRole("checkbox").check();
  await row
    .getByRole("button", { name: "Přidat do evidence", exact: true })
    .click();
  await expect(row).toHaveCount(0);
  expect(
    BigInt((await (await page.request.get("/api/data")).json()).balance),
  ).toBe(BigInt(before.balance) - 50000n);
});
test("návrat z banky nezanechá autorizační kód v adrese", async ({ page }) => {
  await page.goto("/bank/callback?code=test-code&state=" + "a".repeat(64));
  await expect(
    page.getByRole("heading", { name: "Dokončit připojení banky" }),
  ).toBeVisible();
  expect(new URL(page.url()).search).toBe("");
  await expect(
    page.getByRole("link", { name: "Vrátit do mobilní aplikace" }),
  ).toHaveAttribute("href", /^systematicmoney:\/\/bank\?/);
});
