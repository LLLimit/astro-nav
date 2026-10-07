export {};
import { CATEGORY_PREVIEW_LIMIT } from "../lib/category-display";
const input = document.querySelector<HTMLInputElement>("#search-input");
const mode = document.querySelector<HTMLInputElement>("#search-mode");
const results = document.querySelector<HTMLDivElement>("#search-results");
const cards = [...document.querySelectorAll<HTMLAnchorElement>(".site-card")];
const sitePreview = document.createElement("div");
sitePreview.className = "site-preview";
sitePreview.id = "site-preview";
sitePreview.setAttribute("role", "tooltip");
sitePreview.hidden = true;
document.body.append(sitePreview);
function hideSitePreview() {
  sitePreview.hidden = true;
}
function showSitePreview(card: HTMLAnchorElement) {
  const description = card.dataset.preview?.trim();
  if (!description) return;
  sitePreview.textContent = description;
  sitePreview.hidden = false;
  const cardBox = card.getBoundingClientRect();
  const width = sitePreview.offsetWidth;
  const height = sitePreview.offsetHeight;
  const left = Math.max(12, Math.min(cardBox.left, window.innerWidth - width - 12));
  const below = cardBox.bottom + 9;
  const top = below + height <= window.innerHeight - 12 ? below : Math.max(12, cardBox.top - height - 9);
  sitePreview.style.left = `${left}px`;
  sitePreview.style.top = `${top}px`;
}
for (const card of cards) {
  card.addEventListener("mouseenter", () => showSitePreview(card));
  card.addEventListener("mouseleave", hideSitePreview);
  card.addEventListener("focus", () => showSitePreview(card));
  card.addEventListener("blur", hideSitePreview);
}
window.addEventListener("scroll", hideSitePreview, { passive: true });
window.addEventListener("resize", hideSitePreview);
for (const section of document.querySelectorAll<HTMLElement>(".category-section")) {
  const buttons = [...section.querySelectorAll<HTMLButtonElement>("[data-subcategory]")];
  const sectionCards = [...section.querySelectorAll<HTMLAnchorElement>(".site-card")];
  const grid = section.querySelector<HTMLElement>(".site-grid");
  const count = section.querySelector<HTMLElement>(".section-count");
  const empty = section.querySelector<HTMLElement>("[data-category-empty]");
  const more = section.querySelector<HTMLElement>("[data-category-more]");
  const expand = section.querySelector<HTMLButtonElement>("[data-category-expand]");
  const expandLabel = expand?.querySelector<HTMLElement>("[data-category-expand-label]");
  const expandedTabs = new Set<string>();
  let selected = buttons[0]?.dataset.subcategory || "all";

  function displayCategoryCards() {
    const expanded = expandedTabs.has(selected);
    let matching = 0;
    for (const card of sectionCards) {
      const matches = selected === "all" || card.dataset.subcategoryId === selected;
      card.hidden = !matches || (!expanded && matching >= CATEGORY_PREVIEW_LIMIT);
      if (matches) matching++;
    }
    if (count) count.textContent = `${matching} 个网站`;
    if (empty) empty.hidden = matching > 0;
    if (more) more.hidden = matching <= CATEGORY_PREVIEW_LIMIT;
    expand?.setAttribute("aria-expanded", String(expanded && matching > CATEGORY_PREVIEW_LIMIT));
    if (expandLabel) expandLabel.textContent = expanded ? "收起"
      : `展开全部（还有 ${Math.max(0, matching - CATEGORY_PREVIEW_LIMIT)} 个）`;
  }
  function animateCategoryCards() {
    if (!grid || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    grid.classList.remove("category-switch");
    void grid.offsetWidth;
    grid.classList.add("category-switch");
  }
  expand?.addEventListener("click", () => {
    hideSitePreview();
    const collapsing = expandedTabs.has(selected);
    if (collapsing) expandedTabs.delete(selected);
    else expandedTabs.add(selected);
    displayCategoryCards();
    animateCategoryCards();
    // The footer button moves upward when a long list closes. Keep the user
    // with this category instead of leaving them inside the following panel.
    if (collapsing && section.getBoundingClientRect().top < 0)
      scrollToCategory(section, matchMedia("(prefers-reduced-motion:reduce)").matches ? "instant" : "smooth");
  });
  displayCategoryCards();
  for (const [index, button] of buttons.entries()) {
    button.addEventListener("click", () => {
      if (button.getAttribute("aria-pressed") === "true") return;
      hideSitePreview();
      selected = button.dataset.subcategory || "all";
      for (const tab of buttons) {
        const active = tab === button;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-pressed", String(active));
      }
      displayCategoryCards();
      animateCategoryCards();
    });
    button.addEventListener("keydown", (event) => {
      const target = event.key === "ArrowRight" ? (index + 1) % buttons.length
        : event.key === "ArrowLeft" ? (index - 1 + buttons.length) % buttons.length
        : event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : -1;
      if (target < 0) return;
      event.preventDefault();
      buttons[target].focus();
      buttons[target].click();
    });
  }
}
const engines: Record<string, string> = {
  google: "https://www.google.com/search?q=",
  bing: "https://www.bing.com/search?q=",
  baidu: "https://www.baidu.com/s?wd=",
  duckduckgo: "https://duckduckgo.com/?q=",
};
const engineNames: Record<string, string> = {
  baidu: "百度",
  google: "Google",
  bing: "Bing",
  duckduckgo: "DuckDuckGo",
};
const hint = document.querySelector<HTMLElement>(".search-shell kbd");
if (hint && !/Mac/i.test(navigator.userAgent)) hint.textContent = "Ctrl K";
let active = 0;
let shown: HTMLAnchorElement[] = [];
let lastEngine = "baidu";

function addHighlight(parent: HTMLElement, value: string, term: string) {
  const index = value.toLowerCase().indexOf(term.toLowerCase());
  if (index < 0) {
    parent.textContent = value;
    return;
  }
  parent.append(document.createTextNode(value.slice(0, index)));
  const mark = document.createElement("mark");
  mark.textContent = value.slice(index, index + term.length);
  parent.append(
    mark,
    document.createTextNode(value.slice(index + term.length)),
  );
}
function hide() {
  if (results && input) {
    results.hidden = true;
    input.setAttribute("aria-expanded", "false");
  }
}
function render() {
  if (!input || !results || !mode) return;
  results.replaceChildren();
  shown = [];
  active = 0;
  const term = input.value.trim();
  if (!term || mode.value !== "local") {
    hide();
    return;
  }
  shown = cards
    .filter((card) =>
      (card.dataset.search || "").toLowerCase().includes(term.toLowerCase()),
    )
    .slice(0, 10);
  if (!shown.length) {
    const empty = document.createElement("p");
    empty.className = "search-empty";
    empty.textContent = "没有找到相关网站";
    results.append(empty);
  }
  for (const [index, card] of shown.entries()) {
    const option = document.createElement("button");
    option.type = "button";
    option.className = "search-option";
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", String(index === active));
    const title = document.createElement("strong");
    addHighlight(title, card.querySelector("strong")?.textContent || "", term);
    const domain = document.createElement("small");
    domain.textContent = new URL(card.href).hostname;
    option.append(title, domain);
    option.addEventListener("click", () => openCard(card));
    results.append(option);
  }
  results.hidden = false;
  input.setAttribute("aria-expanded", "true");
}
function openCard(card: HTMLAnchorElement) {
  track(card);
  window.open(card.href, "_blank", "noopener,noreferrer");
  hide();
}
function track(card: HTMLAnchorElement) {
  const siteId = Number(card.dataset.siteId);
  sendVisit({
    type: "click",
    siteId,
    referrer: document.referrer.slice(0, 512),
  });
}
function sendVisit(event: { type: "pageview" | "click"; siteId?: number; referrer: string }) {
  const body = JSON.stringify(event);
  try {
    if (navigator.sendBeacon && navigator.sendBeacon(
        "/api/visit",
        new Blob([body], { type: "application/json" }),
      )) return;
      void fetch("/api/visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      });
  } catch {
    /* Navigation must continue. */
  }
}
sendVisit({ type: "pageview", referrer: document.referrer.slice(0, 512) });
cards.forEach((card) => card.addEventListener("click", () => track(card)));
function setSearchMode(value: string) {
  if (!mode || !input || !(value === "local" || engines[value])) return;
  mode.value = value;
  if (engines[value]) lastEngine = value;
  input.placeholder =
    value === "local"
      ? "搜索网站、描述、分类或标签..."
      : `${engineNames[value]}一下...`;
  document
    .querySelectorAll<HTMLButtonElement>("[data-search-tab]")
    .forEach((button) => {
      const selected = button.dataset.searchTab === (value === "local" ? "local" : "web");
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  document
    .querySelectorAll<HTMLButtonElement>("[data-search-engine]")
    .forEach((button) =>
      button.classList.toggle("active", button.dataset.searchEngine === value),
    );
  try {
    localStorage.setItem("nav-search-mode", value);
  } catch {}
  render();
}
try {
  const saved = localStorage.getItem("nav-search-mode");
  if (saved && ["local", ...Object.keys(engines)].includes(saved))
    setSearchMode(saved);
} catch {}
document
  .querySelectorAll<HTMLButtonElement>("[data-search-tab]")
  .forEach((button) =>
    button.addEventListener("click", () => {
      setSearchMode(button.dataset.searchTab === "local" ? "local" : lastEngine);
      input?.focus();
    }),
  );
document
  .querySelectorAll<HTMLButtonElement>("[data-search-engine]")
  .forEach((button) =>
    button.addEventListener("click", () => {
      setSearchMode(button.dataset.searchEngine || "baidu");
      input?.focus();
    }),
  );
function submitSearch() {
  if (!mode || !input || !input.value.trim()) {
    input?.focus();
    return;
  }
  if (mode.value === "local") {
    render();
    if (shown[active]) openCard(shown[active]);
    else input.focus();
  } else if (engines[mode.value]) {
    window.open(
      engines[mode.value] + encodeURIComponent(input.value.trim()),
      "_blank",
      "noopener,noreferrer",
    );
  }
}
document.querySelector<HTMLFormElement>("#search-container")?.addEventListener("submit", (event) => {
  event.preventDefault();
  submitSearch();
});
input?.addEventListener("input", render);
input?.addEventListener("keydown", (event) => {
  if (!mode || !input) return;
  if (event.key === "Escape") {
    hide();
    input.blur();
  }
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    active =
      (active + (event.key === "ArrowDown" ? 1 : -1) + shown.length) %
      (shown.length || 1);
    results
      ?.querySelectorAll(".search-option")
      .forEach((element, index) =>
        element.setAttribute("aria-selected", String(index === active)),
      );
  }
  if (event.key === "Enter") {
    event.preventDefault();
    submitSearch();
  }
});
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    input?.focus();
    input?.select();
  }
});
document.addEventListener("click", (event) => {
  if (!(event.target as HTMLElement).closest("#search-container")) hide();
});
const themeToggle = document.querySelector<HTMLButtonElement>("#theme-toggle");
const glassToggle = document.querySelector<HTMLButtonElement>("#glass-toggle");
const glassConfirm = document.querySelector<HTMLDialogElement>("#glass-confirm");
type Theme = "light" | "dark" | "glass";
const currentTheme = (): Theme => {
  const value = document.documentElement.dataset.theme;
  return value === "dark" || value === "glass" ? value : "light";
};
let lastSolidTheme: "light" | "dark" = "light";
try {
  lastSolidTheme = localStorage.getItem("nav-solid-theme") === "dark" ? "dark" : "light";
} catch {}
if (currentTheme() !== "glass") lastSolidTheme = currentTheme() as "light" | "dark";
function syncThemeButtons() {
  const current = currentTheme();
  const next = current === "glass" ? lastSolidTheme : current === "light" ? "dark" : "light";
  themeToggle?.setAttribute("aria-label", `切换到${next === "dark" ? "深色" : "明亮"}主题`);
  if (themeToggle) themeToggle.title = `切换到${next === "dark" ? "深色" : "明亮"}主题`;
  glassToggle?.setAttribute("aria-pressed", String(current === "glass"));
  glassToggle?.setAttribute("aria-label", current === "glass" ? "关闭液态玻璃主题" : "启用液态玻璃主题");
  if (glassToggle) glassToggle.title = current === "glass" ? "关闭液态玻璃主题" : "启用液态玻璃主题";
}
function setTheme(next: Theme) {
  if (next !== "glass") {
    lastSolidTheme = next;
    try { localStorage.setItem("nav-solid-theme", next); } catch {}
  }
  document.documentElement.dataset.theme = next;
  syncThemeButtons();
  try { localStorage.setItem("nav-theme", next); } catch {}
}
syncThemeButtons();
themeToggle?.addEventListener("click", () => {
  const current = currentTheme();
  setTheme(current === "glass" ? lastSolidTheme : current === "light" ? "dark" : "light");
  themeToggle.classList.remove("spin-once");
  void themeToggle.offsetWidth;
  themeToggle.classList.add("spin-once");
});
glassToggle?.addEventListener("click", () => {
  if (currentTheme() === "glass") {
    setTheme(lastSolidTheme);
    return;
  }
  let consent = false;
  try { consent = localStorage.getItem("nav-glass-consent") === "yes"; } catch {}
  if (consent) { setTheme("glass"); return; }
  glassConfirm?.showModal();
});
glassConfirm?.addEventListener("close", () => {
  if (glassConfirm.returnValue !== "confirm") return;
  try { localStorage.setItem("nav-glass-consent", "yes"); } catch {}
  setTheme("glass");
});
let glassRenderer: import("./liquid-glass").GlassRenderer | null = null;
let glassGeneration = 0;
async function syncGlassRenderer() {
  const generation = ++glassGeneration;
  glassRenderer?.destroy();
  glassRenderer = null;
  if (currentTheme() !== "glass") return;
  const { createLiquidGlass } = await import("./liquid-glass");
  if (generation !== glassGeneration || currentTheme() !== "glass") return;
  const renderer = await createLiquidGlass(() => generation === glassGeneration && currentTheme() === "glass");
  if (generation !== glassGeneration || currentTheme() !== "glass") renderer?.destroy();
  else glassRenderer = renderer;
}
new MutationObserver(() => { void syncGlassRenderer(); }).observe(document.documentElement, {
  attributes: true, attributeFilter: ["data-theme"],
});
void syncGlassRenderer();
matchMedia("(prefers-reduced-transparency: reduce)").addEventListener("change", () => { void syncGlassRenderer(); });
const collapse = document.querySelector<HTMLButtonElement>("#sidebar-collapse");
const sidebar = document.querySelector<HTMLElement>("#sidebar");
function sizeSidebar() {
  const layout = sidebar?.parentElement;
  if (!sidebar || !layout) return;
  const naturalTop = layout.getBoundingClientRect().top + window.scrollY;
  sidebar.style.setProperty(
    "--rail-height",
    `${Math.max(180, window.innerHeight - naturalTop - 16)}px`,
  );
}
sizeSidebar();
window.addEventListener("resize", sizeSidebar);
document.fonts?.ready.then(sizeSidebar);
sidebar?.parentElement?.addEventListener("transitionend", (event) => {
  if (event.propertyName === "grid-template-columns") window.dispatchEvent(new Event("resize"));
});
function setSidebarCollapsed(collapsed: boolean) {
  document.body.classList.toggle("sidebar-collapsed", collapsed);
  collapse?.setAttribute("aria-label", collapsed ? "展开侧边栏" : "收起侧边栏");
  collapse?.setAttribute("aria-expanded", String(!collapsed));
  collapse?.setAttribute("title", collapsed ? "展开侧边栏" : "收起侧边栏");
}
try {
  const saved = localStorage.getItem("nav-sidebar-collapsed");
  setSidebarCollapsed(saved === null ? matchMedia("(max-width:620px)").matches : saved === "true");
} catch { setSidebarCollapsed(matchMedia("(max-width:620px)").matches); }
collapse?.addEventListener("click", () => {
  const collapsed = !document.body.classList.contains("sidebar-collapsed");
  setSidebarCollapsed(collapsed);
  try {
    localStorage.setItem("nav-sidebar-collapsed", String(collapsed));
  } catch {}
});
const sections = [...document.querySelectorAll<HTMLElement>(".category-section")];
const categoryLinks = [...document.querySelectorAll<HTMLAnchorElement>(".side-link")];
let requestedSection: HTMLElement | null = null;
let categoryFrame = 0;
let categoryLayoutTimer: ReturnType<typeof setTimeout> | undefined;

