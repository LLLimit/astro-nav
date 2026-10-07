import type { APIRoute } from "astro";
import { z } from "zod";
import { sql, gte, lte, and, desc } from "drizzle-orm";
import { db } from "../../../db/client";
import { pageViews, dailyStats, sites } from "../../../db/schema";
import { audit, checkOrigin, currentAdmin } from "../../../lib/auth";
import {
  BodyTooLargeError,
  fail,
  internalError,
  ok,
  readJsonLimited,
} from "../../../lib/api";
import {
  changeSiteStatus,
  createCategory,
  createSite,
  deleteSites,
  getSettings,
  listCategories,
  listSites,
  listTagsBySite,
  pageSites,
  removeCategory,
  saveSettings,
  statsSummary,
  updateCategory,
  updateSite,
} from "../../../db/repository";
import { parseWebsite } from "../../../lib/parser";
import { saveUpload, UploadError } from "../../../lib/upload";
import { dayKey } from "../../../lib/dates";
import { isDuplicateKeyError } from "../../../lib/db-errors";

const idsSchema = z.array(z.number().int().positive()).min(1).max(500);
const idSchema = z.number().int().positive();

export const GET: APIRoute = async ({ params, cookies, url }) => {
  try {
    if (!(await currentAdmin(cookies))) return fail("请先登录", 401);
    switch (params.resource) {
      case "categories":
        return ok(await listCategories(true));
      case "sites": {
        const requestedPage = Number(url.searchParams.get("page") || 1);
        const page = Number.isFinite(requestedPage)
          ? Math.min(100000, Math.max(1, Math.trunc(requestedPage)))
          : 1;
        const query = (url.searchParams.get("q") || "").slice(0, 100);
        const requestedCategory = Number(url.searchParams.get("category") || 0);
        const category =
          Number.isInteger(requestedCategory) && requestedCategory > 0
            ? requestedCategory
            : 0;
        const status = url.searchParams.get("status") || "";
        const sort = url.searchParams.get("sort") || "order";
        const requestedIcon = url.searchParams.get("icon") || "";
        const icon = ["default", "custom"].includes(requestedIcon) ? requestedIcon : "";
        return ok(await pageSites({ page, query, category, status, sort, icon }));
      }
      case "settings":
        return ok(await getSettings());
      case "stats": {
        const requestedDays = Number(url.searchParams.get("days") || 7);
        const days = Number.isFinite(requestedDays)
          ? Math.min(90, Math.max(1, Math.trunc(requestedDays)))
          : 7;
        const today = dayKey();
        const yesterday = dayKey(1);
        const requestedStart = url.searchParams.get("start");
        const requestedEnd = url.searchParams.get("end");
        const start =
          requestedStart && /^\d{4}-\d{2}-\d{2}$/.test(requestedStart)
            ? requestedStart
            : dayKey(days - 1);
        const end =
          requestedEnd && /^\d{4}-\d{2}-\d{2}$/.test(requestedEnd)
            ? requestedEnd
            : today;
        if (
          start > end ||
          !Number.isFinite(Date.parse(start)) ||
          !Number.isFinite(Date.parse(end)) ||
          Date.parse(end) - Date.parse(start) > 365 * 86400_000
        )
          return fail("统计时间范围无效");
        const [
          summary,
          daily,
          recentDaily,
          pageDaily,
          recentPageDaily,
          pageTotal,
          uniqueVisitors,
          totalClicks,
          popular,
          devices,
          browsers,
          operatingSystems,
          countries,
          sources,
        ] = await Promise.all([
          statsSummary(),
          db()
            .select({
              date: dailyStats.date,
              count: sql<number>`sum(${dailyStats.count})`,
            })
            .from(dailyStats)
            .where(and(gte(dailyStats.date, start), lte(dailyStats.date, end)))
            .groupBy(dailyStats.date)
            .orderBy(dailyStats.date),
          db()
            .select({
              date: dailyStats.date,
              count: sql<number>`sum(${dailyStats.count})`,
            })
            .from(dailyStats)
            .where(gte(dailyStats.date, dayKey(29)))
            .groupBy(dailyStats.date),
          db()
            .select({ date: pageViews.date, count: sql<number>`count(*)` })
            .from(pageViews)
            .where(and(gte(pageViews.date, start), lte(pageViews.date, end)))
            .groupBy(pageViews.date)
            .orderBy(pageViews.date),
          db()
            .select({ date: pageViews.date, count: sql<number>`count(*)` })
            .from(pageViews)
            .where(gte(pageViews.date, dayKey(29)))
            .groupBy(pageViews.date),
          db().select({ value: sql<number>`count(*)` }).from(pageViews),
          db()
            .select({ value: sql<number>`count(distinct ${pageViews.visitorHash})` })
            .from(pageViews)
            .where(and(gte(pageViews.date, start), lte(pageViews.date, end))),
          db()
            .select({ value: sql<number>`sum(${sites.clickCount})` })
            .from(sites),
          db()
            .select({ title: sites.title, count: sites.clickCount })
            .from(sites)
            .orderBy(desc(sites.clickCount))
            .limit(10),
          db()
            .select({ name: pageViews.device, count: sql<number>`count(*)` })
            .from(pageViews)
            .where(and(gte(pageViews.date, start), lte(pageViews.date, end)))
            .groupBy(pageViews.device),
          db()
            .select({ name: pageViews.browser, count: sql<number>`count(*)` })
            .from(pageViews)
            .where(and(gte(pageViews.date, start), lte(pageViews.date, end)))
            .groupBy(pageViews.browser),
          db()
            .select({ name: pageViews.os, count: sql<number>`count(*)` })
            .from(pageViews)
            .where(and(gte(pageViews.date, start), lte(pageViews.date, end)))
            .groupBy(pageViews.os),
          db()
            .select({ name: pageViews.country, count: sql<number>`count(*)` })
            .from(pageViews)
            .where(and(gte(pageViews.date, start), lte(pageViews.date, end)))
            .groupBy(pageViews.country),
          db()
            .select({ name: pageViews.referrer, count: sql<number>`count(*)` })
            .from(pageViews)
            .where(and(gte(pageViews.date, start), lte(pageViews.date, end)))
            .groupBy(pageViews.referrer),
        ]);
        const total = Number(totalClicks[0]?.value || 0);
        const countSince = (date: string) =>
          recentDaily
            .filter((row) => row.date >= date)
            .reduce((sum, row) => sum + Number(row.count), 0);
        const metrics = {
          today: countSince(today),
          yesterday: Number(
            recentDaily.find((row) => row.date === yesterday)?.count || 0,
          ),
          last7: countSince(dayKey(6)),
          last30: countSince(dayKey(29)),
          total,
        };
        const pageCountSince = (date: string) =>
          recentPageDaily
            .filter((row) => row.date >= date)
            .reduce((sum, row) => sum + Number(row.count), 0);
        const pageMetrics = {
          today: pageCountSince(today),
          yesterday: Number(recentPageDaily.find((row) => row.date === yesterday)?.count || 0),
          last7: pageCountSince(dayKey(6)),
          last30: pageCountSince(dayKey(29)),
          total: Number(pageTotal[0]?.value || 0),
          unique: Number(uniqueVisitors[0]?.value || 0),
        };
        return ok({
          summary,
          metrics,
          pageMetrics,
          daily,
          pageDaily,
          popular,
          devices,
          browsers,
          operatingSystems,
          countries,
          sources,
        });
      }
      case "export": {
        const rows = await listSites();
        const siteTagNames = await listTagsBySite();
        const format = url.searchParams.get("format");
        if (format === "csv") {
          const cell = (value: unknown) => {
            const plain = String(value ?? "");
            const safe = /^[=+@-]/.test(plain) ? `'${plain}` : plain;
            return `"${safe.replaceAll('"', '""')}"`;
          };
          const csv = [
            [
              "title",
              "url",
              "description",
              "shortDescription",
              "category",
              "icon",
              "ogImage",
              "tags",
              "featured",
              "pinned",
              "enabled",
              "sortOrder",
            ].join(","),
            ...rows.map(({ site, category }) =>
              [
                site.title,
                site.url,
                site.description,
                site.shortDescription,
                category.slug,
                site.icon,
                site.ogImage,
                siteTagNames[site.id]?.join(","),
                site.featured,
                site.pinned,
                site.enabled,
                site.sortOrder,
              ]
                .map(cell)
                .join(","),
            ),
          ].join("\r\n");
          return new Response("\uFEFF" + csv, {
            headers: {
              "Content-Type": "text/csv; charset=utf-8",
              "Content-Disposition": 'attachment; filename="nav-sites.csv"',
            },
          });
        }
        return new Response(
          JSON.stringify(
            rows.map((row) => ({
              ...row,
              tags: siteTagNames[row.site.id] || [],
            })),
          ),
          {
            headers: {
              "Content-Type": "application/json",
              "Content-Disposition": 'attachment; filename="nav-sites.json"',
            },
          },
        );
      }
      default:
        return fail("未知资源", 404);
    }
  } catch (error) {
    return internalError(error);
  }
};

