import { test, expect } from "./fixtures";
test("rozpočet EUR, obchodníci, tři analýzy a uložený vzhled", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.getByLabel("Uživatelské jméno").fill("wallet_user");
  await page.getByLabel("Heslo (alespoň 12 znaků)").fill("test-password-12345");
  await page.getByRole("button", { name: "Přihlásit se", exact: true }).click();
  await expect(page.locator("nav")).toBeVisible();
  const before = await (await page.request.get("/api/data")).json();
  await page.locator("nav").getByRole("button", { name: "Nastavení" }).click();
  await page
    .locator("summary")
    .filter({ has: page.locator("span", { hasText: /^Finanční účty$/ }) })
    .click();
  await page.getByRole("button", { name: "Nový účet", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const name = "Euro rozpočet " + info.project.name + " " + Date.now();
  await dialog.getByLabel("Název účtu").fill(name);
  await dialog.getByLabel("Měna účtu").selectOption("EUR");
  await dialog.getByLabel("Počáteční zůstatek účtu").fill("1000");
  await dialog.getByRole("button", { name: "Uložit účet" }).click();
  await expect(dialog).toHaveCount(0);
  const wallet = (
    await (await page.request.get("/api/data")).json()
  ).wallets.find((w: any) => w.name === name);
  const headers = { Origin: "http://localhost:3000" };
  const itemResponse = await page.request.post("/api/items", {
    headers,
    data: {
      name: "Nákupy EUR " + info.project.name,
      kind: "EXPENSE",
      color: "#123456",
    },
  });
  expect(itemResponse.ok()).toBeTruthy();
  const item = await itemResponse.json();
  for (let n = 1; n <= 6; n++) {
    const response = await page.request.post("/api/entries", {
      headers,
      data: {
        walletId: wallet.id,
        itemId: item.id,
        date: `2026-10-${String(n).padStart(2, "0")}`,
        amount: n === 6 ? "40" : "10",
        merchant: n === 2 ? "ACTION" : "Action",
        key: crypto.randomUUID(),
      },
    });
    expect(response.ok()).toBeTruthy();
  }
  await page.reload();
  await page.locator("nav").getByRole("button", { name: "Nastavení" }).click();
  await page.locator("#budget-settings>summary").click();
  const budgets = page.locator("#budget-settings");
  await budgets.getByLabel("Účet pro rozpočet").selectOption(wallet.id);
  await budgets.getByLabel("Rozpočet (EUR)", { exact: true }).fill("100");
  await budgets.getByLabel("Limit jedné platby (EUR)").fill("30");
  await budgets.getByRole("button", { name: "Uložit rozpočet" }).click();
  await expect(budgets.getByRole("status")).toHaveText("Rozpočet uložen.");
  const appearance = page
    .locator("details")
    .filter({
      has: page.locator("summary>span", { hasText: "Vzhled a ovládací panel" }),
    });
  await appearance.locator("summary").click();
  await appearance
    .getByRole("combobox", { name: "Motiv", exact: true })
    .selectOption("dark");
  await appearance.getByLabel("Rohy karet").selectOption("soft");
  await appearance.getByLabel("Rozestupy").selectOption("compact");
  await appearance.getByRole("button", { name: "Akcent #7655c6" }).click();
  await appearance.getByRole("button", { name: "Uložit vzhled" }).click();
  await expect(appearance.getByRole("status")).toHaveText("Vzhled uložen.");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByLabel("Zobrazený finanční účet").selectOption(wallet.id);
  await expect(page.getByLabel("Měna přehledu")).toHaveValue("EUR");
  await expect(page.locator(".stats .balance")).toContainText("910,00 €");
  await page.locator("nav").getByRole("button", { name: "Přehledy" }).click();
  await page.getByRole("button", { name: "Měsíc", exact: true }).click();
  await page.getByLabel("Datum v období").fill("2026-10-10");
  await page
    .getByRole("combobox", { name: "Obchodník", exact: true })
    .selectOption("action");
  await expect(page.locator(".kpi-expense>strong")).toHaveText("90,00 €");
  await page.getByRole("tab", { name: "Rozšířené analýzy" }).click();
  await expect(
    page.getByRole("heading", { name: "Jak čerpáte své rozpočty" }),
  ).toBeVisible();
  await expect(page.locator(".budget-card")).toContainText("90 %");
  await expect(page.locator(".budget-card")).toContainText("1 překročení");
  await expect(page.locator(".extra-insights table tbody tr")).toHaveCount(1);
  await expect(page.locator(".extra-insights table tbody tr")).toContainText(
    "90,00 €",
  );
  await expect(page.locator(".extra-insights .insight-payment")).toHaveCount(1);
  await expect(page.locator(".extra-insights .insight-payment")).toContainText(
    "40,00 €",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: info.outputPath("budgets-dark.png"),
    fullPage: true,
  });
  await page.locator(".extra-insights .insight-payment").click();
  await expect(dialog.getByLabel("Obchodník (nepovinné)")).toHaveValue(
    "Action",
  );
  await dialog.getByLabel("Obchodník (nepovinné)").fill("Lidl");
  await dialog.getByRole("button", { name: "Uložit", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Obchodník", exact: true })
    .selectOption("lidl");
  await page.getByRole("tab", { name: "Transakce", exact: true }).click();
  await expect(page.locator(".report-transaction")).toHaveCount(1);
  await expect(page.locator(".report-transaction")).toContainText("Lidl");
  const data = await (await page.request.get("/api/data")).json();
  expect(data.balance).toBe(before.balance);
  await page.locator("nav").getByRole("button", { name: "Nastavení" }).click();
  await appearance.locator("summary").click();
  await appearance.getByRole("button", { name: "Výchozí vzhled" }).click();
  await appearance.getByRole("button", { name: "Uložit vzhled" }).click();
  await expect(appearance.getByRole("status")).toHaveText("Vzhled uložen.");
});
