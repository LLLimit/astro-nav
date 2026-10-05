import type { APIRoute } from "astro";
import { getSettings } from "../db/repository";

export const GET: APIRoute = async () => {
  const settings = await getSettings();
  const home = new URL("/", settings.siteUrl).toString();
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${home.replaceAll("&", "&amp;")}</loc></url></urlset>`,
    { headers: { "Content-Type": "application/xml; charset=utf-8" } },
  );
};
