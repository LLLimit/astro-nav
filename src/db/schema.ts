import {
  mysqlTable,
  int,
  varchar,
  text,
  boolean,
  timestamp,
  date,
  index,
  uniqueIndex,
  primaryKey,
  json,
  type AnyMySqlColumn,
} from "drizzle-orm/mysql-core";

export const admins = mysqlTable(
  "admins",
  {
    id: int("id").autoincrement().primaryKey(),
    username: varchar("username", { length: 80 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("admins_username_uq").on(t.username)],
);

export const categories = mysqlTable(
  "categories",
  {
    id: int("id").autoincrement().primaryKey(),
    parentId: int("parent_id").references((): AnyMySqlColumn => categories.id),
    name: varchar("name", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    icon: varchar("icon", { length: 512 }),
    description: text("description"),
    sortOrder: int("sort_order", { unsigned: true }).default(0).notNull(),
    visible: boolean("visible").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    uniqueIndex("categories_slug_uq").on(t.slug),
    index("categories_order_idx").on(t.sortOrder),
    index("categories_parent_order_idx").on(t.parentId, t.sortOrder),
  ],
);

export const sites = mysqlTable(
  "sites",
  {
    id: int("id").autoincrement().primaryKey(),
    title: varchar("title", { length: 200 }).notNull(),
    url: text("url").notNull(),
    urlHash: varchar("url_hash", { length: 64 }).notNull(),
    domain: varchar("domain", { length: 255 }).notNull(),
    description: text("description"),
    shortDescription: varchar("short_description", { length: 500 }),
    icon: varchar("icon", { length: 512 }),
    ogImage: varchar("og_image", { length: 1024 }),
    categoryId: int("category_id")
      .notNull()
      .references(() => categories.id),
    sortOrder: int("sort_order", { unsigned: true }).default(0).notNull(),
    featured: boolean("featured").default(false).notNull(),
    pinned: boolean("pinned").default(false).notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    clickCount: int("click_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  },
  (t) => [
    uniqueIndex("sites_url_uq").on(t.urlHash),
    index("sites_listing_idx").on(t.enabled, t.categoryId, t.sortOrder),
    index("sites_domain_idx").on(t.domain),
  ],
);

export const tags = mysqlTable(
  "tags",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 80 }).notNull(),
  },
  (t) => [uniqueIndex("tags_name_uq").on(t.name)],
);

export const siteTags = mysqlTable(
  "site_tags",
  {
    siteId: int("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    tagId: int("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.siteId, t.tagId] })],
);

export const visits = mysqlTable(
  "visits",
  {
    id: int("id").autoincrement().primaryKey(),
    siteId: int("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
    referrer: varchar("referrer", { length: 512 }),
    device: varchar("device", { length: 30 }),
    browser: varchar("browser", { length: 30 }),
    os: varchar("os", { length: 30 }),
    country: varchar("country", { length: 100 }),
    region: varchar("region", { length: 100 }),
    ipHash: varchar("ip_hash", { length: 64 }).notNull(),
    dedupeKey: varchar("dedupe_key", { length: 64 }).notNull(),
  },
  (t) => [
    uniqueIndex("visits_dedupe_uq").on(t.dedupeKey),
    index("visits_site_time_idx").on(t.siteId, t.timestamp),
    index("visits_time_idx").on(t.timestamp),
  ],
);

export const pageViews = mysqlTable(
  "page_views",
  {
    id: int("id").autoincrement().primaryKey(),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
    date: date("date", { mode: "string" }).notNull(),
    visitorHash: varchar("visitor_hash", { length: 64 }).notNull(),
    referrer: varchar("referrer", { length: 512 }),
    device: varchar("device", { length: 30 }),
    browser: varchar("browser", { length: 30 }),
    os: varchar("os", { length: 30 }),
    country: varchar("country", { length: 100 }),
    region: varchar("region", { length: 100 }),
  },
  (t) => [
    index("page_views_date_idx").on(t.date),
    index("page_views_visitor_date_idx").on(t.visitorHash, t.date),
  ],
);

export const dailyStats = mysqlTable(
  "daily_stats",
  {
    id: int("id").autoincrement().primaryKey(),
    siteId: int("site_id")
      .notNull()
      .references(() => sites.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    count: int("count").default(0).notNull(),
  },
  (t) => [
    uniqueIndex("daily_stats_site_date_uq").on(t.siteId, t.date),
    index("daily_stats_date_idx").on(t.date),
  ],
);

export const settings = mysqlTable("settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: json("value").$type<unknown>().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export const sessions = mysqlTable(
  "sessions",
  {
    id: varchar("id", { length: 64 }).primaryKey(),
    adminId: int("admin_id")
      .notNull()
      .references(() => admins.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("sessions_expiry_idx").on(t.expiresAt)],
);

export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  adminId: int("admin_id").references(() => admins.id, {
    onDelete: "set null",
  }),
  action: varchar("action", { length: 100 }).notNull(),
  detail: varchar("detail", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
