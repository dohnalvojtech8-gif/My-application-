import { test, expect } from "./fixtures";
async function login(page: any) {
  await page.goto("/");
  await page.getByLabel("Uživatelské jméno").fill("wallet_user");
  await page.getByLabel("Heslo (alespoň 12 znaků)").fill("test-password-12345");
  await page.getByRole("button", { name: "Přihlásit se", exact: true }).click();
  await expect(page.locator("nav")).toBeVisible();
}
test("účty a převod propojí dashboard, přehledy a kalendář bez změny celkového zůstatku", async ({
  page,
}, info) => {
  await login(page);
  const before = await (await page.request.get("/api/data")).json();
  await page.locator("nav").getByRole("button", { name: "Přehledy" }).click();
  await page.getByRole("tab", { name: "Účty", exact: true }).click();
  await page.getByRole("button", { name: "Nový účet", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const name = "Hotovost " + info.project.name;
  await dialog.getByLabel("Název účtu").fill(name);
  await dialog.getByLabel("Typ účtu").selectOption("CASH");
  await dialog.getByLabel("Počáteční zůstatek účtu").fill("500.25");
  await dialog.getByRole("button", { name: "Uložit účet" }).click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("button", { name: "Převod mezi účty", exact: true })
    .click();
  await dialog
    .getByLabel("Z účtu", { exact: true })
    .selectOption({ label: name });
  await dialog
    .getByLabel("Na účet", { exact: true })
    .selectOption({ label: "Osobní účet" });
  await dialog.getByLabel("Částka převodu (Kč)").fill("100.15");
  await dialog.getByRole("button", { name: "Provést převod" }).click();
  await expect(dialog).toHaveCount(0);
  const after = await (await page.request.get("/api/data")).json();
  expect(BigInt(after.balance)).toBe(BigInt(before.balance) + 50025n);
  const wallet = after.wallets.find((w: any) => w.name === name);
  expect(wallet.balance).toBe("40010");
  expect(after.entries.length).toBe(before.entries.length);
  await page.getByLabel("Zobrazený finanční účet").selectOption(wallet.id);
  await page
    .locator("nav")
    .getByRole("button", { name: "Hlavní menu" })
    .click();
  await expect(page.locator(".stats .balance")).toContainText(/400,10/);
  await page
    .locator("nav")
    .getByRole("button", { name: "Kalendář", exact: true })
    .click();
  await expect(page.locator(".transfer-calendar")).toContainText(name);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});
test("barevné statistiky mají procenta, filtry, detail plateb a přehled opakování", async ({
  page,
}, info) => {
  await login(page);
  const headers = { Origin: "http://localhost:3000" };
  const create = async (path: string, data: any) => {
    const r = await page.request.post("/api" + path, { headers, data });
    expect(r.ok()).toBeTruthy();
    return r.json();
  };
  const wallet = await create("/wallets", {
    name: "Analytika " + info.project.name,
    kind: "BANK",
    color: "#2563eb",
    opening: "1000",
  });
  const income = await create("/items", {
    name: "Mzda " + info.project.name,
    kind: "INCOME",
    color: "#10b981",
  });
  const food = await create("/items", {
    name: "Jídlo " + info.project.name,
    kind: "EXPENSE",
    color: "#f43f5e",
  });
  const home = await create("/items", {
    name: "Domov " + info.project.name,
    kind: "EXPENSE",
    color: "#8b5cf6",
  });
  for (const [item, amount] of [
    [income, "2000"],
    [food, "500"],
    [home, "250"],
  ] as const)
    await create("/entries", {
      walletId: wallet.id,
      itemId: item.id,
      amount,
      date: "2026-10-05",
      key: crypto.randomUUID(),
    });
  await page.reload();
  await page.locator("nav").getByRole("button", { name: "Přehledy" }).click();
  await page.getByLabel("Zobrazený finanční účet").selectOption(wallet.id);
  await page.getByRole("button", { name: "Vlastní", exact: true }).click();
  await page.getByLabel("Od data").fill("2026-10-01");
  await page.getByLabel("Do data").fill("2026-10-31");
  await expect(page.locator(".kpi-income>strong")).toContainText(/2\s?000,00/);
  await expect(page.locator(".kpi-expense>strong")).toHaveText(/750,00/);
  await expect(page.locator(".kpi-savings>strong")).toHaveText(/62,5/);
  const ledger = await (await page.request.get("/api/data")).json();
  expect(
    ledger.entries
      .filter((e: any) => e.walletId === wallet.id)
      .map((e: any) => e.item.name),
  ).toEqual([home.name, food.name, income.name]);
  await page.getByRole("tab", { name: "Transakce", exact: true }).click();
  await expect(page.locator(".report-transaction > span > b")).toHaveText([
    home.name,
    food.name,
    income.name,
  ]);
  await page.getByRole("tab", { name: "Položky", exact: true }).click();
  await expect(page.locator(".report-table")).toContainText("66,7 %");
  await page.screenshot({
    path: info.outputPath("statistics.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page
    .locator(".report-table")
    .getByRole("button", { name: "Jídlo " + info.project.name })
    .click();
  await expect(
    page.getByRole("tab", { name: "Transakce", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("button", { name: "Odstranit platbu", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Detail platby Jídlo " + info.project.name + " 2026-10-05",
      exact: true,
    })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("button", { name: "Odstranit platbu", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "× Zavřít", exact: true }).click();
  await page.getByRole("tab", { name: "Trvalé platby", exact: true }).click();
  await page.getByLabel("Zobrazený finanční účet").selectOption("ALL");
  await expect(
    page.getByRole("heading", { name: "Trvalé a opakované platby" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Spravovat opakování" }).click();
  await expect(page.getByLabel("Frekvence", { exact: true })).toBeVisible();
});
