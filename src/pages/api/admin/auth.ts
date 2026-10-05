import type { APIRoute } from "astro";
import { z } from "zod";
import {
  checkOrigin,
  changePassword,
  currentAdmin,
  ensureAdmin,
  signIn,
  signOut,
  trustedClientKey,
} from "../../../lib/auth";
import {
  BodyTooLargeError,
  fail,
  internalError,
  ok,
  readJsonLimited,
} from "../../../lib/api";

export const GET: APIRoute = async ({ cookies }) => {
  try {
    return ok(await currentAdmin(cookies));
  } catch (error) {
    return internalError(error);
  }
};

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  if (!checkOrigin(request)) return fail("请求来源无效", 403);
  try {
    if (Number(request.headers.get("content-length") || 0) > 4096)
      return fail("请求过大", 413);
    const body = (await readJsonLimited(request, 4096)) as Record<
      string,
      unknown
    >;
    if (body.action === "login") {
      await ensureAdmin();
      const value = z
        .object({
          username: z.string().min(1).max(80),
          password: z.string().min(1).max(200),
        })
        .parse(body);
      const success = await signIn(
        cookies,
        value.username,
        value.password,
        trustedClientKey(request, clientAddress),
      );
      return success
        ? ok({ loggedIn: true })
        : fail("账号或密码错误，或暂时受到登录限制", 401);
    }
    const admin = await currentAdmin(cookies);
    if (!admin) return fail("请先登录", 401);
    if (body.action === "logout") {
      await signOut(cookies);
      return ok({ loggedOut: true });
    }
    if (body.action === "password") {
      const value = z
        .object({
          oldPassword: z.string(),
          newPassword: z.string().min(12).max(200),
        })
        .parse(body);
      return (await changePassword(
        admin.id,
        value.oldPassword,
        value.newPassword,
        cookies,
      ))
        ? ok({ changed: true })
        : fail("原密码错误", 400);
    }
    return fail("未知操作");
  } catch (error) {
    if (error instanceof BodyTooLargeError) return fail("请求过大", 413);
    if (error instanceof SyntaxError) return fail("输入内容无效");
    if (error instanceof z.ZodError) return fail("输入内容无效");
    return internalError(error);
  }
};
