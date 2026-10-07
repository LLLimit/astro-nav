export {};
import type { EChartsOption } from "echarts";
import { WALLPAPER_LIMIT, WALLPAPER_UPLOAD_PATH, siteWallpaper, type UploadedWallpaper } from "../lib/wallpapers";
type Category = {
  id: number;
  parentId: number | null;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
  sortOrder: number;
  visible: boolean;
};
type Site = {
  id: number;
  title: string;
  url: string;
  domain: string;
  description: string | null;
  shortDescription: string | null;
  icon: string | null;
  ogImage: string | null;
  categoryId: number;
  sortOrder: number;
  featured: boolean;
  pinned: boolean;
  enabled: boolean;
  clickCount: number;
  createdAt: string;
  updatedAt: string;
};
type SiteRow = { site: Site; category: Category };
type SitePayload = Omit<
  Site,
  "id" | "domain" | "clickCount" | "ogImage" | "createdAt" | "updatedAt"
> & {
  ogImage?: string | null;
  tags: string[];
};
type ImportItem = SitePayload & { status?: string };
const $ = <T extends Element>(selector: string) =>
  document.querySelector<T>(selector);
const getInput = (form: HTMLFormElement, name: string) =>
  form.elements.namedItem(name) as
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
let categories: Category[] = [];
let siteRows: SiteRow[] = [];
let siteTags: Record<number, string[]> = {};
let sitePage = 1;
let siteTotal = 0;
let editKind: "site" | "category" = "site";
let editId: number | null = null;
let importItems: ImportItem[] = [];
const chartObservers = new Map<string, ResizeObserver>();
let loadedSettings: Record<string, unknown> = {};
let messageTimer: ReturnType<typeof setTimeout> | undefined;

function message(value: string, error = false) {
  const node = $("#admin-message");
  if (!node) return;
  node.textContent = value;
  node.classList.toggle("error", error);
  (node as HTMLElement).style.display = "block";
  if (messageTimer) clearTimeout(messageTimer);
  messageTimer = setTimeout(() => {
    (node as HTMLElement).style.display = "none";
  }, error ? 9000 : 6000);
}
async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    `/api/admin/${path}`,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const result = (await response.json().catch(() => {
    throw new Error(`服务器响应异常（HTTP ${response.status}）`);
  })) as {
    success: boolean;
    data: T;
    message?: string;
  };
  if (!result.success) throw new Error(result.message || `请求失败（HTTP ${response.status}）`);
  return result.data;
}
async function action<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const data = await api<T>(path, body);
    const operation = typeof body === "object" && body !== null && "action" in body ? String(body.action) : "";
    const labels: Record<string, string> = {
      create: "已创建，内容已保存", update: "修改已保存", delete: "已删除",
      status: "状态已更新", import: "导入已完成", password: "密码已更新",
    };
    message(path === "settings" ? "网站设置已保存" : labels[operation] || "操作成功");
    return data;
  } catch (error) {
    message(error instanceof Error ? error.message : "操作失败", true);
    return null;
  }
}
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className = "",
  content = "",
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = content;
  return node;
}
function button(label: string, handler: () => void, className = "") {
  const node = el("button", className, label);
  node.type = "button";
  node.addEventListener("click", handler);
  return node;
}
function setValue(form: HTMLFormElement, name: string, value: unknown) {
  const input = getInput(form, name);
  if (input instanceof HTMLInputElement && input.type === "checkbox")
    input.checked = Boolean(value);
  else input.value = String(value ?? "");
}

const login = $<HTMLFormElement>("#login-form");
login?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await api("auth", {
      action: "login",
      username: getInput(login, "username").value,
      password: getInput(login, "password").value,
    });
    location.reload();
  } catch (error) {
    const label = $("#login-message");
    if (label)
      label.textContent = error instanceof Error ? error.message : "登录失败";
  }
});

