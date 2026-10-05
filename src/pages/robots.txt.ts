import type { APIRoute } from "astro";
import { getSettings } from "../db/repository";

export const GET: APIRoute = async () => {
  const settings = await getSettings();
  const sitemap = new URL("/sitemap.xml", settings.siteUrl);
  return new Response(
    `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/admin/\nSitemap: ${sitemap}\n`,
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
};
