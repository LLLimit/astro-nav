import type { APIRoute } from "astro";
import { readFile } from "node:fs/promises";
import path from "node:path";

const types: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  ico: "image/x-icon",
};
export const GET: APIRoute = async ({ params }) => {
  const parts = params.path?.split("/") || [];
  if (
    parts.length !== 2 ||
    !["icons", "logos", "backgrounds"].includes(parts[0]) ||
    !/^[a-f0-9-]{36}\.(png|jpg|webp|ico)$/.test(parts[1])
  )
    return new Response(null, { status: 404 });
  const ext = path.extname(parts[1]).slice(1);
  try {
    const bytes = await readFile(
      path.resolve(process.cwd(), "data", parts[0], parts[1]),
    );
    return new Response(bytes, {
      headers: {
        "Content-Type": types[ext],
        "Cache-Control": "public, max-age=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
};
