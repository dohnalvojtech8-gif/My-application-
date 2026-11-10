import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  // These scenarios share one seeded financial account and mutate its balance/items.
  // Concurrent scenarios would change each other's selected items and assertions.
  workers: 1,
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  webServer: {
    command: "npm start",
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
  projects: [
    {
      name: "desktop",
      use: {
        viewport: { width: 1440, height: 900 },
        extraHTTPHeaders: { "X-Forwarded-For": "198.51.100.10" },
      },
    },
    {
      name: "mobile",
      use: {
        viewport: { width: 390, height: 844 },
        extraHTTPHeaders: { "X-Forwarded-For": "198.51.100.11" },
      },
    },
  ],
});