function highlightCategory(section: HTMLElement) {
  for (const link of categoryLinks) {
    const selected = link.hash === `#${section.id}`;
    link.classList.toggle("active", selected);
    if (selected) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  }
}
function updateCategoryPosition() {
  categoryFrame = 0;
  if (!sections.length) return;
  // An anchor may stop at the document's scroll limit. Keep the clicked
  // category selected even when later, shorter sections are also visible.
  if (requestedSection) { highlightCategory(requestedSection); return; }
  const marker = Math.min(100, window.innerHeight * 0.12);
  let current = sections[0];
  for (const section of sections) {
    if (section.getBoundingClientRect().top > marker) break;
    current = section;
  }
  if (window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2)
    current = sections[sections.length - 1];
  highlightCategory(current);
}
function scheduleCategoryPosition() {
  if (!categoryFrame) categoryFrame = requestAnimationFrame(updateCategoryPosition);
}
function categoryFromHash() {
  return sections.find((section) => `#${section.id}` === location.hash) ?? null;
}
function scrollToCategory(section: HTMLElement, behavior: ScrollBehavior) {
  requestedSection = section;
  highlightCategory(section);
  section.scrollIntoView({ block: "start", behavior });
}
for (const link of categoryLinks) {
  link.addEventListener("click", (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const section = sections.find((item) => `#${item.id}` === link.hash);
    if (!section) return;
    event.preventDefault();
    hideSitePreview();
    if (location.hash !== link.hash) history.pushState(null, "", link.hash);
    scrollToCategory(section, matchMedia("(prefers-reduced-motion:reduce)").matches ? "instant" : "smooth");
  });
}
function releaseCategoryNavigation() {
  requestedSection = null;
  scheduleCategoryPosition();
}
window.addEventListener("wheel", releaseCategoryNavigation, { passive: true });
window.addEventListener("touchmove", releaseCategoryNavigation, { passive: true });
document.addEventListener("keydown", (event) => {
  if ((event.target as Element)?.closest("input,textarea,select,[contenteditable],[data-subcategory]")) return;
  if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(event.key)) releaseCategoryNavigation();
});
document.addEventListener("pointerdown", (event) => {
  if (event.clientX >= document.documentElement.clientWidth) releaseCategoryNavigation();
});
window.addEventListener("scroll", scheduleCategoryPosition, { passive: true });
window.addEventListener("hashchange", () => {
  requestedSection = categoryFromHash();
  categoryLayoutChanged();
});
// Fonts, collapsing the rail and changing child tabs can resize earlier panels.
// Re-align after layout settles, rather than letting the old anchor drift.
function categoryLayoutChanged() {
  scheduleCategoryPosition();
  if (categoryLayoutTimer) clearTimeout(categoryLayoutTimer);
  categoryLayoutTimer = setTimeout(() => {
    if (requestedSection) scrollToCategory(requestedSection, "instant");
  }, 180);
}
const categoryResizeObserver = new ResizeObserver(categoryLayoutChanged);
sections.forEach((section) => categoryResizeObserver.observe(section));
window.addEventListener("resize", categoryLayoutChanged);
document.fonts?.ready.then(categoryLayoutChanged);
requestedSection = categoryFromHash();
updateCategoryPosition();
const backToTop = document.querySelector<HTMLButtonElement>("#back-to-top");
window.addEventListener(
  "scroll",
  () => {
    backToTop?.classList.toggle("visible", window.scrollY > 400);
  },
  { passive: true },
);
backToTop?.addEventListener("click", () => {
  releaseCategoryNavigation();
  window.scrollTo({
    top: 0,
    behavior: matchMedia("(prefers-reduced-motion:reduce)").matches
      ? "auto"
      : "smooth",
  });
});
