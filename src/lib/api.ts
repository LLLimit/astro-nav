export function ok<T>(data: T, status = 200) {
  return Response.json({ success: true, data }, { status });
}

export function fail(message: string, status = 400) {
  return Response.json({ success: false, message }, { status });
}

export function internalError(error: unknown) {
  const candidate = error as { code?: string; cause?: { code?: string } } | null;
  const code = candidate?.code || candidate?.cause?.code;
  console.error(
    "Request failed",
    error instanceof Error ? error.name : "unknown",
    code || "",
  );
  if (["ECONNREFUSED", "ETIMEDOUT", "PROTOCOL_CONNECTION_LOST", "ER_ACCESS_DENIED_ERROR", "ER_BAD_DB_ERROR"].includes(code || ""))
    return fail("数据库连接失败，请检查 MySQL 服务和连接配置", 500);
  if (code === "ER_NO_SUCH_TABLE")
    return fail("数据库尚未完成迁移，请运行 pnpm db:migrate", 500);
  if (code === "ER_DATA_TOO_LONG")
    return fail("输入内容过长，超出数据库字段限制", 400);
  return fail("服务器暂时无法完成请求", 500);
}

export class BodyTooLargeError extends Error {}

export async function readJsonLimited(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError("Empty request");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
