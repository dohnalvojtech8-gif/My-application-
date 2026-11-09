import { test, expect } from "@playwright/test";
test("přihlášení a responzivní finanční obrazovky", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "◈ SYSTEMATIC MONEY" }),
  ).toBeVisible();
  await page.getByLabel("Uživatelské jméno").fill("other");
  await page.getByLabel("Heslo (alespoň 12 znaků)").fill("test-password-12345");
  await page.getByRole("button", { name: "Přihlásit se", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hlavní menu", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Aktuální zůstatek")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("dashboard.png"),
    fullPage: true,
  });
  await page.locator("nav").getByRole("button", { name: "Nastavení" }).click();
  await expect(
    page.getByRole("heading", { name: "Opakované platby" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.locator("nav").getByRole("button", { name: "Přehledy" }).click();
  await expect(
    page.getByRole("heading", { name: "Vývoj zůstatku" }),
  ).toBeVisible();
});
