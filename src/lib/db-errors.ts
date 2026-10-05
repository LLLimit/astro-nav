export function isDuplicateKeyError(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const detail = current as {
      code?: unknown;
      errno?: unknown;
      message?: unknown;
      cause?: unknown;
    };
    if (
      detail.code === "ER_DUP_ENTRY" ||
      detail.errno === 1062 ||
      (typeof detail.message === "string" &&
        /Duplicate entry/i.test(detail.message))
    )
      return true;
    current = detail.cause;
  }
  return false;
}
