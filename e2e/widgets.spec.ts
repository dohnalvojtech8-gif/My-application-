import { test, expect } from "./fixtures";
test("rychlá akce widgetu otevře předvyplněný formulář bez automatického zaúčtování", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.getByLabel("Uživatelské jméno").fill("other");
  await page.getByLabel("Heslo (alespoň 12 znaků)").fill("test-password-12345");
  await page.getByRole("button", { name: "Přihlásit se", exact: true }).click();
  await page.locator("nav").getByRole("button", { name: "Nastavení" }).click();
  await page
    .locator("summary")
    .filter({ hasText: "Widgety a rychlé akce" })
    .click();
  const name = "Widget " + info.project.name;
  await page.getByLabel("Název rychlé akce").fill(name);
  await page.getByLabel("Přednastavená částka").fill("123.45");
  await page.getByRole("button", { name: "Přidat rychlou akci" }).click();
  await expect(
    page.getByText("Rychlá akce uložena.", { exact: false }),
  ).toBeVisible();
  const actions = await (await page.request.get("/api/quick-actions")).json();
  const action = actions.find((a: any) => a.name === name);
  const before = await (await page.request.get("/api/data")).json();
  await page.goto("/?action=" + action.id);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Částka (CZK)")).toHaveValue("123.45");
  await expect(dialog.getByRole("combobox", { name: "Položka" })).toHaveValue(
    action.itemId,
  );
  const after = await (await page.request.get("/api/data")).json();
  expect(after.entries.length).toBe(before.entries.length);
  await page.request.delete("/api/quick-actions/" + action.id, {
    headers: { Origin: "http://localhost:3000" },
  });
});

test("tlačítka příjem a výdaj otevřou správný list bez zápisu", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Uživatelské jméno").fill("other");
  await page.getByLabel("Heslo (alespoň 12 znaků)").fill("test-password-12345");
  await page.getByRole("button", { name: "Přihlásit se", exact: true }).click();
  await expect(page.locator("nav")).toBeVisible();
  const before = await (await page.request.get("/api/data")).json();
  for (const [kind, heading] of [
    ["INCOME", "Nový příjem"],
    ["EXPENSE", "Nový výdaj"],
  ]) {
    await page.goto("/?quick=" + kind);
    await expect(
      page.getByRole("dialog").getByRole("heading", { name: heading }),
    ).toBeVisible();
  }
  expect(
    (await (await page.request.get("/api/data")).json()).entries.length,
  ).toBe(before.entries.length);
});

test("panel widgetu zachová deset pozic a prohodí pořadí řádků", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Uživatelské jméno").fill("other");
  await page.getByLabel("Heslo (alespoň 12 znaků)").fill("test-password-12345");
  await page.getByRole("button", { name: "Přihlásit se", exact: true }).click();
  await page.locator("nav").getByRole("button", { name: "Nastavení" }).click();
  await page
    .locator("summary")
    .filter({ hasText: "Widgety a rychlé akce" })
    .click();
  const panel = page.getByRole("region", { name: "Panel deseti plateb" });
  await expect(panel.getByRole("combobox")).toHaveCount(11);
  await panel.getByLabel("Pořadí řádků").selectOption("false");
  await panel.getByRole("button", { name: "Uložit panel widgetu" }).click();
  await expect(panel.getByRole("status")).toContainText("Panel uložen");
  await page.reload();
  await page.locator("nav").getByRole("button", { name: "Nastavení" }).click();
  await page
    .locator("summary")
    .filter({ hasText: "Widgety a rychlé akce" })
    .click();
  await expect(panel.getByLabel("Pořadí řádků")).toHaveValue("false");
  await expect(panel.locator("legend").first()).toHaveText("Výdaje");
  await panel.getByLabel("Pořadí řádků").selectOption("true");
  await expect(panel.locator("legend").first()).toHaveText("Příjmy");
});
