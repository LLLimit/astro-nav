import test from "node:test";
import assert from "node:assert/strict";
import { parseWebsite } from "../src/lib/parser";
import { normalizeUrl, webUrl } from "../src/lib/validation";
import { saveUpload } from "../src/lib/upload";

test("URL validation rejects non-web protocols", () => {
  for (const url of [
    "javascript:alert(1)",
    "file:///etc/passwd",
    "data:text/html,hi",
  ])
    assert.equal(webUrl.safeParse(url).success, false);
  assert.equal(
    normalizeUrl("https://Example.COM:443/path#part"),
    "https://example.com/path",
  );
});

test("metadata parser blocks local and metadata targets", async () => {
  for (const url of [
    "http://localhost/",
    "http://127.0.0.1/",
    "http://10.0.0.1/",
    "http://169.254.169.254/",
    "http://[::1]/",
  ]) {
    await assert.rejects(parseWebsite(url));
  }
});

test("upload rejects executable SVG files", async () => {
  const file = new File(['<svg onload="alert(1)"></svg>'], "unsafe.svg", {
    type: "image/svg+xml",
  });
  await assert.rejects(saveUpload(file, "icons"));
});
