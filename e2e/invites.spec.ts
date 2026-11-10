import { test, expect } from "./fixtures";
import { randomUUID } from "node:crypto";

test("vlastník vytvoří více kódů a po registraci se kód změní na jméno uživatele", async ({
  page,
  browser,
}, info) => {
  const password = "test-password-12345";
  const origin = "http://localhost:3000";
  let login = await page.request.post("/api/auth/login", {
    headers: { Origin: origin },
    data: { username: "owner", password },
  });
  if (!login.ok())
    login = await page.request.post("/api/auth/login", {
      headers: { Origin: origin },
      data: { username: "racer", password },
    });
  expect(login.ok()).toBeTruthy();
  await page.goto("/");
  await page
    .locator("nav")
    .getByRole("button", { name: "Profil", exact: true })
    .click();
  const manager = page.getByRole("article", { name: "Správa pozvánek" });
  await manager.getByLabel("Počet pozvánek").fill("2");
  await manager.getByLabel("Platnost pozvánek").selectOption("72");
  await manager.getByRole("button", { name: "Vygenerovat pozvánky" }).click();
  await expect(manager.getByRole("status")).toContainText(
    "Vytvořeno pozvánek: 2",
  );
  await expect(manager.getByLabel("Stav pozvánek")).toHaveValue("ALL");
  const code = (await manager
    .locator('.invitation-row[data-status="PENDING"] code')
    .first()
    .textContent())!;
  const link = await manager.getByLabel("Odkaz pro registraci").inputValue();
  expect(link).toBe(origin + "/register");
  await page.reload();
  await page
    .locator("nav")
    .getByRole("button", { name: "Profil", exact: true })
    .click();
  await expect(manager.locator("code").filter({ hasText: code })).toBeVisible();
  const username = `invited_${info.project.name}_${randomUUID().slice(0, 8)}`;
  const visitor = await browser.newContext({
    viewport: page.viewportSize()!,
    extraHTTPHeaders: {
      "X-Forwarded-For":
        info.project.name === "mobile" ? "198.19.20.2" : "198.19.20.1",
    },
  });
  try {
    const signup = await visitor.newPage();
    await signup.goto(link);
    await expect(
      signup.getByRole("heading", { name: "Registrace přes pozvánku" }),
    ).toBeVisible();
    await signup.getByLabel("Uživatelské jméno").fill(username);
    await signup.getByLabel("Heslo (alespoň 12 znaků)").fill(password);
    await signup.getByLabel("Pozvánkový kód").fill(code);
    await signup
      .getByRole("button", { name: "Registrovat", exact: true })
      .click();
    await expect(
      signup.getByRole("heading", { name: "Hlavní menu", exact: true }),
    ).toBeVisible();
    const activated = manager.getByRole("region", {
      name: `Pozvánka pro ${username}`,
    });
    await expect(activated.getByText(username, { exact: true })).toBeVisible({ timeout: 20000 });
    await expect(
      activated.getByText("Aktivováno", { exact: true }),
    ).toBeVisible();
    await expect(manager.locator("code").filter({ hasText: code })).toHaveCount(
      0,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: info.outputPath("invitations.png"),
      fullPage: false,
    });
    await page
      .locator("nav")
      .getByRole("button", { name: "Nastavení", exact: true })
      .click();
    await page
      .locator("summary")
      .filter({ hasText: "Uživatelé a pozvánky" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Pozvánky pro nové uživatele" }),
    ).toBeVisible();
  } finally {
    await visitor.close();
  }
});
