import "dotenv/config";
import { eq } from "drizzle-orm";
import {
  categories as originalCategories,
  sites as originalSites,
} from "../src/data/navLinks.js";
import { db, closeDb } from "../src/db/client";
import { categories, sites } from "../src/db/schema";
import { normalizeUrl, urlHash } from "../src/lib/validation";

try {
let importedCategories = 0;
let importedSites = 0;
for (const [index, original] of originalCategories.entries()) {
  const found = await db()
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, original.id.toLowerCase()))
    .limit(1);
  if (!found.length) {
    await db().insert(categories).values({
      name: original.name,
      slug: original.id.toLowerCase(),
      icon: original.icon,
      sortOrder: index,
    });
    importedCategories++;
  }
}
for (const [index, original] of originalSites.entries()) {
  const url = normalizeUrl(original.url);
  const hash = urlHash(url);
  const found = await db()
    .select({ id: sites.id })
    .from(sites)
    .where(eq(sites.urlHash, hash))
    .limit(1);
  if (found.length) continue;
  const category = await db()
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, original.category.toLowerCase()))
    .limit(1);
  if (!category.length) continue;
  await db()
    .insert(sites)
    .values({
      title: original.title,
      url,
      urlHash: hash,
      domain: new URL(url).hostname,
      description: original.description,
      shortDescription: original.shortDesc,
      icon: original.icon,
      categoryId: category[0].id,
      sortOrder: index,
    });
  importedSites++;
}
console.info(
  `Imported ${importedCategories} categories and ${importedSites} sites`,
);
} finally {
  await closeDb();
}
