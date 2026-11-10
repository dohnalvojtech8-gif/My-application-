import { test, expect } from "@playwright/test";
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
  await expect(dialog.getByLabel("Částka (Kč)")).toHaveValue("123.45");
  await expect(dialog.getByRole("combobox", { name: "Položka" })).toHaveValue(
    action.itemId,
  );
  const after = await (await page.request.get("/api/data")).json();
  expect(after.entries.length).toBe(before.entries.length);
  await page.request.delete("/api/quick-actions/" + action.id, {
    headers: { Origin: "http://localhost:3000" },
  });
});
