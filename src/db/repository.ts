import {
  and,
  asc,
  desc,
  eq,
  inArray,
  sql,
  like,
  or,
  type SQL,
} from "drizzle-orm";
import { db } from "./client";
import { categories, sites, settings, tags, siteTags } from "./schema";
import {
  categoryInput,
  normalizeUrl,
  siteInput,
  urlHash,
} from "../lib/validation";
import { z } from "zod";

export const siteSettingsSchema = z.object({
  name: z.string().min(1).max(100).default("LLLimit 导航站"),
  siteUrl: z.url().default("http://localhost:4321"),
  logo: z.string().max(512).default("/images/brand-lockup-black.png"),
  favicon: z.string().max(512).default("/images/brand-lockup-black.png"),
  description: z.string().max(500).default("常用网站，一触即达"),
  seoTitle: z.string().max(200).default("LLLimit 导航站"),
  seoDescription: z.string().max(500).default("常用网站，一触即达"),
  defaultTheme: z.enum(["light", "dark", "glass"]).default("light"),
  allowThemeSwitch: z.boolean().default(true),
  showDescription: z.boolean().default(true),
  showClickCount: z.boolean().default(false),
  enableAnalytics: z.boolean().default(true),
  cardLayout: z.enum(["comfortable", "compact"]).default("comfortable"),
  backgroundType: z.enum(["gradient", "color", "image"]).default("gradient"),
  backgroundValue: z.string().max(512).default(""),
  backgroundPosition: z
    .enum(["center", "top", "bottom", "left", "right"])
    .default("center"),
  backgroundSize: z.enum(["cover", "contain"]).default("cover"),
  backgroundBlur: z.number().min(0).max(30).default(0),
  backgroundBrightness: z.number().min(0.3).max(2).default(1),
  backgroundOverlay: z.number().min(0).max(0.8).default(0.12),
});
export type SiteSettings = z.infer<typeof siteSettingsSchema>;

export async function getSettings(): Promise<SiteSettings> {
  const row = await db()
    .select()
    .from(settings)
    .where(eq(settings.key, "site"))
    .limit(1);
  return siteSettingsSchema.parse(
    row[0]?.value ?? {
      siteUrl: process.env.SITE_URL || "http://localhost:4321",
    },
  );
}

export async function saveSettings(input: unknown) {
  const value = siteSettingsSchema.parse(input);
  await db()
    .insert(settings)
    .values({ key: "site", value })
    .onDuplicateKeyUpdate({ set: { value } });
  return value;
}

export async function listCategories(includeHidden = false) {
  const rows = await db()
    .select()
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.id));
  return includeHidden ? rows : rows.filter((row) => row.visible);
}

export async function createCategory(input: unknown) {
  const value = categoryInput.parse(input);
  const result = await db().insert(categories).values(value);
  return result[0].insertId;
}

export async function updateCategory(id: number, input: unknown) {
  const value = categoryInput.parse(input);
  await db().update(categories).set(value).where(eq(categories.id, id));
}

export async function removeCategory(
  id: number,
  moveTo?: number,
  deleteWithSites = false,
) {
  await db().transaction(async (tx) => {
    const matching = await tx
      .select({ id: sites.id })
      .from(sites)
      .where(eq(sites.categoryId, id))
      .limit(1);
    if (matching.length && !moveTo && !deleteWithSites)
      throw new Error("此分类有网站，请先选择目标分类或确认一并删除");
    if (moveTo === id) throw new Error("目标分类不能相同");
    if (moveTo) {
      const target = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.id, moveTo))
        .limit(1);
      if (!target.length) throw new Error("目标分类不存在");
      await tx
        .update(sites)
        .set({ categoryId: moveTo })
        .where(eq(sites.categoryId, id));
    } else if (deleteWithSites) {
      await tx.delete(sites).where(eq(sites.categoryId, id));
    }
    await tx.delete(categories).where(eq(categories.id, id));
  });
}

export async function listSites(onlyEnabled = false) {
  return db()
    .select({ site: sites, category: categories })
    .from(sites)
    .innerJoin(categories, eq(sites.categoryId, categories.id))
    .where(
      onlyEnabled
        ? and(eq(sites.enabled, true), eq(categories.visible, true))
        : undefined,
    )
    .orderBy(
      desc(sites.pinned),
      desc(sites.featured),
      asc(sites.sortOrder),
      asc(sites.id),
    );
}

