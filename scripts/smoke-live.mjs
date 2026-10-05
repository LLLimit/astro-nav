import "dotenv/config";
import assert from "node:assert/strict";

const base = process.env.SMOKE_BASE_URL;
assert.ok(base, "Set SMOKE_BASE_URL to the running test server");
const origin = new URL(process.env.SITE_URL).origin;
const stamp = Date.now();
let cookie = "";
let categoryId = 0;

async function api(path, body, method = "POST") {
  const response = await fetch(base + path, {
    method,
    headers: { origin, cookie, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, ...(await response.json()) };
}

function valid(label, result) {
  assert.equal(result.success, true, `${label}: ${result.message || result.status}`);
  console.log(`${label}: OK`);
  return result.data;
}

try {
  const response = await fetch(base + "/api/admin/auth", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({
      action: "login",
      username: process.env.ADMIN_USERNAME,
      password: process.env.ADMIN_PASSWORD,
    }),
  });
  valid("login", { status: response.status, ...(await response.json()) });
  cookie = (response.headers.get("set-cookie") || "").split(";")[0];
  assert.ok(cookie, "session cookie missing");

  const before = valid("stats read", await api("/api/admin/stats", undefined, "GET"));
  categoryId = valid(
    "category create",
    await api("/api/admin/categories", {
      action: "create",
      value: {
        name: "联调临时分类",
        slug: `codex-smoke-${stamp}`,
        sortOrder: 9999,
        visible: true,
      },
    }),
  ).id;
  const siteValue = {
    title: "Smoke QA",
    url: `https://example.com/codex-smoke-${stamp}`,
    categoryId,
    description: "Temporary integration test",
    enabled: true,
  };
  const siteId = valid(
    "site create",
    await api("/api/admin/sites", { action: "create", value: siteValue }),
  ).id;
  valid(
    "site update",
    await api("/api/admin/sites", {
      action: "update",
      id: siteId,
      value: { ...siteValue, title: "Smoke QA updated", featured: true },
    }),
  );
  const search = valid(
    "site search",
    await api("/api/admin/sites?q=Smoke%20QA%20updated", undefined, "GET"),
  );
  assert.ok(search.rows.some((row) => row.site.id === siteId));
  valid(
    "site disable",
    await api("/api/admin/sites", { action: "status", ids: [siteId], enabled: false }),
  );
  valid(
    "site enable",
    await api("/api/admin/sites", { action: "status", ids: [siteId], enabled: true }),
  );
  const visit = { siteId, referrer: "https://example.org/" };
  assert.equal(valid("visit first", await api("/api/visit", visit)).recorded, true);
  assert.equal(valid("visit dedupe", await api("/api/visit", visit)).recorded, false);
  const after = valid("stats updated", await api("/api/admin/stats", undefined, "GET"));
  assert.equal(after.metrics.total, before.metrics.total + 1);
  assert.equal(after.metrics.last7, before.metrics.last7 + 1);
  assert.ok(after.devices.some((row) => row.name === "Desktop"));

  const imported = valid(
    "site import",
    await api("/api/admin/sites", {
      action: "import",
      values: [
        siteValue,
        {
          ...siteValue,
          title: "Smoke QA import",
          url: `https://example.com/codex-smoke-import-${stamp}`,
        },
      ],
    }),
  );
  assert.equal(imported.duplicate, 1);
  assert.equal(imported.success, 1);
  const rows = valid(
    "site list",
    await api(`/api/admin/sites?category=${categoryId}`, undefined, "GET"),
  );
  assert.equal(rows.rows.length, 2);

  const jsonResponse = await fetch(base + "/api/admin/export", { headers: { cookie } });
  assert.equal(jsonResponse.status, 200);
  assert.ok((await jsonResponse.json()).some((row) => row.site.id === siteId));
  console.log("export JSON: OK");
  const csvResponse = await fetch(base + "/api/admin/export?format=csv", {
    headers: { cookie },
  });
  assert.equal(csvResponse.status, 200);
  assert.ok((await csvResponse.text()).includes("Smoke QA updated"));
  console.log("export CSV: OK");

  const blocked = await api("/api/admin/parse", { url: "http://127.0.0.1/" });
  assert.equal(blocked.success, false);
  console.log("private URL blocked: OK");
} finally {
  if (cookie) {
    if (categoryId) {
      const listed = await api(
        `/api/admin/sites?category=${categoryId}`,
        undefined,
        "GET",
      );
      if (listed.success && listed.data.rows.length) {
        const ids = listed.data.rows.map((row) => row.site.id);
        valid("site cleanup", await api("/api/admin/sites", { action: "delete", ids }));
      }
      valid(
        "category cleanup",
        await api("/api/admin/categories", { action: "delete", id: categoryId }),
      );
    }
    valid("logout", await api("/api/admin/auth", { action: "logout" }));
  }
}
