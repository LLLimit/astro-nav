import type { APIRoute } from "astro";
import { z } from "zod";
import { createHmac } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { sites, visits, dailyStats, pageViews } from "../../db/schema";
import { getSettings } from "../../db/repository";
import {
  BodyTooLargeError,
  fail,
  internalError,
  ok,
  readJsonLimited,
} from "../../lib/api";
import { checkOrigin } from "../../lib/auth";
import { geoProvider } from "../../lib/geo";
import { dayKey } from "../../lib/dates";
import { isDuplicateKeyError } from "../../lib/db-errors";

function classify(ua: string) {
  const device = /iPad|Tablet/i.test(ua)
    ? "Tablet"
    : /Mobile|Android|iPhone/i.test(ua)
      ? "Mobile"
      : "Desktop";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Firefox\//.test(ua)
      ? "Firefox"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Safari\//.test(ua)
          ? "Safari"
          : "Other";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad/.test(ua)
        ? "iOS"
        : /Mac OS/.test(ua)
          ? "macOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "Other";
  return { device, browser, os };
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (!checkOrigin(request) && request.headers.get("sec-fetch-site") !== "same-origin")
    return fail("请求来源无效", 403);
  try {
    if (Number(request.headers.get("content-length") || 0) > 1000)
      return fail("请求过大", 413);
    const { type, siteId, referrer: source } = z
      .object({
        type: z.enum(["pageview", "click"]).optional(),
        siteId: z.number().int().positive().optional(),
        referrer: z.string().max(512).default(""),
      })
      .parse(await readJsonLimited(request, 1000));
    if (!(await getSettings()).enableAnalytics) return ok({ recorded: false });
    const eventType = type || (siteId ? "click" : "pageview");
    if (eventType === "click") {
      if (!siteId) return fail("网站 ID 缺失");
      const site = await db()
        .select({ id: sites.id })
        .from(sites)
        .where(and(eq(sites.id, siteId), eq(sites.enabled, true)))
        .limit(1);
      if (!site.length) return fail("网站不存在", 404);
    }
    const secret = process.env.IP_HASH_SECRET;
    if (!secret || secret.length < 16) throw new Error("IP_HASH_SECRET 未配置");
    const ip =
      process.env.TRUST_PROXY === "true"
        ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          clientAddress
        : clientAddress;
    const ua = request.headers.get("user-agent") || "";
    const ipHash = createHmac("sha256", secret)
      .update(`${ip || "unknown"}\n${ua.slice(0, 500)}`)
      .digest("hex");
    const referrer = source
      ? (() => {
          try {
            return new URL(source).hostname.slice(0, 512);
          } catch {
            return "Direct";
          }
        })()
      : "Direct";
    const today = dayKey();
    let geo = { country: "Unknown", region: "Unknown" };
    try {
      geo = await geoProvider().lookup(request, ip);
    } catch {
      /* Geo lookup is optional. */
    }
    if (eventType === "pageview") {
      await db().insert(pageViews).values({
        date: today,
        visitorHash: ipHash,
        referrer,
        ...classify(ua),
        ...geo,
      });
      return ok({ recorded: true, type: "pageview" });
    }
    const dedupeKey = createHmac("sha256", secret)
      .update(`${siteId}:${ipHash}:${Math.floor(Date.now() / 300_000)}`)
      .digest("hex");
    try {
      await db().transaction(async (tx) => {
        await tx.insert(visits).values({
          siteId: siteId!,
          ipHash,
          dedupeKey,
          referrer,
          ...classify(ua),
          ...geo,
        });
        await tx
          .update(sites)
          .set({ clickCount: sql`${sites.clickCount} + 1` })
          .where(eq(sites.id, siteId!));
        await tx
          .insert(dailyStats)
          .values({ siteId: siteId!, date: today, count: 1 })
          .onDuplicateKeyUpdate({
            set: { count: sql`${dailyStats.count} + 1` },
          });
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) return ok({ recorded: false });
      throw error;
    }
    return ok({ recorded: true });
  } catch (error) {
    if (error instanceof BodyTooLargeError) return fail("请求过大", 413);
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return fail("参数无效");
    return internalError(error);
  }
};
