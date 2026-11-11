import { it, expect } from "vitest";
import sharp from "sharp";
import { brands, findBrands } from "../apps/api/catalog";

it("česká loga jsou lokální, čitelná, dohledatelná bez diakritiky a mají zdroj", async () => {
  const local = findBrands("", "cz");
  expect(local.length).toBeGreaterThanOrEqual(26);
  expect(new Set(brands.map((b) => b.slug)).size).toBe(brands.length);
  for (const query of [
    "Teddy",
    "Action",
    "Valmont",
    "Traficon",
    "DPMLJ",
    "Praha",
    "Liberec",
    "Brno",
    "Ostrava",
    "Ceska posta",
  ]) {
    expect(findBrands(query, "cz").length).toBeGreaterThan(0);
  }
  expect(
    findBrands("", "city")
      .map((b) => b.name)
      .sort(),
  ).toEqual(["Brno", "Liberec", "Ostrava", "Praha"]);
  for (const b of local) {
    expect(b.source).toMatch(/^https:\/\//);
    expect(b.license?.type).toBeTruthy();
    const m = await sharp(Buffer.from(b.image!, "base64")).metadata();
    expect(m.format).toBe("webp");
    expect(m.width).toBeGreaterThan(20);
    expect(m.height).toBeGreaterThan(10);
  }
});