async function loadCategories() {
  categories = await api<Category[]>("categories");
  const filters = [
    $<HTMLSelectElement>("#site-category-filter"),
    $<HTMLSelectElement>("#import-category"),
  ];
  for (const select of filters) {
    if (!select) continue;
    const previous = select.value;
    fillCategoryOptions(select, select.id === "site-category-filter");
    if ([...select.options].some((option) => option.value === previous)) select.value = previous;
  }
  const form = $<HTMLFormElement>("#edit-form")!;
  const rootSelect = getInput(form, "mainCategoryId") as HTMLSelectElement;
  const previousRoot = rootSelect.value;
  rootSelect.replaceChildren();
  for (const category of categories.filter((c) => c.parentId === null))
    rootSelect.add(new Option(category.name, String(category.id)));
  if ([...rootSelect.options].some((option) => option.value === previousRoot)) rootSelect.value = previousRoot;
  syncSiteCategoryOptions(Number(rootSelect.value));
}
function categoryPath(category: Category) {
  const parent = categories.find((c) => c.id === category.parentId);
  return parent ? `${parent.name} / ${category.name}` : category.name;
}
function fillCategoryOptions(select: HTMLSelectElement, includeAll = false) {
  select.replaceChildren();
  if (includeAll) select.add(new Option("全部分类", ""));
  for (const root of categories.filter((c) => c.parentId === null)) {
    const group = el("optgroup");
    group.label = root.name + (root.visible ? "" : "（隐藏）");
    group.append(new Option(includeAll ? `${root.name}（含二级分类）` : `${root.name}（不细分）`, String(root.id)));
    for (const child of categories.filter((c) => c.parentId === root.id))
      group.append(new Option(`↳ ${child.name}${child.visible && root.visible ? "" : "（隐藏）"}`, String(child.id)));
    select.append(group);
  }
}
function syncSiteCategoryOptions(rootId: number, selectedId = rootId) {
  const form = $<HTMLFormElement>("#edit-form");
  if (!form) return;
  const select = getInput(form, "categoryId") as HTMLSelectElement;
  select.replaceChildren();
  if (!rootId) return;
  select.add(new Option("不细分，直接放入一级分类", String(rootId)));
  for (const child of categories.filter((c) => c.parentId === rootId))
    select.add(new Option(child.name + (child.visible ? "" : "（隐藏）"), String(child.id)));
  select.value = String(selectedId);
  if (!select.value) select.value = String(rootId);
}
$("#site-main-category")?.addEventListener("change", (event) =>
  syncSiteCategoryOptions(Number((event.target as HTMLSelectElement).value)),
);
function showView(name: string) {
  if (
    ![
      "dashboard",
      "sites",
      "categories",
      "import",
      "stats",
      "settings",
      "security",
    ].includes(name)
  )
    name = "dashboard";
  document
    .querySelectorAll<HTMLElement>("[data-panel]")
    .forEach((panel) => (panel.hidden = panel.dataset.panel !== name));
  document
    .querySelectorAll<HTMLButtonElement>("[data-view]")
    .forEach((button) =>
      button.classList.toggle("selected", button.dataset.view === name),
    );
  const title = $("#view-title");
  const labels: Record<string, string> = {
    dashboard: "仪表盘",
    sites: "网址管理",
    categories: "分类管理",
    import: "快速导入",
    stats: "访问统计",
    settings: "网站设置",
    security: "安全设置",
  };
  if (title) title.textContent = labels[name] || name;
  history.replaceState(null, "", `/admin#${name}`);
  $(".admin-side")?.classList.remove("open");
  if (name === "dashboard" || name === "stats") void loadStats();
  if (name === "sites") void loadSites();
  if (name === "categories") renderCategories();
  if (name === "settings") void loadSettings();
}
document
  .querySelectorAll<HTMLButtonElement>("[data-view]")
  .forEach((button) =>
    button.addEventListener("click", () =>
      showView(button.dataset.view || "dashboard"),
    ),
  );
$("#admin-menu")?.addEventListener("click", () =>
  $(".admin-side")?.classList.toggle("open"),
);
$("#logout-button")?.addEventListener("click", async () => {
  await action("auth", { action: "logout" });
  location.reload();
});

function renderCategories() {
  const list = $("#category-list");
  if (!list) return;
  list.replaceChildren();
  if (!categories.length) list.append(el("p", "category-manage-help", "暂无分类，先添加一个一级分类。"));
  const ordered = categories.filter((c) => c.parentId === null).flatMap((root) => [root, ...categories.filter((c) => c.parentId === root.id)]);
  for (const category of ordered) {
    const row = el("div", `admin-row category-row${category.parentId === null ? " category-root" : " category-child"}`);
    const icon = el("img");
    icon.src = category.icon || "/images/default.svg";
    icon.alt = "";
    const main = el("div", "row-main");
    main.append(
      el("strong", "", category.name),
      el(
        "small",
        "",
        `${category.parentId === null ? "一级分类" : "二级分类"} · 排序 ${category.sortOrder} · ${!category.visible ? "隐藏" : category.parentId && !categories.find((c) => c.id === category.parentId)?.visible ? "随一级分类隐藏" : "显示"}`,
      ),
    );
    const actions = el("div", "row-actions");
    if (category.parentId === null)
      actions.append(button("添加二级分类", () => openCategory(undefined, category.id)));
    actions.append(
      button("编辑", () => openCategory(category)),
      button(
        "删除",
        async () => {
          if (categories.some((c) => c.parentId === category.id)) {
            message("此一级分类包含二级分类，请先移动或删除二级分类", true);
            return;
          }
          const moveTo = prompt(
            "输入目标分类 ID 转移网站；输入 DELETE 一并删除网站；空白仅删除空分类。可选：" +
              categories
                .filter((c) => c.id !== category.id)
                .map((c) => categoryPath(c) + "=" + c.id)
                .join("、"),
          );
          if (moveTo === null) return;
          const deleteWithSites = moveTo === "DELETE";
          if (
            moveTo &&
            !deleteWithSites &&
            (!Number.isInteger(Number(moveTo)) || Number(moveTo) <= 0)
          ) {
            message("请输入有效分类 ID 或 DELETE", true);
            return;
          }
          if (
            deleteWithSites &&
            !confirm(
              `分类「${category.name}」下的网站及其统计将一并删除。确定继续吗？`,
            )
          )
            return;
          if (!confirm(`确定删除分类「${category.name}」吗？`)) return;
          const value = await action("categories", {
            action: "delete",
            id: category.id,
            moveTo: moveTo && !deleteWithSites ? Number(moveTo) : undefined,
            deleteWithSites,
          });
          if (value) {
            await loadCategories();
            renderCategories();
          }
        },
        "danger",
      ),
    );
    row.append(icon, main, actions);
    list.append(row);
  }
}
function toggleFields(kind: "site" | "category") {
  for (const control of document.querySelectorAll<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >("#site-fields input,#site-fields select,#site-fields textarea"))
    control.disabled = kind !== "site";
  for (const control of document.querySelectorAll<
    HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
  >("#category-fields input,#category-fields select,#category-fields textarea"))
    control.disabled = kind !== "category";
}
function openCategory(category?: Category, parentId: number | null = null) {
  editKind = "category";
  toggleFields("category");
  editId = category?.id ?? null;
  const form = $<HTMLFormElement>("#edit-form")!;
  form.reset();
  $("#site-fields")?.setAttribute("hidden", "");
  $("#category-fields")?.removeAttribute("hidden");
  const heading = $("#edit-heading");
  if (heading) heading.textContent = category ? "编辑分类" : parentId ? "添加二级分类" : "添加一级分类";
  const parentSelect = getInput(form, "parentId") as HTMLSelectElement;
  parentSelect.replaceChildren(new Option("无上级，作为一级分类", ""));
  for (const root of categories.filter((c) => c.parentId === null && c.id !== editId))
    parentSelect.add(new Option(root.name, String(root.id)));
  parentSelect.value = String(category?.parentId ?? parentId ?? "");
  const hasChildren = Boolean(category && categories.some((c) => c.parentId === category.id));
  parentSelect.disabled = hasChildren;
  const parentHelp = $("#category-parent-help");
  if (parentHelp) parentHelp.textContent = hasChildren
    ? "此分类已有二级分类，先移动或删除二级分类后才能更改层级。"
    : "选择一级分类后，作为其顶部标签显示；二级分类不进入侧边栏。";
  if (category) {
    for (const [key, value] of Object.entries({
      name: category.name,
      categoryIcon: category.icon,
      categoryDescription: category.description,
      categorySortOrder: category.sortOrder,
      visible: category.visible,
    }))
      setValue(form, key, value);
  }
  $<HTMLDialogElement>("#edit-dialog")?.showModal();
}
$("#category-add")?.addEventListener("click", () => openCategory());

