import { test, expect } from "./fixtures";
test("první návštěva nabízí vytvoření vlastníka a po registraci přihlásí", async ({
  page,
}) => {
  let registered = false,
    loggedIn = false;
  await page.route("**/api/setup", (r) => r.fulfill({ json: { open: true } }));
  await page.route("**/api/data", (r) =>
    r.fulfill(
      loggedIn
        ? {
            json: {
              user: { username: "newowner", role: "OWNER", opening: "0" },
              balance: "0",
              items: [],
              entries: [],
            },
          }
        : { status: 401, json: { error: "Přihlaste se" } },
    ),
  );
  await page.route("**/api/auth/register", (r) => {
    expect(r.request().postDataJSON()).toEqual({
      username: "newowner",
      password: "new-password-123",
    });
    registered = true;
    return r.fulfill({ status: 201, json: { ok: true } });
  });
  await page.route("**/api/auth/login", (r) => {
    expect(registered).toBe(true);
    loggedIn = true;
    return r.fulfill({ json: { ok: true } });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Vytvoření hlavního účtu" }),
  ).toBeVisible();
  await expect(page.getByLabel("Pozvánka", { exact: true })).toHaveCount(0);
  await page.getByLabel("Uživatelské jméno").fill("newowner");
  await page.getByLabel("Heslo (alespoň 12 znaků)").fill("new-password-123");
  await page
    .getByRole("button", { name: "Vytvořit hlavní účet", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Hlavní menu", exact: true }),
  ).toBeVisible();
});
test("nedostupná databáze nezobrazuje zavádějící přihlášení", async ({
  page,
}) => {
  await page.route("**/api/data", (r) =>
    r.fulfill({ status: 503, json: { error: "Databáze není připravená" } }),
  );
  await page.route("**/api/setup", (r) =>
    r.fulfill({ status: 503, json: { error: "Databáze není připravená" } }),
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Aplikace není připravená" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Přihlásit se", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Zkusit znovu" }),
  ).toBeVisible();
});
