import { test as base, expect } from "@playwright/test";
import { createHash } from "node:crypto";
// Model independent clients; keep the production brute-force/API limits enabled.
export const test = base.extend({
  extraHTTPHeaders: async ({}, use, info) => {
    const id = createHash("sha256")
      .update(info.project.name + info.titlePath.join("/"))
      .digest();
    await use({ "X-Forwarded-For": `198.18.${id[0]}.${id[1]}` });
  },
});
export { expect };
