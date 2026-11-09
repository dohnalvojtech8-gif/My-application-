import { it, expect } from "vitest";
import { allowedOrigins } from "../apps/api/origin";
it("normalizuje koncové lomítko a použije důvěryhodný Render origin", () => {
  const result = allowedOrigins({
    NODE_ENV: "production",
    APP_ORIGIN: "https://custom.example/",
    RENDER_EXTERNAL_URL: "https://my-application-99m3.onrender.com",
  });
  expect(result.has("https://custom.example")).toBe(true);
  expect(result.has("https://my-application-99m3.onrender.com")).toBe(true);
  expect(result.has("https://evil.example")).toBe(false);
  expect(result.has("http://localhost:3000")).toBe(false);
});
it("nepovolí neplatný origin nebo prázdnou hlavičku", () => {
  expect(
    allowedOrigins({ NODE_ENV: "production", APP_ORIGIN: "invalid" }).size,
  ).toBe(0);
});
