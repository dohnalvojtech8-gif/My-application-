import * as library from "simple-icons";
import { czechBrands } from "./czech-brands.js";
export type Brand = {
  name: string;
  slug: string;
  color: string;
  path?: string;
  image?: string;
  source: string;
  license: { type: string; url?: string } | null;
  author?: string;
  aliases?: string[];
  tags?: string[];
};
const international: Brand[] = Object.values(library)
  .filter((i) => i && typeof i === "object" && "slug" in i)
  .map((i) => ({
    name: i.title,
    slug: i.slug,
    color: "#" + i.hex,
    path: i.path,
    source: i.source,
    license: i.license ?? null,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));
export const brands: Brand[] = [...czechBrands, ...international];
export const brandMap = new Map(brands.map((i) => [i.slug, i]));
const normalize = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
export function findBrands(query: string, group = "all") {
  const term = normalize(query.slice(0, 100));
  return brands.filter(
    (b) =>
      (group === "all" || b.tags?.includes(group)) &&
      normalize([b.name, b.slug, ...(b.aliases || [])].join(" ")).includes(
        term,
      ),
  );
}