function selectedIds() {
  return [
    ...document.querySelectorAll<HTMLInputElement>(".site-select:checked"),
  ].map((input) => Number(input.value));
}
async function loadSites() {
  const query = $<HTMLInputElement>("#site-query")?.value || "";
  const category = $<HTMLSelectElement>("#site-category-filter")?.value || "";
  const status = $<HTMLSelectElement>("#site-status-filter")?.value || "";
  const iconFilter = $<HTMLSelectElement>("#site-icon-filter")?.value || "";
  const sort = $<HTMLSelectElement>("#site-sort")?.value || "order";
  try {
    const result = await api<{
      rows: SiteRow[];
      total: number;
      page: number;
      tags: Record<number, string[]>;
    }>(
      `sites?page=${sitePage}&q=${encodeURIComponent(query)}&category=${category}&status=${status}&sort=${sort}&icon=${iconFilter}`,
    );
    siteRows = result.rows;
    siteTotal = result.total;
    siteTags = result.tags;
    renderSites();
  } catch (error) {
    message(error instanceof Error ? error.message : "加载失败", true);
  }
}
function renderSites() {
  const list = $("#site-list");
  if (!list) return;
  list.replaceChildren();
  if (!siteRows.length) list.append(el("p", "admin-list-empty", "没有符合当前筛选条件的网址。"));
  for (const { site, category } of siteRows) {
    const row = el("div", "admin-row");
    const check = el("input", "site-select") as HTMLInputElement;
    check.type = "checkbox";
    check.value = String(site.id);
    const icon = el("img");
    icon.src = site.icon || "/images/default.svg";
    icon.alt = "";
    const main = el("div", "row-main");
    main.title = `${site.title}\n${site.url}`;
    main.append(
      el("strong", "", site.title),
      el("small", "", site.url),
      el(
        "small",
        "",
        `${site.domain} · ${categoryPath(category)} · ${siteTags[site.id]?.join(", ") || "无标签"} · ${site.clickCount} 次访问 · 排序 ${site.sortOrder} · ${site.featured ? "推荐 · " : ""}${site.pinned ? "置顶 · " : ""}${new Date(site.createdAt).toLocaleDateString()}`,
      ),
    );
    const badge = el(
      "span",
      `badge ${site.enabled ? "" : "off"}`,
      site.enabled ? "启用" : "禁用",
    );
    const actions = el("div", "row-actions");
    actions.append(
      button("复制", () => {
        void navigator.clipboard.writeText(site.url);
        message("已复制网址");
      }),
      button("编辑", () => openSite(site)),
      button(
        "重新解析",
        async () => {
          const data = await action<Partial<Site>>("parse", { url: site.url });
          if (data) {
            openSite({ ...site, ...data });
          }
        },
        "",
      ),
      button(
        "删除",
        async () => {
          if (!confirm(`确定删除「${site.title}」吗？`)) return;
          if (await action("sites", { action: "delete", ids: [site.id] }))
            void loadSites();
        },
        "danger",
      ),
    );
    row.append(check, icon, main, badge, actions);
    list.append(row);
  }
  const page = $("#site-page");
  if (page) page.textContent = `第 ${sitePage} 页 / 共 ${siteTotal} 条`;
}
$("#site-filter")?.addEventListener("click", () => {
  sitePage = 1;
  void loadSites();
});
$("#site-icon-filter")?.addEventListener("change", () => {
  sitePage = 1;
  void loadSites();
});
$("#site-temporary-edit")?.addEventListener("click", () => {
  const enabled = $("#site-list")?.classList.toggle("temporary-edit") ?? false;
  const toggle = $<HTMLButtonElement>("#site-temporary-edit");
  toggle?.setAttribute("aria-pressed", String(enabled));
  if (toggle) toggle.textContent = enabled ? "退出临时编辑" : "临时编辑";
});
$("#site-query")?.addEventListener("keydown", (event) => {
  if ((event as KeyboardEvent).key === "Enter") {
    event.preventDefault();
    sitePage = 1;
    void loadSites();
  }
});
$("#site-prev")?.addEventListener("click", () => {
  if (sitePage > 1) {
    sitePage--;
    void loadSites();
  }
});
$("#site-next")?.addEventListener("click", () => {
  if (sitePage * 30 < siteTotal) {
    sitePage++;
    void loadSites();
  }
});
$("#site-select-all")?.addEventListener("change", (event) => {
  document
    .querySelectorAll<HTMLInputElement>(".site-select")
    .forEach(
      (input) => (input.checked = (event.target as HTMLInputElement).checked),
    );
});
async function bulk(actionName: "delete" | "status", enabled?: boolean) {
  const ids = selectedIds();
  if (!ids.length) {
    message("请先选择网站", true);
    return;
  }
  if (
    actionName === "delete" &&
    !confirm(`确定删除选中的 ${ids.length} 个网站吗？`)
  )
    return;
  const body =
    actionName === "delete"
      ? { action: "delete", ids }
      : { action: "status", ids, enabled };
  if (await action("sites", body)) void loadSites();
}
$("#bulk-enable")?.addEventListener("click", () => void bulk("status", true));
$("#bulk-disable")?.addEventListener("click", () => void bulk("status", false));
$("#bulk-delete")?.addEventListener("click", () => void bulk("delete"));
function openSite(site?: Site) {
  editKind = "site";
  toggleFields("site");
  editId = site?.id ?? null;
  const form = $<HTMLFormElement>("#edit-form")!;
  form.reset();
  $("#category-fields")?.setAttribute("hidden", "");
  $("#site-fields")?.removeAttribute("hidden");
  const heading = $("#edit-heading");
  if (heading) heading.textContent = site ? "编辑网址" : "添加网址";
  const assigned = categories.find((c) => c.id === site?.categoryId);
  const rootId = assigned?.parentId ?? assigned?.id ?? categories.find((c) => c.parentId === null)?.id ?? 0;
  setValue(form, "mainCategoryId", rootId);
  syncSiteCategoryOptions(rootId, site?.categoryId);
  if (site) {
    for (const [key, value] of Object.entries({
      ...site,
      tags: siteTags[site.id]?.join(", "),
    }))
      if (form.elements.namedItem(key)) setValue(form, key, value);
  }
  $<HTMLDialogElement>("#edit-dialog")?.showModal();
}
$("#site-add")?.addEventListener("click", () => openSite());
$("#edit-close")?.addEventListener("click", () =>
  $<HTMLDialogElement>("#edit-dialog")?.close(),
);
$("#parse-site")?.addEventListener("click", async () => {
  const form = $<HTMLFormElement>("#edit-form")!;
  const url = getInput(form, "url").value;
  const data = await action<Partial<Site>>("parse", { url });
  if (data) {
    for (const [key, value] of Object.entries(data))
      if (form.elements.namedItem(key)) setValue(form, key, value);
  }
});
$("#edit-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (submit) { submit.disabled = true; submit.textContent = "保存中…"; }
  try {
  if (editKind === "category") {
    const existingSlug = editId ? categories.find((category) => category.id === editId)?.slug : undefined;
    const uniquePart = Array.from(crypto.getRandomValues(new Uint8Array(4)), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const value = {
      parentId: getInput(form, "parentId").value ? Number(getInput(form, "parentId").value) : null,
      name: getInput(form, "name").value,
      slug: existingSlug || `category-${Date.now().toString(36)}-${uniquePart}`,
      icon: getInput(form, "categoryIcon").value || null,
      description: getInput(form, "categoryDescription").value,
      sortOrder: Number(getInput(form, "categorySortOrder").value),
      visible: (getInput(form, "visible") as HTMLInputElement).checked,
    };
    if (
      await action("categories", {
        action: editId ? "update" : "create",
        id: editId,
        value,
      })
    ) {
      $<HTMLDialogElement>("#edit-dialog")?.close();
      await loadCategories();
      renderCategories();
    }
    return;
  }
  const value = readSiteForm(form);
  if (
    await action("sites", {
      action: editId ? "update" : "create",
      id: editId,
      value,
    })
  ) {
    $<HTMLDialogElement>("#edit-dialog")?.close();
    void loadSites();
  }
  } finally {
    if (submit) { submit.disabled = false; submit.textContent = "保存"; }
  }
});
function readSiteForm(form: HTMLFormElement): SitePayload {
  return {
    title: getInput(form, "title").value,
    url: getInput(form, "url").value,
    description: getInput(form, "description").value,
    shortDescription: getInput(form, "shortDescription").value,
    icon: getInput(form, "icon").value || null,
    ogImage: getInput(form, "ogImage").value || null,
    categoryId: Number(getInput(form, "categoryId").value),
    tags: getInput(form, "tags")
      .value.split(",")
      .map((v) => v.trim())
      .filter(Boolean),
    sortOrder: Number(getInput(form, "sortOrder").value) || 0,
    featured: (getInput(form, "featured") as HTMLInputElement).checked,
    pinned: (getInput(form, "pinned") as HTMLInputElement).checked,
    enabled: (getInput(form, "enabled") as HTMLInputElement).checked,
  };
}

