import { it, expect } from "vitest";
import { occurrence } from "../apps/api/recurrence";
it("měsíční opakování ukotví poslední den a neujede po únoru", () => {
  expect(occurrence("2024-01-31", "MONTHLY", 1, 1)).toBe("2024-02-29");
  expect(occurrence("2024-01-31", "MONTHLY", 1, 2)).toBe("2024-03-31");
});
it("roční opakování přestupného dne", () =>
  expect(occurrence("2024-02-29", "YEARLY", 1, 1)).toBe("2025-02-28"));
it("vlastní týdenní interval", () =>
  expect(occurrence("2026-11-09", "WEEKLY", 2, 1)).toBe("2026-11-23"));
