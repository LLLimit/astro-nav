import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import ipaddr from "ipaddr.js";
import { Agent, fetch } from "undici";
import { load } from "cheerio";
import { webUrl } from "./validation";

function isPublicIp(value: string) {
  try {
    return ipaddr.process(value).range() === "unicast";
  } catch {
    return false;
  }
}

async function publicAddress(hostname: string) {
  if (
    hostname.toLowerCase() === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local")
  )
    throw new Error("不允许访问本地地址");
  const addresses = isIP(hostname)
    ? [{ address: hostname, family: isIP(hostname) }]
    : await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((item) => !isPublicIp(item.address)))
    throw new Error("目标地址不是公网地址");
  return addresses[0];
}

async function safeFetch(input: string, maxBytes: number) {
  let url = new URL(webUrl.parse(input));
  for (let redirect = 0; redirect < 5; redirect++) {
    if (url.username || url.password) throw new Error("URL 不允许包含账号密码");
    const selected = await publicAddress(url.hostname);
    const agent = new Agent({
      connect: {
        lookup: (_host, options, callback) =>
          options.all
            ? callback(null, [selected])
            : callback(null, selected.address, selected.family),
      },
    });
    try {
      const response = await fetch(url, {
        dispatcher: agent,
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
        headers: {
          "user-agent": "astro-nav/1.0 (+metadata parser)",
          accept: "text/html,image/*;q=0.8,*/*;q=0.1",
        },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location) throw new Error("重定向缺少地址");
        await response.body?.cancel();
        url = new URL(location, url);
        webUrl.parse(url.toString());
        continue;
      }
      if (!response.ok) throw new Error(`目标网站返回 ${response.status}`);
      const size = Number(response.headers.get("content-length") || 0);
      if (size > maxBytes) throw new Error("响应文件过大");
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      for await (const chunk of response.body ?? []) {
        bytes += chunk.length;
        if (bytes > maxBytes) throw new Error("响应文件过大");
        chunks.push(chunk);
      }
      return {
        url,
        bytes: Buffer.concat(chunks),
        contentType: response.headers.get("content-type") || "",
      };
    } finally {
      await agent.close();
    }
  }
  throw new Error("重定向次数过多");
}

function iconExtension(type: string, bytes: Buffer) {
  if (
    type.includes("png") &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "png";
  if (type.includes("jpeg") && bytes[0] === 255 && bytes[1] === 216)
    return "jpg";
  if (
    type.includes("webp") &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  )
    return "webp";
  if (
    type.includes("icon") &&
    bytes[0] === 0 &&
    bytes[1] === 0 &&
    bytes[2] === 1
  )
    return "ico";
  return null;
}

export async function saveRemoteIcon(input: string) {
  const fetched = await safeFetch(input, 512_000);
  const ext = iconExtension(fetched.contentType, fetched.bytes);
  if (!ext) throw new Error("图标格式不受支持");
  const filename = `${randomUUID()}.${ext}`;
  const dir = path.resolve(process.cwd(), "data", "icons");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), fetched.bytes, { flag: "wx" });
  return `/media/icons/${filename}`;
}

export async function parseWebsite(input: string) {
  const fetched = await safeFetch(input, 1_500_000);
  if (!fetched.contentType.includes("text/html"))
    throw new Error("目标不是 HTML 页面");
  const $ = load(fetched.bytes.toString("utf8"));
  const meta = (name: string) =>
    $(`meta[property="${name}"],meta[name="${name}"]`)
      .first()
      .attr("content")
      ?.trim() || "";
  const title = (
    meta("og:title") ||
    $("title").first().text().trim() ||
    fetched.url.hostname
  ).slice(0, 200);
  const description = (meta("description") || meta("og:description")).slice(
    0,
    5000,
  );
  let ogImage: string | null = null;
  try {
    if (meta("og:image"))
      ogImage = webUrl.parse(new URL(meta("og:image"), fetched.url).toString());
  } catch {
    /* OpenGraph image is optional. */
  }
  let manifestIcon: string | undefined;
  const manifestHref = $('link[rel="manifest"]').first().attr("href");
  if (manifestHref) {
    try {
      const manifest = await safeFetch(
        new URL(manifestHref, fetched.url).toString(),
        100_000,
      );
      const data = JSON.parse(manifest.bytes.toString("utf8")) as {
        icons?: { src?: string }[];
      };
      if (Array.isArray(data.icons) && typeof data.icons[0]?.src === "string")
        manifestIcon = new URL(data.icons[0].src, manifest.url).toString();
    } catch {
      /* Manifest is optional. */
    }
  }
  const candidates = [
    $('link[rel~="icon"]').first().attr("href"),
    $('link[rel="apple-touch-icon"]').first().attr("href"),
    manifestIcon,
    "/favicon.ico",
  ].filter((item): item is string => Boolean(item));
  let icon: string | null = null;
  for (const candidate of candidates) {
    try {
      icon = await saveRemoteIcon(new URL(candidate, fetched.url).toString());
      break;
    } catch {
      /* Try the next source. */
    }
  }
  return {
    title,
    description,
    shortDescription: description.slice(0, 180),
    domain: fetched.url.hostname,
    url: fetched.url.toString(),
    icon,
    ogImage,
  };
}