async function upload(file: File, kind: string) {
  const body = new FormData();
  body.set("file", file);
  body.set("kind", kind);
  const response = await fetch("/api/admin/upload", { method: "POST", body });
  const result = (await response.json().catch(() => { throw new Error(`上传失败（HTTP ${response.status}），请检查图片大小或服务器配置`); })) as {
    success: boolean;
    data: { path: string };
    message?: string;
  };
  if (!response.ok || !result.success) throw new Error(result.message || `上传失败（HTTP ${response.status}）`);
  return result.data.path;
}
document.querySelectorAll<HTMLInputElement>("[data-upload]").forEach((input) =>
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    input.disabled = true;
    try {
      const path = await upload(file, input.dataset.upload || "icons");
      const form = input.closest("form") as HTMLFormElement;
      setValue(form, input.dataset.target || "icon", path);
      if (input.dataset.upload === "backgrounds") {
        setValue(form, "backgroundType", "image");
        updateWallpaperPreview();
        renderWallpaperLibrary();
      }
      if (input.dataset.target === "favicon") updateFaviconPreview();
      message("上传成功，点击保存后生效");
    } catch (error) {
      message(error instanceof Error ? error.message : "上传失败", true);
    } finally {
      input.disabled = false;
      input.value = "";
    }
  }),
);

