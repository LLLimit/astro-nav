import { createHash } from "node:crypto";
import { z } from "zod";

export const webUrl = z
  .url()
  .max(2048)
  .refine((value) => {
    try {
      return ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, "仅支持 HTTP 或 HTTPS");

const sortOrderInput = z.coerce.number().int("排序必须为整数").min(0, "排序不能为负数").max(4294967295, "排序值过大").default(0);

export const siteInput = z.object({
  title: z.string().trim().min(1).max(200),
  url: webUrl,
  categoryId: z.coerce.number().int().positive(),
  description: z.string().max(5000).default(""),
  shortDescription: z.string().max(500).default(""),
  icon: z.string().max(512).nullable().optional(),
  ogImage: z
    .string()
    .max(1024)
    .refine((value) => !value || webUrl.safeParse(value).success)
    .nullable()
    .optional(),
  tags: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  sortOrder: sortOrderInput,
  featured: z.boolean().default(false),
  pinned: z.boolean().default(false),
  enabled: z.boolean().default(true),
});

export const categoryInput = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]{1,120}$/),
  icon: z.string().max(512).nullable().optional(),
  description: z.string().max(2000).default(""),
  sortOrder: sortOrderInput,
  visible: z.boolean().default(true),
});

export function normalizeUrl(value: string) {
  const url = new URL(webUrl.parse(value));
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  if (
    (url.protocol === "https:" && url.port === "443") ||
    (url.protocol === "http:" && url.port === "80")
  )
    url.port = "";
  return url.toString();
}

export function urlHash(url: string) {
  return createHash("sha256").update(normalizeUrl(url)).digest("hex");
}

export function safeAsset(value: string | null | undefined) {
  if (!value) return "/images/default.svg";
  if (
    value.startsWith("/media/") ||
    value.startsWith("/icons/") ||
    value.startsWith("/images/")
  )
    return value;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol)
      ? value
      : "/images/default.svg";
  } catch {
    return "/images/default.svg";
  }
}
