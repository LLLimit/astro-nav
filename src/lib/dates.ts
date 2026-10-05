export function dayKey(offsetDays = 0) {
  const timeZone = process.env.SITE_TIMEZONE || "Asia/Hong_Kong";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() - offsetDays * 86400_000));
}