function importBase(url: string): ImportItem {
  let title = url;
  try {
    title = new URL(url).hostname;
  } catch {
    /* Keep invalid entries visible for correction. */
  }
  return {
    title,
    url,
    description: "",
    shortDescription: "",
    icon: null,
    categoryId: Number($<HTMLSelectElement>("#import-category")?.value || 0),
    tags: ($<HTMLInputElement>("#import-tags")?.value || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
    sortOrder: 0,
    featured: Boolean($<HTMLInputElement>("#import-featured")?.checked),
    pinned: false,
    enabled: Boolean($<HTMLInputElement>("#import-enabled")?.checked),
  };
}
function renderImport() {
  const list = $("#import-results");
  if (!list) return;
  list.replaceChildren();
  for (const item of importItems) {
    const row = el("div", "admin-row");
    const main = el("div", "row-main");
    main.append(el("strong", "", item.title), el("small", "", item.url));
    const status = el(
      "span",
      `import-status ${item.status?.startsWith("失败") ? "error" : ""}`,
      item.status || "待保存",
    );
    row.append(main, status);
    if (item.status?.startsWith("失败"))
      row.append(
        button("重试", async () => {
          try {
            const data = await api<Partial<Site>>("parse", { url: item.url });
            Object.assign(item, data, { status: "已解析" });
          } catch (error) {
            item.status =
              "失败：" + (error instanceof Error ? error.message : "解析失败");
          }
          renderImport();
        }),
      );
    list.append(row);
  }
  const save = $<HTMLButtonElement>("#save-import");
  if (save)
    save.disabled = !importItems.some(
      (item) =>
        !item.status?.startsWith("失败") &&
        item.status !== "成功" &&
        item.status !== "重复",
    );
}
$("#parse-import")?.addEventListener("click", async () => {
  const lines = ($<HTMLTextAreaElement>("#import-urls")?.value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 100);
  importItems = [];
  for (const url of lines) {
    try {
      const base = importBase(url);
      const parsed = await api<Partial<Site>>("parse", { url });
      importItems.push({ ...base, ...parsed, status: "已解析" });
    } catch (error) {
      importItems.push({
        ...importBase(url),
        status: `失败：${error instanceof Error ? error.message : "解析失败"}`,
      });
    }
    renderImport();
  }
  if (!lines.length) message("请先粘贴网址", true);
});
$("#save-import")?.addEventListener("click", async () => {
  const candidates = importItems.filter(
    (item) =>
      !item.status?.startsWith("失败") &&
      item.status !== "成功" &&
      item.status !== "重复",
  );
  const values = candidates.map(({ status, ...value }) => value);
  const result = await action<{
    success: number;
    duplicate: number;
    failed: number;
    errors: string[];
    items: { status: "success" | "duplicate" | "failed"; reason?: string }[];
  }>("sites", { action: "import", values });
  if (result) {
    message(
      `成功 ${result.success}，重复 ${result.duplicate}，失败 ${result.failed}`,
    );
    candidates.forEach((item, index) => {
      const outcome = result.items[index];
      item.status =
        outcome?.status === "success"
          ? "成功"
          : outcome?.status === "duplicate"
            ? "重复"
            : `失败：${outcome?.reason || "导入失败"}`;
    });
    renderImport();
  }
});
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const headers = rows.shift() || [];
  return rows.map((values) =>
    Object.fromEntries(
      headers.map((head, index) => [
        head.replace(/^\uFEFF/, ""),
        values[index] || "",
      ]),
    ),
  );
}
$("#import-file")?.addEventListener("change", async (event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    if (file.size > 1_000_000) throw new Error("导入文件不能超过 1MB");
    const text = await file.text();
    const raw = file.name.toLowerCase().endsWith(".csv")
      ? parseCsv(text)
      : (JSON.parse(text) as unknown);
    if (!Array.isArray(raw)) throw new Error("文件格式无效");
    const objects = raw.slice(0, 100) as Record<string, unknown>[];
    importItems = objects.map((entry) => {
      const site = (entry.site || entry) as Record<string, unknown>;
      const rawCategory = entry.category;
      const slug =
        typeof rawCategory === "string"
          ? rawCategory
          : rawCategory && typeof rawCategory === "object"
            ? String((rawCategory as Record<string, unknown>).slug || "")
            : "";
      const category = categories.find((c) => c.slug === slug);
      const url = String(site.url || "");
      return {
        ...importBase(url),
        title: String(site.title || new URL(url).hostname),
        description: String(site.description || ""),
        shortDescription: String(site.shortDescription || ""),
        icon: site.icon ? String(site.icon) : null,
        ogImage: site.ogImage ? String(site.ogImage) : null,
        tags: Array.isArray(entry.tags)
          ? entry.tags.map(String)
          : typeof site.tags === "string"
            ? site.tags
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean)
            : importBase(url).tags,
        categoryId: Number(
          site.categoryId ||
            category?.id ||
            $<HTMLSelectElement>("#import-category")?.value,
        ),
        featured: String(site.featured) === "true",
        pinned: String(site.pinned) === "true",
        enabled: String(site.enabled) !== "false",
        sortOrder: Number(site.sortOrder || 0),
        status: "已读取",
      };
    });
    renderImport();
    message(`已读取 ${importItems.length} 条`);
  } catch (error) {
    message(error instanceof Error ? error.message : "读取失败", true);
  }
});