export async function pageSites(options: {
  page: number;
  query: string;
  category: number;
  status: string;
  sort: string;
}) {
  const conditions: SQL[] = [];
  if (options.query) {
    const term = `%${options.query.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    conditions.push(
      or(
        like(sites.title, term),
        like(sites.url, term),
        like(sites.domain, term),
        like(sites.description, term),
      )!,
    );
  }
  if (options.category) conditions.push(eq(sites.categoryId, options.category));
  if (options.status === "1" || options.status === "0")
    conditions.push(eq(sites.enabled, options.status === "1"));
  const filter = conditions.length ? and(...conditions) : undefined;
  const order =
    options.sort === "clicks"
      ? desc(sites.clickCount)
      : options.sort === "title"
        ? asc(sites.title)
        : options.sort === "created"
          ? desc(sites.createdAt)
          : asc(sites.sortOrder);
  const [count] = await db()
    .select({ value: sql<number>`count(*)` })
    .from(sites)
    .where(filter);
  const rows = await db()
    .select({ site: sites, category: categories })
    .from(sites)
    .innerJoin(categories, eq(sites.categoryId, categories.id))
    .where(filter)
    .orderBy(order, asc(sites.id))
    .limit(30)
    .offset((options.page - 1) * 30);
  return {
    rows,
    total: Number(count.value),
    page: options.page,
    tags: await listTagsBySite(rows.map((row) => row.site.id)),
  };
}

export async function getSite(id: number) {
  const result = await db()
    .select()
    .from(sites)
    .where(eq(sites.id, id))
    .limit(1);
  return result[0];
}

async function replaceTags(siteId: number, names: string[]) {
  await db().delete(siteTags).where(eq(siteTags.siteId, siteId));
  for (const name of [...new Set(names)]) {
    await db()
      .insert(tags)
      .values({ name })
      .onDuplicateKeyUpdate({ set: { name } });
    const row = await db()
      .select({ id: tags.id })
      .from(tags)
      .where(eq(tags.name, name))
      .limit(1);
    await db().insert(siteTags).values({ siteId, tagId: row[0].id });
  }
}

export async function listTagsBySite(ids?: number[]) {
  if (ids && !ids.length) return {};
  const rows = await db()
    .select({ siteId: siteTags.siteId, name: tags.name })
    .from(siteTags)
    .innerJoin(tags, eq(siteTags.tagId, tags.id))
    .where(ids ? inArray(siteTags.siteId, ids) : undefined);
  const result: Record<number, string[]> = {};
  for (const row of rows) (result[row.siteId] ??= []).push(row.name);
  return result;
}

export async function createSite(input: unknown) {
  const value = siteInput.parse(input);
  const category = await db()
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.id, value.categoryId))
    .limit(1);
  if (!category.length) throw new Error("分类不存在");
  const url = normalizeUrl(value.url);
  const { tags: names, ...data } = value;
  const result = await db()
    .insert(sites)
    .values({
      ...data,
      url,
      urlHash: urlHash(url),
      domain: new URL(url).hostname,
    });
  await replaceTags(result[0].insertId, names);
  return result[0].insertId;
}

export async function updateSite(id: number, input: unknown) {
  const value = siteInput.parse(input);
  const category = await db()
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.id, value.categoryId))
    .limit(1);
  if (!category.length) throw new Error("分类不存在");
  const url = normalizeUrl(value.url);
  const { tags: names, ...data } = value;
  await db()
    .update(sites)
    .set({ ...data, url, urlHash: urlHash(url), domain: new URL(url).hostname })
    .where(eq(sites.id, id));
  await replaceTags(id, names);
}

export async function deleteSites(ids: number[]) {
  if (!ids.length) return;
  await db().delete(sites).where(inArray(sites.id, ids));
}

export async function changeSiteStatus(ids: number[], enabled: boolean) {
  if (!ids.length) return;
  await db().update(sites).set({ enabled }).where(inArray(sites.id, ids));
}

export async function statsSummary() {
  const [siteCount] = await db()
    .select({ value: sql<number>`count(*)` })
    .from(sites);
  const [categoryCount] = await db()
    .select({ value: sql<number>`count(*)` })
    .from(categories);
  return {
    sites: Number(siteCount.value),
    categories: Number(categoryCount.value),
  };
}
