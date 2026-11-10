import { test, expect } from "./fixtures";
test("editor vytvoří značkovou položku, upraví vzhled, zduplikuje a smaže", async ({
  page,
}, info) => {
  const name = "Stream " + info.project.name;
  await page.goto("/");
  await page.getByLabel("Uživatelské jméno").fill("other");
  await page.getByLabel("Heslo (alespoň 12 znaků)").fill("test-password-12345");
  await page.getByRole("button", { name: "Přihlásit se", exact: true }).click();
  await page.locator("nav").getByRole("button", { name: "Nastavení" }).click();
  await page.getByRole("button", { name: "Nová položka", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Název položky").fill(name);
  await dialog.getByLabel("Výchozí částka").fill("199.90");
  await dialog.getByLabel("Hledat ikonu nebo značku").fill("netflix");
  await dialog.getByRole("button", { name: "Netflix", exact: true }).click();
  await dialog.getByRole("tab", { name: "Barvy & karta" }).click();
  await dialog.getByRole("button", { name: "Půlnoc", exact: true }).click();
  await page.screenshot({
    path: info.outputPath("editor.png"),
    fullPage: false,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await dialog
    .getByRole("button", { name: "Uložit položku", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Upravit " + name, exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.locator("nav").getByRole("button", { name: "Nastavení" }).click();
  await page
    .getByRole("button", { name: "Upravit " + name, exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("Název položky"),
  ).toHaveValue(name);
  await expect(
    page.getByRole("dialog").getByLabel("Výchozí částka"),
  ).toHaveValue("199.9");
  await page
    .getByRole("dialog")
    .getByRole("tab", { name: "Ikona & logo" })
    .click();
  await page.getByRole("button", { name: "Univerzální", exact: true }).click();
  await page.getByLabel("Hledat ikonu nebo značku").fill("káva");
  await page.getByRole("button", { name: "Káva", exact: true }).click();
  await page
    .getByRole("button", { name: "Uložit položku", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Duplikovat " + name, exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Uložit položku", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Upravit " + name + " – kopie",
      exact: true,
    }),
  ).toBeVisible();
  for (const title of [name, name + " – kopie"]) {
    await expect(
      page.getByRole("button", { name: "Smazat " + title, exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Upravit " + title, exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Odstranit položku", exact: true })
      .click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Smazat položku", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Upravit " + title, exact: true }),
    ).toHaveCount(0);
  }
});