function updateFaviconPreview() {
  const form = $<HTMLFormElement>("#settings-form");
  const preview = $<HTMLImageElement>("#favicon-preview");
  if (!form || !preview) return;
  const value = getInput(form, "favicon").value.trim();
  let path = "/images/brand-lockup-black.png";
  if (/^\/(media|icons|images)\//.test(value) || /^https?:\/\//i.test(value)) path = value;
  preview.src = path;
}
$<HTMLInputElement>('#settings-form [name="favicon"]')?.addEventListener("input", updateFaviconPreview);

function updateWallpaperPreview() {
  const form = $<HTMLFormElement>("#settings-form");
  const preview = $<HTMLDivElement>("#wallpaper-preview");
  if (!form || !preview) return;
  const wallpaper = siteWallpaper({
    backgroundType: getInput(form, "backgroundType").value,
    backgroundValue: getInput(form, "backgroundValue").value.trim(),
    showBuiltinWallpapers: (getInput(form, "showBuiltinWallpapers") as HTMLInputElement).checked,
    wallpapers: wallpapersDraft,
  });
  preview.dataset.theme = "glass";
  preview.style.backgroundImage = wallpaper.type === "image" ? `url("${wallpaper.value}")` : "none";
  preview.style.backgroundColor = wallpaper.type === "color" ? wallpaper.value : "";
}
const wallpaperForm = $<HTMLFormElement>("#settings-form");
let wallpapersDraft: UploadedWallpaper[] = [];
let wallpaperUploadBusy = false;
let settingsSaveBusy = false;
function renderWallpaperLibrary() {
  const list = $("#wallpaper-library-list");
  const count = $("#wallpaper-library-count");
  if (count) count.textContent = `${wallpapersDraft.length} / ${WALLPAPER_LIMIT}`;
  if (!list || !wallpaperForm) return;
  updateWallpaperPreview();
  list.replaceChildren();
  if (!wallpapersDraft.length) {
    list.append(el("p", "wallpaper-library-empty", "还没有导入壁纸。可开启内置壁纸，或导入自己的图片。"));
    return;
  }
  const defaultPath = getInput(wallpaperForm, "backgroundType").value === "image" ? getInput(wallpaperForm, "backgroundValue").value : "";
  wallpapersDraft.forEach((wallpaper, index) => {
    const card = el("div", "wallpaper-library-card");
    const image = el("img");
    image.src = wallpaper.path;
    image.alt = wallpaper.name;
    image.loading = "lazy";
    image.decoding = "async";
    const label = el("label", "wallpaper-name-label", "壁纸名称");
    const name = el("input");
    name.type = "text";
    name.value = wallpaper.name;
    name.maxLength = 80;
    name.required = true;
    name.disabled = wallpaperUploadBusy || settingsSaveBusy;
    name.addEventListener("input", () => { wallpaper.name = name.value; image.alt = name.value; });
    label.append(name);
    const actions = el("div", "wallpaper-library-actions");
    function button(text: string, callback: () => void, disabled = false) {
      const control = el("button", "", text);
      control.type = "button";
      control.disabled = disabled || wallpaperUploadBusy || settingsSaveBusy;
      control.addEventListener("click", callback);
      actions.append(control);
      return control;
    }
    button(defaultPath === wallpaper.path ? "当前默认" : "设为默认", () => {
      setValue(wallpaperForm!, "backgroundType", "image");
      setValue(wallpaperForm!, "backgroundValue", wallpaper.path);
      updateWallpaperPreview();
      renderWallpaperLibrary();
      message("已设为默认壁纸，点击保存设置后生效");
    }, defaultPath === wallpaper.path);
    const previous = button("↑", () => {
      [wallpapersDraft[index - 1], wallpapersDraft[index]] = [wallpapersDraft[index], wallpapersDraft[index - 1]];
      renderWallpaperLibrary();
    }, index === 0);
    previous.setAttribute("aria-label", `上移壁纸「${wallpaper.name}」`);
    const next = button("↓", () => {
      [wallpapersDraft[index + 1], wallpapersDraft[index]] = [wallpapersDraft[index], wallpapersDraft[index + 1]];
      renderWallpaperLibrary();
    }, index === wallpapersDraft.length - 1);
    next.setAttribute("aria-label", `下移壁纸「${wallpaper.name}」`);
    button("移除", () => {
      wallpapersDraft.splice(index, 1);
      if (defaultPath === wallpaper.path) {
        setValue(wallpaperForm!, "backgroundType", "gradient");
        setValue(wallpaperForm!, "backgroundValue", "");
        updateWallpaperPreview();
      }
      renderWallpaperLibrary();
      message("已从可选列表移除，点击保存设置后生效");
    });
    card.append(image, label, actions);
    list.append(card);
  });
}
const wallpaperFiles = $<HTMLInputElement>("#wallpaper-files");
wallpaperFiles?.addEventListener("change", async () => {
  const files = [...(wallpaperFiles.files || [])];
  if (!files.length || wallpaperUploadBusy || settingsSaveBusy) return;
  const status = $("#wallpaper-upload-status");
  if (files.length + wallpapersDraft.length > WALLPAPER_LIMIT) {
    message(`最多 ${WALLPAPER_LIMIT} 张，目前还可导入 ${WALLPAPER_LIMIT - wallpapersDraft.length} 张`, true);
    wallpaperFiles.value = "";
    return;
  }
  wallpaperUploadBusy = true;
  wallpaperFiles.disabled = true;
  const submit = wallpaperForm?.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (submit) submit.disabled = true;
  renderWallpaperLibrary();
  let succeeded = 0;
  const errors: string[] = [];
  try {
    for (const [index, file] of files.entries()) {
      if (status) status.textContent = `正在导入 ${index + 1} / ${files.length}：${file.name}`;
      try {
        const path = await upload(file, "backgrounds");
        if (!WALLPAPER_UPLOAD_PATH.test(path)) throw new Error("服务器返回了无效的壁纸路径");
        wallpapersDraft.push({ path, name: file.name.replace(/\.[^.]+$/, "").trim().slice(0, 80) || "壁纸" });
        succeeded++;
        renderWallpaperLibrary();
      } catch (error) {
        errors.push(`${file.name}：${error instanceof Error ? error.message : "导入失败"}`);
      }
    }
    const result = `成功导入 ${succeeded} 张${errors.length ? `，失败 ${errors.length} 张` : ""}。${succeeded ? "点击保存设置后生效。" : ""}`;
    if (status) status.textContent = [result, ...errors].join("\n");
    message(result, errors.length > 0);
  } finally {
    wallpaperUploadBusy = false;
    wallpaperFiles.disabled = false;
    wallpaperFiles.value = "";
    if (submit) submit.disabled = false;
    renderWallpaperLibrary();
    updateWallpaperPreview();
  }
});
for (const name of ["defaultTheme", "backgroundType", "backgroundValue", "showBuiltinWallpapers"]) {
  if (!wallpaperForm) break;
  getInput(wallpaperForm, name).addEventListener("input", updateWallpaperPreview);
  getInput(wallpaperForm, name).addEventListener("change", updateWallpaperPreview);
  if (name !== "defaultTheme") getInput(wallpaperForm, name).addEventListener("change", renderWallpaperLibrary);
}
$("#clear-background")?.addEventListener("click", () => {
  if (!wallpaperForm) return;
  setValue(wallpaperForm, "backgroundType", "gradient");
  setValue(wallpaperForm, "backgroundValue", "");
  updateWallpaperPreview();
  renderWallpaperLibrary();
  message("已选择默认壁纸，点击保存设置后生效");
});
async function loadSettings() {
  if (wallpaperUploadBusy || settingsSaveBusy) return;
  try {
    const values = await api<Record<string, unknown>>("settings");
    loadedSettings = values;
    wallpapersDraft = Array.isArray(values.wallpapers) ? values.wallpapers.map(item => ({ ...item as UploadedWallpaper })) : [];
    const form = $<HTMLFormElement>("#settings-form");
    if (form)
      for (const [key, value] of Object.entries(values))
        if (form.elements.namedItem(key)) setValue(form, key, value);
    updateWallpaperPreview();
    updateFaviconPreview();
    renderWallpaperLibrary();
  } catch (error) {
    message(error instanceof Error ? error.message : "加载失败", true);
  }
}
$("#settings-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (wallpaperUploadBusy || settingsSaveBusy) return;
  const form = event.currentTarget as HTMLFormElement;
  const value: Record<string, unknown> = { ...loadedSettings };
  value.wallpapers = wallpapersDraft.map(item => ({ name: item.name.trim(), path: item.path }));
  for (const element of Array.from(form.elements)) {
    if (
      !(
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement
      ) ||
      !element.name ||
      element.type === "file"
    )
      continue;
    value[element.name] =
      element instanceof HTMLInputElement && element.type === "checkbox"
        ? element.checked
        : element instanceof HTMLInputElement && element.type === "number"
          ? Number(element.value)
          : element.value;
  }
  const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  settingsSaveBusy = true;
  if (wallpaperFiles) wallpaperFiles.disabled = true;
  renderWallpaperLibrary();
  if (submit) { submit.disabled = true; submit.textContent = "保存中…"; }
  const saved = await action<Record<string, unknown>>("settings", value);
  if (saved) {
    loadedSettings = saved;
    wallpapersDraft = (saved.wallpapers as UploadedWallpaper[]).map(item => ({ ...item }));
    const wallpaperStatus = $("#wallpaper-upload-status");
    if (wallpaperStatus) wallpaperStatus.textContent = wallpapersDraft.length ? `已发布 ${wallpapersDraft.length} 张可选壁纸。` : "";
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const preview = $<HTMLImageElement>("#favicon-preview");
    if (favicon && preview) favicon.href = preview.src;
  }
  if (submit) { submit.disabled = false; submit.textContent = "保存设置"; }
  settingsSaveBusy = false;
  if (wallpaperFiles) wallpaperFiles.disabled = false;
  renderWallpaperLibrary();
});
$("#password-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  if (
    await action("auth", {
      action: "password",
      oldPassword: getInput(form, "oldPassword").value,
      newPassword: getInput(form, "newPassword").value,
    })
  )
    form.reset();
});

