import * as library from "simple-icons";
export const brands = Object.values(library)
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
export const brandMap = new Map(brands.map((i) => [i.slug, i]));
