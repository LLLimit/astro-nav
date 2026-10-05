import { randomBytes, createHmac } from "node:crypto";
import argon2 from "argon2";
import type { AstroCookies } from "astro";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../db/client";
import { admins, sessions, auditLogs } from "../db/schema";

const cookieName = "nav_session";
const sessionMs = 7 * 24 * 60 * 60 * 1000;
const attempts = new Map<string, { count: number; until: number }>();
function hash(value: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("SESSION_SECRET 需要至少 32 位");
  return createHmac("sha256", secret).update(value).digest("hex");
}

export async function ensureAdmin() {
  const existing = await db().select({ id: admins.id }).from(admins).limit(1);
  if (existing.length) return;
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password || password.length < 12)
    throw new Error(
      "首次运行需要设置 ADMIN_USERNAME 和至少 12 位 ADMIN_PASSWORD",
    );
  await db()
    .insert(admins)
    .values({
      username,
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
    });
  console.info("Initial administrator created");
}

export async function currentAdmin(cookies: AstroCookies) {
  const raw = cookies.get(cookieName)?.value;
  if (!raw || !/^[a-f0-9]{64}$/.test(raw)) return null;
  const result = await db()
    .select({
      id: admins.id,
      username: admins.username,
    })
    .from(sessions)
    .innerJoin(admins, eq(sessions.adminId, admins.id))
    .where(and(eq(sessions.id, hash(raw)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return result[0] ?? null;
}

export async function signIn(
  cookies: AstroCookies,
  username: string,
  password: string,
  key: string,
) {
  const now = Date.now();
  const state = attempts.get(key);
  if (state && state.until > now && state.count >= 5) return false;
  const row = await db()
    .select()
    .from(admins)
    .where(eq(admins.username, username))
    .limit(1);
  const valid = row[0] && (await argon2.verify(row[0].passwordHash, password));
  if (!valid) {
    if (attempts.size > 10_000)
      for (const [candidate, record] of attempts)
        if (record.until < now) attempts.delete(candidate);
    attempts.set(key, {
      count: (state?.until && state.until > now ? state.count : 0) + 1,
      until: now + 15 * 60_000,
    });
    return false;
  }
  attempts.delete(key);
  if (cookies.get(cookieName)) await signOut(cookies);
  const token = randomBytes(32).toString("hex");
  await db()
    .insert(sessions)
    .values({
      id: hash(token),
      adminId: row[0].id,
      expiresAt: new Date(now + sessionMs),
    });
  cookies.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure:
      process.env.NODE_ENV === "production" ||
      process.env.SITE_URL?.startsWith("https://"),
    path: "/",
    maxAge: sessionMs / 1000,
  });
  await audit(row[0].id, "login");
  return true;
}

export async function signOut(cookies: AstroCookies) {
  const token = cookies.get(cookieName)?.value;
  if (token)
    await db()
      .delete(sessions)
      .where(eq(sessions.id, hash(token)));
  cookies.delete(cookieName, { path: "/" });
}

export async function rotateSession(cookies: AstroCookies, adminId: number) {
  await signOut(cookies);
  const token = randomBytes(32).toString("hex");
  await db()
    .insert(sessions)
    .values({
      id: hash(token),
      adminId,
      expiresAt: new Date(Date.now() + sessionMs),
    });
  cookies.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure:
      process.env.NODE_ENV === "production" ||
      process.env.SITE_URL?.startsWith("https://"),
    path: "/",
    maxAge: sessionMs / 1000,
  });
}

export async function changePassword(
  id: number,
  oldPassword: string,
  newPassword: string,
  cookies: AstroCookies,
) {
  const row = await db()
    .select()
    .from(admins)
    .where(eq(admins.id, id))
    .limit(1);
  if (!row[0] || !(await argon2.verify(row[0].passwordHash, oldPassword)))
    return false;
  await db()
    .update(admins)
    .set({
      passwordHash: await argon2.hash(newPassword, { type: argon2.argon2id }),
    })
    .where(eq(admins.id, id));
  await db().delete(sessions).where(eq(sessions.adminId, id));
  await rotateSession(cookies, id);
  await audit(id, "password_change");
  return true;
}

export function trustedClientKey(request: Request, clientAddress?: string) {
  const forwarded =
    process.env.TRUST_PROXY === "true"
      ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      : undefined;
  return hash(forwarded || clientAddress || "unknown");
}

export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return false;
  try {
    const source = new URL(origin);
    if (!["http:", "https:"].includes(source.protocol)) return false;
    const configured = process.env.SITE_URL;
    if (configured && source.origin === new URL(configured).origin) return true;
    if (source.origin === new URL(request.url).origin) return true;
    // Node behind BaoTa can see its local port in request.url while the browser
    // posts to the public Host. The Host header still identifies that site.
    const host = request.headers.get("host");
    return Boolean(host && source.host.toLowerCase() === host.toLowerCase());
  } catch {
    return false;
  }
}

export async function audit(
  adminId: number | null,
  action: string,
  detail?: string,
) {
  await db()
    .insert(auditLogs)
    .values({ adminId, action, detail: detail?.slice(0, 500) });
}