type Stats = {
  summary: { sites: number; categories: number };
  metrics: {
    today: number;
    yesterday: number;
    last7: number;
    last30: number;
    total: number;
  };
  pageMetrics: {
    today: number;
    yesterday: number;
    last7: number;
    last30: number;
    total: number;
    unique: number;
  };
  daily: { date: string; count: number }[];
  pageDaily: { date: string; count: number }[];
  popular: { title: string; count: number }[];
  devices: { name: string | null; count: number }[];
  browsers: { name: string | null; count: number }[];
  operatingSystems: { name: string | null; count: number }[];
  countries: { name: string | null; count: number }[];
  sources: { name: string | null; count: number }[];
};
async function loadStats() {
  try {
    const days = $<HTMLSelectElement>("#stats-days")?.value || "7";
    const start = $<HTMLInputElement>("#stats-start")?.value;
    const end = $<HTMLInputElement>("#stats-end")?.value;
    const range =
      days === "custom" && start && end
        ? `start=${start}&end=${end}`
        : `days=${days}`;
    const data = await api<Stats>(`stats?${range}`);
    const summary = $("#summary-cards");
    if (summary) {
      summary.replaceChildren();
      for (const [label, value] of [
        ["网站总数", data.summary.sites],
        ["分类总数", data.summary.categories],
        ["今日浏览", data.pageMetrics.today],
        ["昨日浏览", data.pageMetrics.yesterday],
        ["最近 7 天浏览", data.pageMetrics.last7],
        ["最近 30 天浏览", data.pageMetrics.last30],
        ["所选时段访客", data.pageMetrics.unique],
        ["累计浏览", data.pageMetrics.total],
        ["网站点击", data.metrics.total],
      ] as const) {
        const card = el("div", "summary-card");
        card.append(el("small", "", label), el("strong", "", String(value)));
        summary.append(card);
      }
    }
    const popular = $("#popular-list");
    if (popular) {
      popular.replaceChildren();
      for (const item of data.popular) {
        const row = el("div", "admin-row");
        row.append(
          el("strong", "", item.title),
          el("small", "", String(item.count)),
        );
        popular.append(row);
      }
    }
    const echarts = await import("./charts");
    function chart(id: string, option: EChartsOption) {
      const node = document.getElementById(id);
      if (!node) return;
      chartObservers.get(id)?.disconnect();
      const old = echarts.getInstanceByDom(node);
      old?.dispose();
      const instance = echarts.init(node);
      instance.setOption(option);
      const observer = new ResizeObserver(() => instance.resize());
      observer.observe(node);
      chartObservers.set(id, observer);
    }
    const dates = [...new Set([...data.pageDaily.map((item) => item.date), ...data.daily.map((item) => item.date)])].sort();
    const pageCounts = new Map(data.pageDaily.map((item) => [item.date, Number(item.count)]));
    const clickCounts = new Map(data.daily.map((item) => [item.date, Number(item.count)]));
    const line: EChartsOption = {
      tooltip: { trigger: "axis" },
      legend: { data: ["页面浏览", "网站点击"], textStyle: { color: "#606064" } },
      grid: { left: 38, right: 20, top: 48, bottom: 25 },
      xAxis: { type: "category", data: dates },
      yAxis: { type: "value", minInterval: 1 },
      series: [
        {
          name: "页面浏览",
          type: "line",
          smooth: true,
          data: dates.map((date) => pageCounts.get(date) || 0),
          areaStyle: { color: "rgba(20,20,20,.09)" },
          itemStyle: { color: "#171717" },
        },
        {
          name: "网站点击",
          type: "line",
          smooth: true,
          data: dates.map((date) => clickCounts.get(date) || 0),
          itemStyle: { color: "#929292" },
        },
      ],
    };
    chart("dashboard-chart", line);
    chart("stats-chart", line);
    for (const [id, values] of [
      ["device-chart", data.devices],
      ["browser-chart", data.browsers],
      ["os-chart", data.operatingSystems],
      ["country-chart", data.countries],
      ["source-chart", data.sources],
    ] as const)
      chart(id, {
        tooltip: { trigger: "item" },
        color: ["#171717", "#545454", "#858585", "#aaa", "#d3d3d3"],
        series: [
          {
            type: "pie",
            radius: ["42%", "70%"],
            data: values.map((item) => ({
              name: item.name || "Unknown",
              value: Number(item.count),
            })),
          },
        ],
      });
  } catch (error) {
    message(error instanceof Error ? error.message : "统计加载失败", true);
  }
}
$("#stats-days")?.addEventListener("change", () => void loadStats());
$("#stats-start")?.addEventListener("change", () => {
  if ($<HTMLSelectElement>("#stats-days")?.value === "custom") void loadStats();
});
$("#stats-end")?.addEventListener("change", () => {
  if ($<HTMLSelectElement>("#stats-days")?.value === "custom") void loadStats();
});
if ($("#admin-nav")) {
  void loadCategories()
    .then(() => showView(location.hash.slice(1) || "dashboard"))
    .catch((error) =>
      message(error instanceof Error ? error.message : "初始化失败", true),
    );
}