export const POST: APIRoute = async ({ params, request, cookies }) => {
  if (!checkOrigin(request)) return fail("请求来源无效", 403);
  try {
    const admin = await currentAdmin(cookies);
    if (!admin) return fail("请先登录", 401);
    if (params.resource === "upload") {
      if (Number(request.headers.get("content-length") || 0) > 6_000_000)
        return fail("文件过大", 413);
      const form = await request.formData();
      const file = form.get("file");
      const kind = form.get("kind");
      if (
        !(file instanceof File) ||
        !["icons", "logos", "backgrounds"].includes(String(kind))
      )
        return fail("文件类型无效");
      const path = await saveUpload(
        file,
        String(kind) as "icons" | "logos" | "backgrounds",
      );
      await audit(admin.id, "upload", path);
      return ok({ path });
    }
    if (Number(request.headers.get("content-length") || 0) > 1_000_000)
      return fail("请求过大", 413);
    const body = (await readJsonLimited(request, 1_000_000)) as Record<
      string,
      unknown
    >;
    if (params.resource === "parse") {
      try {
        return ok(await parseWebsite(z.url().parse(body.url)));
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        return fail(
          /^(不允许访问本地地址|目标地址不是公网地址|URL 不允许包含账号密码|重定向缺少地址|重定向次数过多|响应文件过大|目标不是 HTML 页面|目标网站返回 \d{3})$/.test(
            message,
          )
            ? message
            : "网站解析失败，请检查网址或手动填写信息",
        );
      }
    }
    if (params.resource === "settings") {
      const data = await saveSettings(body);
      await audit(admin.id, "settings_update");
      return ok(data);
    }
    if (params.resource === "categories") {
      if (body.action === "create") {
        const id = await createCategory(body.value);
        await audit(admin.id, "category_create", String(id));
        return ok({ id }, 201);
      }
      if (body.action === "update") {
        const id = idSchema.parse(body.id);
        await updateCategory(id, body.value);
        await audit(admin.id, "category_update", String(id));
        return ok({ id });
      }
      if (body.action === "delete") {
        const id = idSchema.parse(body.id);
        await removeCategory(
          id,
          body.moveTo ? idSchema.parse(body.moveTo) : undefined,
          body.deleteWithSites === true,
        );
        await audit(admin.id, "category_delete", String(id));
        return ok({ id });
      }
    }
    if (params.resource === "sites") {
      if (body.action === "create") {
        const id = await createSite(body.value);
        await audit(admin.id, "site_create", String(id));
        return ok({ id }, 201);
      }
      if (body.action === "update") {
        const id = idSchema.parse(body.id);
        await updateSite(id, body.value);
        await audit(admin.id, "site_update", String(id));
        return ok({ id });
      }
      if (body.action === "delete") {
        const ids = idsSchema.parse(body.ids);
        await deleteSites(ids);
        await audit(admin.id, "sites_delete", ids.join(","));
        return ok({ deleted: ids.length });
      }
      if (body.action === "status") {
        const ids = idsSchema.parse(body.ids);
        const enabled = z.boolean().parse(body.enabled);
        await changeSiteStatus(ids, enabled);
        await audit(admin.id, "sites_status", `${ids.length}:${enabled}`);
        return ok({ changed: ids.length });
      }
      if (body.action === "import") {
        const values = z.array(z.unknown()).max(100).parse(body.values);
        const result = {
          success: 0,
          duplicate: 0,
          failed: 0,
          errors: [] as string[],
          items: [] as {
            status: "success" | "duplicate" | "failed";
            reason?: string;
          }[],
        };
        for (const value of values) {
          try {
            await createSite(value);
            result.success++;
            result.items.push({ status: "success" });
          } catch (error) {
            if (isDuplicateKeyError(error)) {
              result.duplicate++;
              result.items.push({ status: "duplicate" });
            } else {
              result.failed++;
              const reason =
                error instanceof z.ZodError ? error.issues[0]?.message || "输入内容无效" : "导入失败";
              result.errors.push(reason);
              result.items.push({ status: "failed", reason });
            }
          }
        }
        await audit(
          admin.id,
          "sites_import",
          JSON.stringify({
            success: result.success,
            duplicate: result.duplicate,
            failed: result.failed,
          }),
        );
        return ok(result);
      }
    }
    return fail("未知操作", 404);
  } catch (error) {
    if (error instanceof BodyTooLargeError) return fail("请求过大", 413);
    if (error instanceof UploadError) return fail(error.message);
    if (error instanceof SyntaxError) return fail("输入内容无效");
    if (error instanceof z.ZodError) {
      const fields: Record<string, string> = {
        name: "分类名称", slug: "分类标识", siteUrl: "网站 URL", url: "网址",
        title: "名称", description: "描述", backgroundValue: "壁纸地址或颜色",
        defaultTheme: "默认主题", categoryId: "分类", newPassword: "新密码",
        sortOrder: "排序", parentId: "上级分类",
      };
      const issue = error.issues[0];
      const field = String(issue?.path.at(-1) || "输入内容");
      return fail(`${fields[field] || field}不符合要求：${issue?.message || "请检查格式"}`);
    }
    if (
      error instanceof Error &&
      [
        "此分类有网站，请先选择目标分类或确认一并删除",
        "目标分类不能相同",
        "目标分类不存在",
        "分类不存在",
        "上级分类不存在",
        "只能添加两级分类，请选择一级分类作为上级",
        "不能选择自己作为上级分类",
        "此一级分类已有二级分类，不能改为二级分类",
        "此一级分类包含二级分类，请先移动或删除二级分类",
      ].includes(error.message)
    )
      return fail(error.message);
    if (isDuplicateKeyError(error))
      return fail("相同的网址或分类标识已存在，请检查后重试", 409);
    return internalError(error);
  }
};
