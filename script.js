let siteData;
let activeCategory = "全部";
let activeNewsPage = 1;
let heroIndex = 0;
let heroTimer;
let awardIndex = 0;
let awardTimer;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const linkTarget = (href = "") => String(href).startsWith("http") ? "_blank" : "_self";
const isExternalHref = (href = "") => /^https?:\/\//i.test(String(href));
const isOriginalDeptLink = (href = "") => /^https?:\/\/(n063|ai)\.ncut\.edu\.tw/i.test(String(href));
const archiveKey = (href = "") => String(href).replace(/^https?:\/\/(n063|ai)\.ncut\.edu\.tw/i, "").replace(/#.*$/, "");
const isRetiredOfficialHref = (href = "") => /official(?:-detail)?\.html/i.test(String(href));
const isLegacyImportEntry = (item = {}) => /原系網|匯入資料/.test(`${item.label || ""} ${item.title || ""} ${item.type || ""}`) || isRetiredOfficialHref(item.href);
const isBlockedSiteImage = (src = "") => /linkdet_1436_2272241_19992\.png/i.test(String(src));
const debounce = (callback, delay = 180) => {
  let timer;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => callback(...args), delay);
  };
};
let languageService;
let pageLoader;

class LanguageService {
  constructor({ publicOrigin, publicBasePath }) {
    this.publicOrigin = publicOrigin;
    this.publicBasePath = publicBasePath;
    this.translateKeys = ["_x_tr_sl", "_x_tr_tl", "_x_tr_hl", "_x_tr_pto"];
  }

  isTranslateProxyPage() {
    return location.hostname.endsWith(".translate.goog");
  }

  englishHref(href = location.href) {
    const sourceUrl = this.publicSiteUrlFor(href);
    const translated = new URL(sourceUrl.href);
    translated.protocol = "https:";
    translated.hostname = this.isTranslateProxyPage() ? location.hostname : this.translateProxyHost(sourceUrl.hostname);
    translated.searchParams.set("_x_tr_sl", "zh-TW");
    translated.searchParams.set("_x_tr_tl", "en");
    translated.searchParams.set("_x_tr_hl", "en");
    translated.searchParams.set("_x_tr_pto", "wapp");
    return translated.href;
  }

  translateProxyHost(hostname) {
    return `${hostname.replace(/\./g, "-")}.translate.goog`;
  }

  publicSiteUrlFor(href = location.href) {
    const url = new URL(href, location.href);
    if (this.isTranslateProxyPage()) {
      this.translateKeys.forEach((key) => url.searchParams.delete(key));
    }
    if (/^(localhost|127\.0\.0\.1)$/i.test(url.hostname)) {
      const publicUrl = new URL(this.publicOrigin);
      publicUrl.pathname = `${this.publicBasePath}${url.pathname === "/" ? "/" : url.pathname}`;
      publicUrl.search = url.search;
      publicUrl.hash = "";
      return publicUrl;
    }
    url.hash = "";
    return url;
  }
}

class PageLoader {
  static skipIntroStorageKey = "ncut-ai-skip-intro";
  static skipIntroUrlKey = "_ncut_skip_intro";
  static continueTransitionStorageKey = "ncut-ai-continue-transition";
  static returnTransitionStoragePrefix = "ncut-ai-return-transition:";

  constructor({ fullMotion = true, exit = false, skipMinimum = false, hidden = false, continuing = false } = {}) {
    this.startedAt = Date.now();
    this.skipMinimum = skipMinimum;
    this.element = document.createElement("div");
    this.element.className = `site-loader${fullMotion ? " is-full-motion" : ""}${exit ? " is-exit-loader" : ""}${hidden ? " is-skip-intro" : ""}${continuing ? " is-continuing" : ""}`;
    this.element.setAttribute("aria-hidden", "true");
    this.element.innerHTML = PageLoader.markup();
  }

  static markup() {
    return `
      <div class="loader-stage">
        <div class="loader-word">Artificial Intelligence</div>
        <div class="loader-mark">
          <span></span>
          <img src="./assets/ai-official-icon.png" alt="">
        </div>
      </div>
      <small>Department of Artificial Intelligence and Computer Engineering</small>
    `;
  }

  static startIntro() {
    const continueTransition = PageLoader.consumeContinueTransition();
    if (continueTransition) {
      const loader = new PageLoader({ fullMotion: false, skipMinimum: true, continuing: true });
      loader.mount();
      return loader;
    }
    if (PageLoader.isBackForwardNavigation()) {
      const loader = new PageLoader({ fullMotion: false, continuing: true });
      loader.mount();
      return loader;
    }
    if (PageLoader.consumeReturnTransition()) {
      const loader = new PageLoader({ fullMotion: false, continuing: true });
      loader.mount();
      return loader;
    }
    const skipIntro = PageLoader.consumeSkipIntro();
    if (skipIntro) return PageLoader.noop();
    const loader = new PageLoader({ fullMotion: !skipIntro, skipMinimum: skipIntro });
    loader.mount();
    return loader;
  }

  static showExit() {
    document.querySelector(".site-loader.is-exit-loader")?.remove();
    const loader = new PageLoader({ fullMotion: true, exit: true });
    loader.mount();
    document.body.classList.add("is-exiting-page");
    requestAnimationFrame(() => loader.element.classList.add("is-active"));
    return loader;
  }

  static clearExitState() {
    document.querySelectorAll(".site-loader.is-exit-loader").forEach((loader) => loader.remove());
    document.body.classList.remove("is-exiting-page");
    if (!document.querySelector(".site-loader:not(.is-exit-loader)")) {
      document.body.classList.remove("is-loading");
    }
  }

  static showReturn() {
    PageLoader.clearExitState();
    const loader = new PageLoader({ fullMotion: false, continuing: true });
    loader.mount();
    return loader;
  }

  static consumeSkipIntro() {
    const url = new URL(location.href);
    const urlRequestsSkip = url.searchParams.get(PageLoader.skipIntroUrlKey) === "1";
    if (urlRequestsSkip) {
      url.searchParams.delete(PageLoader.skipIntroUrlKey);
      history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
    try {
      const shouldSkip = sessionStorage.getItem(PageLoader.skipIntroStorageKey) === "1";
      if (shouldSkip) sessionStorage.removeItem(PageLoader.skipIntroStorageKey);
      return urlRequestsSkip || shouldSkip;
    } catch {
      return urlRequestsSkip;
    }
  }

  static skipNextIntro() {
    try {
      sessionStorage.setItem(PageLoader.skipIntroStorageKey, "1");
    } catch {
      // sessionStorage can be unavailable in strict privacy modes.
    }
  }

  static continueNextTransition() {
    try {
      sessionStorage.setItem(PageLoader.continueTransitionStorageKey, "1");
    } catch {
      // sessionStorage can be unavailable in strict privacy modes.
    }
  }

  static rememberReturnTransition(href = location.href) {
    try {
      sessionStorage.setItem(PageLoader.returnTransitionStoragePrefix + PageLoader.locationKey(href), "1");
    } catch {
      // sessionStorage can be unavailable in strict privacy modes.
    }
  }

  static consumeContinueTransition() {
    try {
      const shouldContinue = sessionStorage.getItem(PageLoader.continueTransitionStorageKey) === "1";
      if (shouldContinue) sessionStorage.removeItem(PageLoader.continueTransitionStorageKey);
      return shouldContinue;
    } catch {
      return false;
    }
  }

  static isBackForwardNavigation() {
    const navigation = performance.getEntriesByType?.("navigation")?.[0];
    return navigation?.type === "back_forward";
  }

  static consumeReturnTransition(href = location.href) {
    try {
      const key = PageLoader.returnTransitionStoragePrefix + PageLoader.locationKey(href);
      const shouldShow = sessionStorage.getItem(key) === "1";
      if (shouldShow) sessionStorage.removeItem(key);
      return shouldShow;
    } catch {
      return false;
    }
  }

  static locationKey(href) {
    const url = new URL(href, location.href);
    url.hash = "";
    return `${url.origin}${url.pathname}${url.search}`;
  }

  static withSkipIntro(href) {
    const url = new URL(href, location.href);
    url.searchParams.set(PageLoader.skipIntroUrlKey, "1");
    return url.href;
  }

  static noop() {
    return { hide() {} };
  }

  mount() {
    document.body.classList.add("is-loading");
    document.body.prepend(this.element);
  }

  hide(immediate = false) {
    const minimumDuration = this.skipMinimum ? 0 : 2300;
    const wait = immediate ? 0 : Math.max(0, minimumDuration - (Date.now() - this.startedAt));
    window.setTimeout(() => {
      this.element.classList.add("is-done");
      document.body.classList.remove("is-loading");
      window.setTimeout(() => {
        this.element.remove();
      }, this.skipMinimum ? 0 : 1300);
    }, wait);
  }
}

function isTranslateProxyPage() {
  return languageService.isTranslateProxyPage();
}

function englishTranslateHref(href = location.href) {
  return languageService.englishHref(href);
}

function showPageTransition() {
  return PageLoader.showExit();
}

languageService = new LanguageService({
  publicOrigin: "https://ncutaiweb.github.io",
  publicBasePath: "/ncut-ai-website"
});
pageLoader = PageLoader.startIntro();

function archiveLink(link, archive) {
  const href = link?.href || "";
  if (!href) return null;
  const cleanLabel = (value = "") => String(value)
    .replace(/\(原頁面開啟\)|\(另開新視窗\)|Click to go\s*/gi, "")
    .trim();
  const rawLabel = cleanLabel(link.label || link.title || "");
  if (/^(跳到主要內容區|首頁|回首頁|English|:::|LINK)$/i.test(rawLabel)) return null;
  if (!isOriginalDeptLink(href)) return { href, label: rawLabel || href, external: href.startsWith("http") };
  return null;
}

async function loadSite() {
  const response = await fetch("./data/site.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`site.json ${response.status}`);
  siteData = await response.json();
  normalizeSiteData();
  siteData = SiteReferences.resolve(siteData);
  document.body.classList.toggle("is-inner-page", !$("[data-hero]"));
  renderShared();
  renderMegaMenu();
  if ($("[data-hero]")) renderHome();
  if ($("[data-page]")) renderPage();
  if ($("[data-faculty-list]")) renderFacultyPage();
  if ($("[data-faculty-detail]")) renderFacultyDetail();
  if (location.pathname.endsWith("news.html")) renderNewsPage();
  if ($("[data-news-detail]")) renderNewsDetail();
  if ($("[data-official-list]")) renderOfficialArchive();
  if ($("[data-official-detail]")) renderOfficialDetail();
  if ($("[data-student-detail]")) renderStudentResourceDetail();
  if ($("[data-resource-list]")) renderResources();
  if ($("[data-campus-links]")) renderCampusLinks();
  if ($("[data-original-home]")) renderOriginalHome();
  if ($("[data-awards-page]")) renderAwardsPage();
  setupInteractions();
  pageLoader.hide();
}

function normalizeSiteData() {
  const teacherNameCorrections = new Map([
    ["黃馨琳", "黃詰琳"]
  ]);
  (siteData.faculty || []).forEach((person) => {
    if (teacherNameCorrections.has(person.name)) {
      person.name = teacherNameCorrections.get(person.name);
    }
  });
}

function renderSiteError(error) {
  pageLoader.hide(true);
  document.body.classList.add("has-site-error");
  document.querySelector(".site-error")?.remove();
  const safeMessage = esc(error?.message || "未知錯誤");
  document.body.insertAdjacentHTML("afterbegin", `
    <section class="site-error" role="alert" aria-live="assertive">
      <div>
        <p class="section-kicker">System Notice</p>
        <h1>網站資料暫時無法載入</h1>
        <p>目前無法取得系網資料，請重新整理頁面；若仍無法顯示，請確認伺服器是否正在執行，或檢查 <code>data/site.json</code> 是否存在。</p>
        <p class="site-error-code">錯誤資訊：${safeMessage}</p>
        <div class="hero-actions">
          <button class="primary-action" type="button" data-reload-page>重新整理</button>
          <a class="secondary-action" href="./">返回首頁</a>
        </div>
      </div>
    </section>
  `);
  document.querySelector("[data-reload-page]")?.addEventListener("click", () => location.reload());
}

function renderEmptyState(title, text, actions = []) {
  return `
    <article class="empty-state" role="status">
      <span class="empty-state-mark" aria-hidden="true">AI</span>
      <div>
        <p class="section-kicker">No Results</p>
        <h2>${esc(title)}</h2>
        <p>${esc(text)}</p>
        ${actions.length ? `<div class="empty-state-actions">${actions.map((action) => `<a class="${esc(action.className || "text-link")}" href="${esc(action.href)}">${esc(action.label)}</a>`).join("")}</div>` : ""}
      </div>
    </article>
  `;
}

function renderShared() {
  updateDocumentMeta();
  const englishHref = englishTranslateHref();
  const navMarkup = `
    <a href="./page.html?slug=history">系所介紹</a>
    <a href="./faculty.html">師資陣容</a>
    <a href="./awards.html">獲獎資訊</a>
    <a href="./page.html?slug=curriculum-careers">課程就業</a>
    <a href="./page.html?slug=labs">專業實驗室</a>
    <a href="./campus-links.html">校內連結</a>
    <a href="./news.html">最新消息</a>
    <a href="#contact">聯絡我們</a>`;
  $$("nav.site-nav").forEach((nav) => { nav.innerHTML = navMarkup; });
  $$(".utility-bar").forEach((bar) => {
    if (bar.querySelector("[data-translate-current]")) return;
    bar.insertAdjacentHTML("beforeend", `<a class="language-switch utility-language" href="${esc(englishHref)}" target="_blank" rel="noopener noreferrer" lang="en" data-translate-current aria-label="Translate this page to English">English</a>`);
  });
  markActiveNav();
  $$("[data-logo]").forEach((img) => { img.src = siteData.identity.logo; });
  $$("[data-footer-logo]").forEach((img) => { img.src = siteData.identity.footerLogo; });
  $$("[data-site-title]").forEach((el) => { el.textContent = siteData.identity.title; });
  $$("[data-site-subtitle]").forEach((el) => { el.textContent = siteData.identity.subtitle; });
  $$("[data-footer-title]").forEach((el) => { el.textContent = siteData.identity.title; });
  $$("[data-footer-subtitle]").forEach((el) => { el.textContent = siteData.identity.subtitle; });
  $$(".site-footer").forEach((footer) => {
    if (!footer.querySelector(".footer-bottom")) {
      footer.insertAdjacentHTML("beforeend", `<div class="footer-bottom">${esc(siteData.identity.copyright || "國立勤益科技大學人工智慧應用工程系 版權所有")}</div>`);
    }
  });
  $$("[data-contact]").forEach((el) => {
    el.innerHTML = `
      <p><strong>電話</strong> ${esc(siteData.contact.phone)}</p>
      <p><strong>信箱</strong> <a href="mailto:${esc(siteData.contact.email)}">${esc(siteData.contact.email)}</a></p>
      <p><strong>地址</strong> ${esc(siteData.contact.address)}</p>
      <p><strong>位置</strong> ${esc(siteData.contact.location)}</p>`;
  });
}

function markActiveNav() {
  const path = location.pathname.split("/").pop() || "index.html";
  const params = new URLSearchParams(location.search);
  const slug = params.get("slug") || "";
  const currentKey = path === "index.html" ? "home" :
    path === "faculty.html" || path === "faculty-detail.html" ? "faculty" :
    path === "awards.html" ? "awards" :
    path === "campus-links.html" ? "campus" :
    path === "resources.html" || path === "original.html" ? "resources" :
    path === "news.html" ? "news" :
    path === "page.html" && ["curriculum-careers"].includes(slug) ? "curriculum" :
    path === "page.html" && ["labs"].includes(slug) ? "labs" :
    path === "page.html" ? "about" : "";
  $$(".site-nav a").forEach((link) => {
    const href = link.getAttribute("href") || "";
    const key = href.includes("faculty") ? "faculty" :
      href.includes("awards") ? "awards" :
      href.includes("campus-links") ? "campus" :
      href.includes("news") ? "news" :
      href.includes("curriculum-careers") ? "curriculum" :
      href.includes("labs") ? "labs" :
      href.includes("history") ? "about" : "";
    const active = Boolean(key && key === currentKey);
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function updateDocumentMeta(title = document.title, description = "") {
  const siteTitle = siteData?.identity?.title || "人工智慧應用工程系";
  const subtitle = siteData?.identity?.subtitle || "Department of Artificial Intelligence and Computer Engineering";
  const allowSearchIndexing = siteData?.identity?.searchIndexing !== false;
  const isOfficialSite = siteData?.identity?.isOfficialSite !== false && !/測試|Preview/i.test(siteTitle);
  const organizationName = isOfficialSite ? `國立勤益科技大學${siteTitle}` : siteTitle;
  const desc = description || document.querySelector('meta[name="description"]')?.content ||
    "國立勤益科技大學人工智慧應用工程系網站，整合系所介紹、師資陣容、招生資訊、學生資源、校內連結與獲獎成果。";
  const siteRoot = new URL("./", location.href).href;
  const canonicalUrl = new URL(location.href);
  ["v", "audit", "_", "cache"].forEach((key) => canonicalUrl.searchParams.delete(key));
  canonicalUrl.hash = "";
  const url = canonicalUrl.href;
  const image = new URL(siteData?.identity?.defaultImage || siteData?.identity?.logo || "./assets/ai-official-icon.png", location.href).href;
  const logo = new URL(siteData?.identity?.logo || "./assets/ai-official-icon.png", location.href).href;
  const setMeta = (selector, attrs) => {
    let node = document.head.querySelector(selector);
    if (!node) {
      node = document.createElement("meta");
      document.head.append(node);
    }
    Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  };
  document.title = title;
  setMeta('meta[name="application-name"]', { name: "application-name", content: siteTitle });
  setMeta('meta[name="apple-mobile-web-app-title"]', { name: "apple-mobile-web-app-title", content: siteTitle });
  setMeta('meta[name="description"]', { name: "description", content: desc });
  setMeta('meta[property="og:site_name"]', { property: "og:site_name", content: organizationName });
  setMeta('meta[property="og:title"]', { property: "og:title", content: title });
  setMeta('meta[property="og:description"]', { property: "og:description", content: desc });
  setMeta('meta[property="og:type"]', { property: "og:type", content: "website" });
  setMeta('meta[property="og:url"]', { property: "og:url", content: url });
  setMeta('meta[property="og:image"]', { property: "og:image", content: image });
  setMeta('meta[property="og:image:secure_url"]', { property: "og:image:secure_url", content: image });
  setMeta('meta[property="og:image:width"]', { property: "og:image:width", content: "1200" });
  setMeta('meta[property="og:image:height"]', { property: "og:image:height", content: "630" });
  setMeta('meta[property="og:image:alt"]', { property: "og:image:alt", content: `${siteTitle} 系所形象圖` });
  setMeta('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
  setMeta('meta[name="twitter:title"]', { name: "twitter:title", content: title });
  setMeta('meta[name="twitter:description"]', { name: "twitter:description", content: desc });
  setMeta('meta[name="twitter:image"]', { name: "twitter:image", content: image });
  setMeta('meta[name="twitter:image:alt"]', { name: "twitter:image:alt", content: `${siteTitle} 系所形象圖` });
  setMeta('meta[name="robots"]', { name: "robots", content: allowSearchIndexing ? "index,follow,max-image-preview:large" : "noindex,nofollow" });
  ensureResourceHints();
  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.append(canonical);
  }
  canonical.href = url;
  let schema = document.head.querySelector("#site-schema");
  if (!schema) {
    schema = document.createElement("script");
    schema.type = "application/ld+json";
    schema.id = "site-schema";
    document.head.append(schema);
  }
  const graph = [
      {
        "@type": "WebSite",
        "@id": `${siteRoot}#website`,
        name: isOfficialSite ? `${siteTitle}｜國立勤益科技大學` : siteTitle,
        alternateName: isOfficialSite ? "NCUT AI" : "Website Preview",
        url: siteRoot,
        inLanguage: "zh-Hant-TW",
        potentialAction: {
          "@type": "SearchAction",
          target: `${siteRoot}news.html?q={search_term_string}`,
          "query-input": "required name=search_term_string"
        }
      },
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: title,
        description: desc,
        isPartOf: { "@id": `${siteRoot}#website` },
        inLanguage: "zh-Hant-TW",
        primaryImageOfPage: image
      }
  ];
  if (isOfficialSite) {
    graph.unshift({
      "@type": "CollegeOrUniversity",
      "@id": `${siteRoot}#organization`,
      name: organizationName,
      alternateName: subtitle,
      url: siteRoot,
      logo,
      email: siteData?.contact?.email,
      telephone: siteData?.contact?.phone,
      parentOrganization: {
        "@type": "CollegeOrUniversity",
        name: "國立勤益科技大學",
        url: "https://www.ncut.edu.tw/"
      },
      address: {
        "@type": "PostalAddress",
        streetAddress: siteData?.contact?.address,
        addressLocality: "臺中市",
        addressRegion: "太平區",
        addressCountry: "TW"
      }
    });
    graph.find((item) => item["@type"] === "WebSite").publisher = { "@id": `${siteRoot}#organization` };
    graph.find((item) => item["@type"] === "WebPage").about = { "@id": `${siteRoot}#organization` };
  }
  schema.textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
  document.head.querySelector("#person-schema")?.remove();
}

function ensureResourceHints() {
  const addLink = (rel, href, attrs = {}) => {
    if (document.head.querySelector(`link[rel="${rel}"][href="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = rel;
    link.href = href;
    Object.entries(attrs).forEach(([key, value]) => link.setAttribute(key, value));
    document.head.append(link);
  };
  addLink("preconnect", "https://www.youtube.com");
  addLink("preconnect", "https://i.ytimg.com");
  addLink("preconnect", "https://n063.ncut.edu.tw");
  addLink("preconnect", "https://ai.ncut.edu.tw");
  const firstHeroImage = siteData?.hero?.find((slide) => slide.image)?.image;
  if (firstHeroImage) {
    addLink("preload", new URL(firstHeroImage, location.href).href, { as: "image" });
  }
}

function initialSearchQuery() {
  return (new URLSearchParams(location.search).get("q") || "").trim();
}

function syncSearchQuery(value) {
  const url = new URL(location.href);
  const query = String(value || "").trim();
  if (query) url.searchParams.set("q", query);
  else url.searchParams.delete("q");
  history.replaceState(null, "", url);
}

function updateBreadcrumbSchema() {
  const breadcrumb = $(".breadcrumb");
  let schema = document.head.querySelector("#breadcrumb-schema");
  if (!breadcrumb) {
    schema?.remove();
    return;
  }
  const items = [...breadcrumb.querySelectorAll("a, span")].map((node, index) => {
    const href = node.tagName === "A" ? node.getAttribute("href") : location.href;
    const url = new URL(href || location.href, location.href);
    ["v", "audit", "_", "cache"].forEach((key) => url.searchParams.delete(key));
    return {
      "@type": "ListItem",
      position: index + 1,
      name: node.textContent.trim(),
      item: url.href
    };
  }).filter((item) => item.name);
  if (items.length < 2) {
    schema?.remove();
    return;
  }
  if (!schema) {
    schema = document.createElement("script");
    schema.type = "application/ld+json";
    schema.id = "breadcrumb-schema";
    document.head.append(schema);
  }
  schema.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items
  });
}

function updatePersonSchema(person) {
  if (!person) return;
  let schema = document.head.querySelector("#person-schema");
  if (!schema) {
    schema = document.createElement("script");
    schema.type = "application/ld+json";
    schema.id = "person-schema";
    document.head.append(schema);
  }
  const personUrl = new URL(location.href);
  ["v", "audit", "_", "cache"].forEach((key) => personUrl.searchParams.delete(key));
  schema.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Person",
    name: person.name,
    alternateName: person.enName,
    jobTitle: person.role,
    email: person.email ? `mailto:${person.email}` : undefined,
    telephone: person.phone,
    image: person.photo ? new URL(person.photo, location.href).href : undefined,
    url: personUrl.href,
    affiliation: { "@id": `${location.origin}/#organization` },
    worksFor: { "@id": `${location.origin}/#organization` },
    knowsAbout: person.expertise ? person.expertise.split(/[、，,\/]/).map((item) => item.trim()).filter(Boolean) : undefined,
    workLocation: person.office || person.lab
  });
}

function renderMegaMenu() {
  const host = $("[data-mega-menu]");
  if (!host || !siteData) return;
  const grouped = siteData.pages.reduce((acc, page) => {
    const group = page.group || "其他";
    acc[group] = acc[group] || [];
    acc[group].push(page);
    return acc;
  }, {});
  const groups = Object.entries(grouped).map(([group, pages]) => `
    <section>
      <h2>${esc(group)}</h2>
      ${pages.map((page) => `<a href="./page.html?slug=${esc(page.slug)}">${esc(page.title)}</a>`).join("")}
    </section>`).join("");
  const campusLinks = (siteData.campusLinks || []).slice(0, 8).map((link) => `<a href="${esc(link.href)}" target="_blank" rel="noreferrer">${esc(link.label)}</a>`).join("");
  host.innerHTML = `
    <div class="mega-inner">
      ${groups}
      <section>
        <h2>校內連結</h2>
        ${campusLinks}
        <a href="./campus-links.html">完整校內連結</a>
      </section>
      <section>
        <h2>快速入口</h2>
        <a href="./faculty.html">師資陣容</a>
        <a href="./news.html">最新消息</a>
        <a href="./awards.html">獲獎資訊</a>
        <a href="./campus-links.html">校內連結</a>
      </section>
    </div>`;
}

function renderHome() {
  const mobileHeroQuery = window.matchMedia("(max-width: 700px)");
  const firstMobileHeroIndex = siteData.hero.findIndex((slide) => slide.mobileImage);
  const initialHeroIndex = mobileHeroQuery.matches && firstMobileHeroIndex >= 0 ? firstMobileHeroIndex : 0;
  heroIndex = initialHeroIndex;
  $("[data-hero]").innerHTML = siteData.hero.map((slide, index) => `
    <article id="hero-slide-${index}" class="hero-slide ${index === initialHeroIndex ? "is-active" : ""} ${slide.video ? "has-video" : ""} ${slide.mobileImage ? "has-mobile-image" : ""}" role="group" aria-roledescription="slide" aria-label="${index + 1} / ${siteData.hero.length}：${esc(slide.title)}" aria-hidden="${index === initialHeroIndex ? "false" : "true"}" style="--bg:url('${esc(slide.image)}');--pos:${esc(slide.position || "center center")};${slide.mobileImage ? `--mobile-bg:url('${esc(slide.mobileImage)}');--mobile-pos:${esc(slide.mobilePosition || slide.position || "center center")};` : ""}">
      ${renderHeroVideo(slide)}
      <div class="hero-copy">
        <p class="eyebrow">${esc(slide.kicker)}</p>
        ${index === 0 ? `<h1>${esc(slide.title)}</h1>` : `<h2>${esc(slide.title)}</h2>`}
        <p>${esc(slide.text)}</p>
        <div class="hero-actions">
          <a class="primary-action" href="${esc(slide.primary.href)}">${esc(slide.primary.label)}</a>
          <a class="secondary-action" href="${esc(slide.secondary.href)}">${esc(slide.secondary.label)}</a>
        </div>
      </div>
    </article>`).join("");
  $("[data-dots]").setAttribute("aria-label", "主視覺輪播分頁");
  $("[data-dots]").innerHTML = siteData.hero.map((slide, index) => `<button type="button" class="${index === initialHeroIndex ? "is-active" : ""}" data-dot="${index}" data-mobile-slide="${slide.mobileImage ? "true" : "false"}" aria-label="切換主視覺 ${index + 1}：${esc(slide.title)}" aria-controls="hero-slide-${index}" ${index === initialHeroIndex ? `aria-current="true"` : ""}></button>`).join("");
  $("[data-metrics]").innerHTML = siteData.metrics.map((item) => `<div><strong>${esc(item.value)}</strong><span>${esc(item.label)}</span></div>`).join("");
  $("[data-quick-links]").innerHTML = siteData.quickLinks
    .filter((link) => !isRetiredOfficialHref(link.href) && !/官方(?:資訊|資料)庫/.test(link.label || ""))
    .map((link) => `<a href="${esc(link.href)}"><span>${esc(link.kicker)}</span><strong>${esc(link.label)}</strong></a>`).join("");
  $("[data-feature-cards]").innerHTML = siteData.homeFeatures.map((item, index) => `<article><span class="card-index">${String(index + 1).padStart(2, "0")}</span><h3>${esc(item.title)}</h3><p>${esc(item.text)}</p></article>`).join("");
  $("[data-page-modules]").innerHTML = siteData.pages.slice(0, 6).map((page, index) => `<article class="module-card"><span class="module-index">${String(index + 1).padStart(2, "0")}</span><h3>${esc(page.title)}</h3><p>${esc(page.summary)}</p><a href="./page.html?slug=${esc(page.slug)}">閱讀內容</a></article>`).join("");
  $("[data-faculty-preview]").innerHTML = siteData.faculty.slice(0, 6).map(renderFacultyCard).join("");
  renderAwardsCarousel();
  renderNewsWidgets();
  startHero();
}

function isMp4Video(src = "") {
  return /\.mp4(?:$|\?)/i.test(String(src));
}

function renderHeroVideo(slide = {}) {
  if (!slide.video) return "";
  if (isMp4Video(slide.video)) {
    const startTime = Number(slide.videoStartTime || 0);
    const startAttr = startTime > 0 ? ` data-start-time="${startTime}"` : "";
    return `<video class="hero-video" src="${esc(slide.video)}" title="${esc(slide.title)} 背景影片" autoplay muted loop playsinline preload="metadata" tabindex="-1" aria-hidden="true"${startAttr}></video>`;
  }
  return `<iframe class="hero-video" src="${esc(slide.video)}" title="${esc(slide.title)} 背景影片" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" loading="eager" tabindex="-1" aria-hidden="true"></iframe>`;
}

function setupVideoStartTimes(root = document) {
  $$("video[data-start-time]", root).forEach((video) => {
    if (video.dataset.startReady === "true") return;
    video.dataset.startReady = "true";
    const startTime = Number(video.dataset.startTime);
    if (!Number.isFinite(startTime) || startTime <= 0) return;
    const seekToStart = () => {
      if (video.dataset.startApplied === "true") return;
      video.dataset.startApplied = "true";
      video.currentTime = Math.min(startTime, Math.max(0, video.duration || startTime));
    };
    if (video.readyState >= 1) seekToStart();
    else video.addEventListener("loadedmetadata", seekToStart, { once: true });
  });
}

function newsItemId(item = {}, index = 0) {
  return item.id || `news-${index}`;
}

function newsDetailHref(item = {}, index = 0) {
  return item.href && !isExternalHref(item.href) ? item.href : `./news-detail.html?id=${encodeURIComponent(newsItemId(item, index))}`;
}

function newsDetailLines(item = {}) {
  if (Array.isArray(item.detail)) return item.detail.filter(Boolean);
  if (typeof item.detail === "string" && item.detail.trim()) return item.detail.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return [item.summary, "詳細公告內容可由本地 CMS 於 data/site.json 的 detail 欄位維護。"].filter(Boolean);
}

function renderNewsWidgets() {
  const isNewsPage = Boolean($("[data-news-pagination]"));
  const newsItems = isNewsPage ? siteData.news : siteData.news.filter((item) => item.category !== "獲獎公告");
  const categories = ["全部", ...new Set(newsItems.map((item) => item.category))];
  if (!categories.includes(activeCategory)) activeCategory = "全部";
  const tabs = $("[data-news-tabs]");
  if (tabs) {
    tabs.setAttribute("role", "group");
    tabs.setAttribute("aria-label", "最新消息分類篩選");
    tabs.innerHTML = categories.map((cat) => `<button class="tab ${cat === activeCategory ? "is-active" : ""}" data-category="${esc(cat)}" type="button" aria-pressed="${cat === activeCategory ? "true" : "false"}" aria-label="篩選${esc(cat)}消息">${esc(cat)}</button>`).join("");
  }
  const list = $("[data-news-list]");
  list?.setAttribute("aria-live", "polite");
  list?.setAttribute("aria-busy", "true");
  const filteredItems = newsItems.filter((item) => activeCategory === "全部" || item.category === activeCategory);
  const pagination = $("[data-news-pagination]");
  const perPage = pagination ? 10 : 5;
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / perPage));
  activeNewsPage = Math.min(activeNewsPage, totalPages);
  const items = filteredItems.slice((activeNewsPage - 1) * perPage, activeNewsPage * perPage);
  if (list && !items.length) {
    list.innerHTML = renderEmptyState("目前沒有符合條件的消息", "請切換其他分類，或回到全部消息查看最新公告。", [
      { label: "查看全部消息", href: "./news.html", className: "text-link" }
    ]);
  } else if (list) list.innerHTML = items.map((item) => {
    const itemIndex = siteData.news.indexOf(item);
    const body = `
      <time>${esc(item.date)}</time>
      <div class="news-item-body">
        <span class="news-category">${esc(item.category || "系所公告")}</span>
        <strong>${esc(item.title)}</strong>
        ${item.summary ? `<p>${esc(item.summary)}</p>` : ""}
        <small>閱讀完整內容</small>
      </div>`;
    return `<a class="news-item" href="${esc(newsDetailHref(item, itemIndex))}">${body}</a>`;
  }).join("");
  list?.setAttribute("aria-busy", "false");
  if (pagination) {
    pagination.setAttribute("role", "navigation");
    pagination.setAttribute("aria-label", "最新消息分頁");
    pagination.innerHTML = Array.from({ length: totalPages }, (_, index) => {
      const page = index + 1;
      const active = activeNewsPage === page;
      return `<button type="button" class="${active ? "is-active" : ""}" data-news-page="${page}" aria-label="前往最新消息第 ${page} 頁" ${active ? `aria-current="page"` : ""}>${page}</button>`;
    }).join("");
  }
  enhanceRenderedMediaAndLinks(list || document);
}

function renderNewsPage() {
  renderNewsWidgets();
}

function renderNewsDetail() {
  const params = new URLSearchParams(location.search);
  const id = params.get("id") || "";
  const indexParam = Number(id);
  const item = siteData.news.find((news) => newsItemId(news) === id) || (Number.isInteger(indexParam) ? siteData.news[indexParam] : null);
  const target = $("[data-news-detail]");
  if (!target) return;
  if (!item) {
    updateDocumentMeta(`找不到公告 - ${siteData.identity.title}`, "找不到指定的最新消息。");
    target.innerHTML = renderEmptyState("找不到這則公告", "此公告可能已移除，請返回最新消息列表查看目前公告。", [
      { label: "返回最新消息", href: "./news.html", className: "primary-action" }
    ]);
    return;
  }
  updateDocumentMeta(`${item.title} - 最新消息`, item.summary || newsDetailLines(item).slice(0, 2).join(" "));
  const detailLines = newsDetailLines(item);
  target.innerHTML = `
    <nav class="breadcrumb" aria-label="麵包屑"><a href="./">首頁</a><a href="./news.html">最新消息</a><span>${esc(item.title)}</span></nav>
    <p class="section-kicker">${esc(item.category || "系所公告")}</p>
    <h1>${esc(item.title)}</h1>
    <div class="news-detail-meta">
      <time datetime="${esc(item.date || "")}">${esc(item.date || "未標示日期")}</time>
      <span>${esc(item.category || "系所公告")}</span>
    </div>
    ${item.image ? `<figure class="news-detail-image"><img src="${esc(item.image)}" alt="${esc(item.title)}"></figure>` : ""}
    ${item.summary ? `<p class="page-lead">${esc(item.summary)}</p>` : ""}
    <section class="content-section news-detail-content">
      <h2>公告內容</h2>
      ${detailLines.map((line) => `<p>${esc(line)}</p>`).join("")}
    </section>
    <div class="hero-actions news-detail-actions">
      <a class="primary-action" href="./news.html">返回最新消息</a>
    </div>
  `;
  enhanceRenderedMediaAndLinks(target);
}

function renderPage() {
  const slug = new URLSearchParams(location.search).get("slug") || "history";
  const page = siteData.pages.find((item) => item.slug === slug) || siteData.pages[0];
  const pageLinks = (page.links || []).filter((link) => !isLegacyImportEntry(link));
  updateDocumentMeta(`${page.title} - ${siteData.identity.title}`, page.summary);
  $("[data-side-nav]").innerHTML = siteData.pages.map((item) => {
    const active = item.slug === page.slug;
    return `<a class="${active ? "is-active" : ""}" ${active ? `aria-current="page"` : ""} href="./page.html?slug=${esc(item.slug)}">${esc(item.title)}</a>`;
  }).join("");
  $("[data-page]").innerHTML = `
    <section class="content-hero">
      <div>
        <nav class="breadcrumb" aria-label="麵包屑"><a href="./">首頁</a><span>${esc(page.group || "系所資訊")}</span><span>${esc(page.title)}</span></nav>
        <p class="section-kicker">${esc(page.group || "Page")}</p>
        <h1>${esc(page.title)}</h1>
        <p class="page-lead">${esc(page.summary)}</p>
      </div>
      <div class="content-hero-mark" aria-hidden="true">
        <img src="${esc(siteData.identity.logo)}" alt="">
        <small>${esc(page.group || "NCUT")}</small>
      </div>
    </section>
    ${page.image && page.slug !== "history" && !isBlockedSiteImage(page.image) ? `<figure class="page-image"><img src="${esc(page.image)}" alt="${esc(page.title)}"></figure>` : ""}
    <div class="content-section-stack">
      ${page.sections.map((section) => `
        <section class="content-section">
          <div class="section-number" aria-hidden="true">${String(page.sections.indexOf(section) + 1).padStart(2, "0")}</div>
          <div>
            <h2>${esc(section.heading)}</h2>
            ${section.body.map((p) => `<p>${esc(p)}</p>`).join("")}
            ${section.items ? `<ul>${section.items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : ""}
          </div>
        </section>
      `).join("")}
    </div>
    ${renderPageEnhancements(page)}
    ${pageLinks.length ? `<section class="content-section related-links"><h2>相關連結</h2><div class="related-link-grid">${pageLinks.map((link) => `<a href="${esc(link.href)}" target="_blank" rel="noreferrer">${esc(link.label)}</a>`).join("")}</div></section>` : ""}
  `;
}

function renderPageEnhancements(page) {
  if (page.slug === "history") return renderHistoryEnhancement();
  if (page.slug === "curriculum-careers") return renderCurriculumEnhancement();
  if (page.slug === "labs") return renderLabEnhancement();
  if (page.slug === "student-zone") return renderStudentEnhancement();
  if (["industry-program", "overseas-youth"].includes(page.slug)) return renderSpecialProgramEnhancement(page.slug);
  return "";
}

function renderHistoryEnhancement() {
  const timeline = [
    {
      year: "2021",
      title: "教育部核准成立",
      text: "人工智慧應用工程系奉准設立，回應智慧科技與 AI 應用人才需求。"
    },
    {
      year: "2022",
      title: "招收四技日間學制第一屆",
      text: "正式招收四技日間部學生，建立 AI 工程實作與跨域課程基礎。"
    },
    {
      year: "2023",
      title: "專班與技優管道拓展",
      text: "設立產學攜手專班、海外青年技術訓練班與四技技優專班，擴大多元培育路徑。"
    },
    {
      year: "2024",
      title: "設立四技進修部學制",
      text: "延伸進修部學制，提供在職與多元學習者進入 AI 應用工程領域的管道。"
    }
  ];
  return `
    <section class="page-feature-block history-timeline-block">
      <p class="section-kicker">Department Timeline</p>
      <h2>系所發展時間軸</h2>
      <div class="history-timeline">
        ${timeline.map((item, index) => `
          <article class="history-timeline-item">
            <span class="history-year">${esc(item.year)}</span>
            <div>
              <small>${String(index + 1).padStart(2, "0")}</small>
              <h3>${esc(item.title)}</h3>
              <p>${esc(item.text)}</p>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderCurriculumEnhancement() {
  const careerGroups = siteData.careerPaths || [];
  const modules = siteData.curriculumModules || [];
  return `
    <section class="page-feature-block">
      <p class="section-kicker">Career Tracks</p>
      <h2>就業職能地圖</h2>
      <div class="career-track-grid">
        ${careerGroups.map((group) => `
          <article class="career-track">
            <h3>${esc(group.title)}</h3>
            <div class="tag-cloud">${(group.items || []).map((item) => `<span>${esc(item)}</span>`).join("")}</div>
          </article>
        `).join("")}
      </div>
    </section>
    <section class="page-feature-block">
      <p class="section-kicker">Curriculum Modules</p>
      <h2>課程模組與能力養成</h2>
      <div class="curriculum-grid">
        ${modules.map((module) => `
          <article class="curriculum-card">
            <h3>${esc(module.title)}</h3>
            <p>${esc(module.summary)}</p>
            <h4>核心主題</h4>
            <div class="tag-cloud">${(module.focus || []).map((item) => `<span>${esc(item)}</span>`).join("")}</div>
            <h4>代表課程</h4>
            <ul>${(module.courses || []).map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
            ${(module.outcomes || []).map((item) => `<p class="outcome">${esc(item)}</p>`).join("")}
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderLabEnhancement() {
  const labs = siteData.labProfiles || [];
  return `
    <section class="page-feature-block">
      <p class="section-kicker">Learning Spaces</p>
      <h2>教學與專題實作場域</h2>
      <div class="lab-profile-grid">
        ${labs.map((lab, index) => `
          <article class="lab-profile-card">
            <div class="lab-card-head">
              <span class="lab-index">${String(index + 1).padStart(2, "0")}</span>
              <div>
                <p class="lab-location">${esc(lab.location)}</p>
                <h3>${esc(lab.name)}</h3>
              </div>
            </div>
            <p>${esc(lab.summary)}</p>
            <div class="tag-cloud">${(lab.themes || []).map((item) => `<span>${esc(item)}</span>`).join("")}</div>
            <h4>訓練重點</h4>
            <ul>${(lab.training || []).map((item) => `<li>${esc(item)}</li>`).join("")}</ul>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function renderStudentEnhancement() {
  const resources = siteData.studentResources || [];
  const groups = resources.reduce((acc, item) => {
    const key = item.category || "學生資源";
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});
  return `
    <section class="page-feature-block">
      <p class="section-kicker">Student Services</p>
      <h2>學生專區完整入口</h2>
      <div class="resource-hub-grid">
        ${Object.entries(groups).map(([category, items]) => `
          <article class="resource-hub-group">
            <div class="resource-group-head">
              <span>${String(items.length).padStart(2, "0")}</span>
              <h3>${esc(category)}</h3>
            </div>
            ${items.map((item, index) => `
              <div class="resource-hub-item">
                <small class="resource-item-index">${String(index + 1).padStart(2, "0")}</small>
                ${item.href ? `<a class="resource-title-link" href="${esc(item.href)}" target="${linkTarget(item.href)}" rel="noreferrer">${esc(item.title)}<span>${item.href.startsWith("http") ? "外部入口" : "查看內容"}</span></a>` : `<strong>${esc(item.title)}</strong>`}
                <p>${esc(item.summary)}</p>
                ${item.children?.length ? `<div class="mini-link-row">${item.children.map((child) => `<a href="${esc(child.href)}" target="${linkTarget(child.href)}" rel="noreferrer">${esc(child.title)}</a>`).join("")}</div>` : ""}
              </div>
            `).join("")}
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

function studentResourceHref(id) {
  return `./student-resource.html?id=${encodeURIComponent(id)}`;
}

function studentResourceIndex() {
  return (siteData.studentResources || []).flatMap((item) => [
    item,
    ...(item.children || []).map((child) => ({ ...child, category: item.category, parentTitle: item.title }))
  ]);
}

const studentResourceAliases = {
  "credit-plan": "學分計畫表",
  "curriculum-map": "課程地圖",
  "course-map": "課程地圖",
  "course-outline": "課程綱要",
  "project": "實務專題",
  "graduation": "畢業門檻",
  "certificate": "核心證照",
  "internship": "校外實習",
  "transfer-credit": "課程抵免",
  "student-association": "系學會",
  "alumni": "系友會"
};

function resolveStudentResourceRequest(resources) {
  const params = new URLSearchParams(location.search);
  const slug = params.get("slug");
  const id = params.get("id");
  const title = slug ? studentResourceAliases[slug] || slug : "";
  const byTitle = title ? resources.find((item) => item.title === title) : null;
  if (byTitle) return { id: extractStudentResourceId(byTitle.href), resource: byTitle };
  return { id: Number(id || 64), resource: null };
}

function extractStudentResourceId(href = "") {
  const match = String(href).match(/[?&]id=(\d+)/);
  return match ? Number(match[1]) : null;
}

function normalizeStudentResourceLink(link, archive, currentId) {
  const href = link?.href || "";
  const rawLabel = link?.label || link?.title || href;
  const label = rawLabel.replace(/\(原頁面開啟\)|\(另開新視窗\)|Click to go\s*/g, "").trim();
  if (!href || !label) return null;
  if (/跳到主要內容區|回首頁|首頁|English|信箱|地址|map|招生訊息|系所介紹|系所成員|教師專區|學生專區|聯絡我們/i.test(label)) return null;
  if (isOriginalDeptLink(href)) {
    if (/var\/file\/.+\.(pdf|docx?|xlsx?)$/i.test(href)) return { href, label, external: true };
    if (!/原頁面開啟/.test(rawLabel)) return null;
    const index = archive.pages.findIndex((page) => archiveKey(page.url) === archiveKey(href));
    if (index < 0 || String(index) === String(currentId)) return null;
    const target = archive.pages[index];
    if (!target || officialCategory(target) !== "學生專區") return null;
    return { href: studentResourceHref(index), label: label || target.title, external: false };
  }
  return { href, label, external: href.startsWith("http") || href.startsWith("mailto:") };
}

function cleanStudentPageText(page) {
  const text = page.text || [];
  const footerIndex = text.findIndex((line, index) => index > 10 && line === "人工智慧應用工程系");
  const scoped = footerIndex > -1 ? text.slice(0, footerIndex) : text;
  const titleIndexes = scoped.map((line, index) => line === page.title ? index : -1).filter((index) => index >= 0);
  const start = titleIndexes.length ? titleIndexes[titleIndexes.length - 1] + 1 : 0;
  const skip = /^(LINK|首頁|學生專區|大學部|招生訊息|系所介紹|系所成員|教師專區|聯絡我們|課程地圖|課程綱要|實務專題|畢業門檻|核心證照|校外實習|課程抵免|學生組織|系學會|系友會)$/;
  const lines = scoped.slice(start).map((line) => String(line || "").trim()).filter((line) => line && !skip.test(line));
  return lines.filter((line, index) => lines.indexOf(line) === index);
}

function studentResourceMedia(images = []) {
  const skipImage = /(\/images\/icon\/|pdf\.gif|doc\.gif|xls\.gif|ppt\.gif|zip\.gif|mail\.gif|print\.gif|msys_1063_6835814_22293\.png)/i;
  const skipAlt = /(logo|map|地址|頁面圖片|友善列印)/i;
  return images
    .filter((image) => image?.src && !skipImage.test(image.src) && !isBlockedSiteImage(image.src))
    .filter((image) => !skipAlt.test(String(image.alt || "").trim()))
    .filter((image, index, list) => list.findIndex((item) => item.src === image.src) === index);
}

function studentResourceType(link = {}) {
  const text = `${link.label || ""} ${link.href || ""}`.toLowerCase();
  if (/\.pdf(\?|$)/.test(text)) return "PDF";
  if (/\.(doc|docx)(\?|$)/.test(text)) return "Word";
  if (/\.(xls|xlsx)(\?|$)/.test(text)) return "Excel";
  if (/\.(ppt|pptx)(\?|$)/.test(text)) return "簡報";
  if (/nmsd|stdl|elearn|sso|webmail|system|query|graduate/.test(text)) return "校務系統";
  if (link.external) return "外部入口";
  return "本站內容";
}

function studentResourceCard(link = {}) {
  const type = studentResourceType(link);
  const icon = type === "PDF" ? "PDF" : type === "Word" ? "DOC" : type === "Excel" ? "XLS" : type === "簡報" ? "PPT" : type === "校務系統" ? "SYS" : type === "外部入口" ? "EXT" : "AI";
  return `<a class="student-resource-link-card" href="${esc(link.href)}" target="${link.external ? "_blank" : "_self"}" rel="noreferrer">
    <span class="student-resource-filetype">${esc(icon)}</span>
    <span class="student-resource-link-copy">
      <strong>${esc(link.label)}</strong>
      <small>${esc(type)}</small>
    </span>
  </a>`;
}

async function renderStudentResourceDetail() {
  const archive = await fetch("./data/official-pages.json", { cache: "no-store" }).then((r) => r.json());
  const resourceItems = studentResourceIndex();
  const request = resolveStudentResourceRequest(resourceItems);
  if (request.resource?.href && isExternalHref(request.resource.href)) {
    location.replace(request.resource.href);
    return;
  }
  const id = Number(request.id || 64);
  const page = archive.pages.find((item) => Number(item.id) === id) || archive.pages[id] || archive.pages[0];
  const current = request.resource || resourceItems.find((item) => String(item.href || "").includes(`id=${id}`)) || { title: page.title, category: "學生專區" };
  const bodyLines = cleanStudentPageText(page);
  const links = (page.links || []).map((link) => normalizeStudentResourceLink(link, archive, id)).filter(Boolean);
  const resources = links.filter((link, index, list) => list.findIndex((item) => item.href === link.href && item.label === link.label) === index);
  const mediaImages = studentResourceMedia(page.images || []);
  const primaryImage = mediaImages[0];
  const supportingImages = mediaImages.slice(1);
  const summaryLines = bodyLines.slice(0, 3);
  const detailLines = bodyLines.slice(3);
  updateDocumentMeta(`${current.title || page.title} - 學生專區`, current.summary || bodyLines.slice(0, 2).join(" "));
  $("[data-student-side-nav]").innerHTML = (siteData.studentResources || []).map((item) => {
    const href = isRetiredOfficialHref(item.href) ? item.href.replace(/official-detail\.html/i, "student-resource.html") : item.href;
    const active = String(item.href || "").includes(`id=${id}`) || (item.children || []).some((child) => String(child.href || "").includes(`id=${id}`));
    return `<a class="${active ? "is-active" : ""}" ${active ? `aria-current="page"` : ""} href="${esc(href)}" target="${linkTarget(href)}" rel="noreferrer">${esc(item.title)}</a>`;
  }).join("");
  $("[data-student-detail]").innerHTML = `
    <section class="content-hero student-resource-hero">
      <div>
        <nav class="breadcrumb dark" aria-label="麵包屑"><a href="./">首頁</a><a href="./page.html?slug=student-zone">學生專區</a><span>${esc(current.title || page.title)}</span></nav>
        <p class="section-kicker">${esc(current.category || "Student Resource")}</p>
        <h1>${esc(current.title || page.title)}</h1>
        <p class="page-lead">${esc(current.summary || "此頁已整理舊系網資料，改以新網站版型呈現；正式校務系統與文件下載連結會保留外部入口。")}</p>
      </div>
      <div class="content-hero-mark" aria-hidden="true"><img src="${esc(siteData.identity.logo)}" alt=""><small>Student</small></div>
    </section>
    <section class="student-resource-overview">
      <article><span>Category</span><strong>${esc(current.category || "學生專區")}</strong></article>
      <article><span>Resources</span><strong>${resources.length}</strong></article>
      <article><span>Media</span><strong>${mediaImages.length}</strong></article>
    </section>
    ${primaryImage ? `<figure class="page-image student-resource-image student-resource-primary-media"><button class="image-zoom-trigger" type="button" data-lightbox-src="${esc(primaryImage.src)}" data-lightbox-alt="${esc(primaryImage.alt || page.title)}" aria-label="放大檢視${esc(primaryImage.alt || current.title || page.title)}"><img src="${esc(primaryImage.src)}" alt="${esc(primaryImage.alt || page.title)}"><span>放大檢視</span></button><figcaption>${esc(primaryImage.alt || current.title || page.title)}</figcaption></figure>` : ""}
    <section class="content-section student-resource-body">
      <div class="student-section-head">
        <p class="section-kicker">整理內容</p>
        <h2>頁面重點</h2>
      </div>
      ${summaryLines.length ? `<div class="student-detail-lines featured">${summaryLines.map((line) => `<p>${esc(line)}</p>`).join("")}</div>` : `<p>此項目主要提供文件或系統入口，請使用下方相關入口查看。</p>`}
      ${detailLines.length ? `<details class="student-detail-more"><summary>展開完整文字資料</summary><div>${detailLines.map((line) => `<p>${esc(line)}</p>`).join("")}</div></details>` : ""}
    </section>
    ${resources.length ? `<section class="content-section related-links student-resource-links"><div class="student-section-head"><p class="section-kicker">Links & Files</p><h2>相關入口與文件</h2></div><div class="student-resource-card-grid">${resources.map(studentResourceCard).join("")}</div></section>` : ""}
    ${supportingImages.length ? `<section class="content-section student-media-section"><div class="student-section-head"><p class="section-kicker">Media</p><h2>圖片資料</h2></div><div class="image-resource-grid student-image-grid">${supportingImages.map((image) => `<figure><button class="image-zoom-trigger" type="button" data-lightbox-src="${esc(image.src)}" data-lightbox-alt="${esc(image.alt || "頁面圖片")}" aria-label="放大檢視${esc(image.alt || "頁面圖片")}"><img src="${esc(image.src)}" alt="${esc(image.alt || "頁面圖片")}"><span>放大檢視</span></button><figcaption>${esc(image.alt || "頁面圖片")}</figcaption></figure>`).join("")}</div></section>` : ""}
  `;
  enhanceRenderedMediaAndLinks($("[data-student-detail]"));
  enhanceRenderedMediaAndLinks($("[data-student-side-nav]"));
}

function renderSpecialProgramEnhancement(slug) {
  const program = (siteData.specialPrograms || []).find((item) => item.slug === slug);
  if (!program) return "";
  const links = (program.links || []).filter((link) => !isLegacyImportEntry(link));
  return `
    <section class="page-feature-block special-program-block">
      <p class="section-kicker">Program Resources</p>
      <h2>${esc(program.title)}資源總覽</h2>
      <p>${esc(program.summary)}</p>
      ${links.length ? `<div class="program-link-grid">
        ${links.map((link) => `
          <a class="program-link-card" href="${esc(link.href)}" target="_blank" rel="noreferrer">
            <span>${esc(link.type || "Link")}</span>
            <strong>${esc(link.title)}</strong>
            <small>${esc(link.href)}</small>
          </a>
        `).join("")}
      </div>` : `<p class="local-note">此頁已整理為新網站內部內容；舊站外部連結已移除。</p>`}
    </section>
  `;
}

function renderFacultyPage() {
  $("[data-faculty-list]").innerHTML = siteData.faculty.map(renderFacultyCard).join("");
  $("[data-staff-list]").innerHTML = siteData.staff.map((person) => `<article class="staff-card"><h3>${esc(person.name)}</h3><p>${esc(person.role)}</p><p>${esc(person.email)}</p><p>${esc(person.phone)}</p><ul>${person.duties.map((duty) => `<li>${esc(duty)}</li>`).join("")}</ul></article>`).join("");
}

function renderFacultyCard(person) {
  const index = siteData.faculty.indexOf(person);
  const detailHref = person.detailHref || `./faculty-detail.html?id=${index}`;
  return `<article class="faculty-card">
    <img src="${esc(person.photo)}" alt="${esc(person.name)}">
    <div>
      <span class="faculty-number">${String(index + 1).padStart(2, "0")}</span>
      <p class="role">${esc(person.role)}</p>
      <h3>${esc(person.name)}</h3>
      <p>${esc(person.enName)}</p>
      <p><a href="mailto:${esc(person.email)}">${esc(person.email)}</a></p>
      <p>${esc(person.phone)}</p>
      ${person.expertise ? `<p class="faculty-detail"><strong>研究領域</strong>${esc(person.expertise)}</p>` : ""}
      ${person.education ? `<p class="faculty-detail"><strong>學歷</strong>${esc(person.education)}</p>` : ""}
      ${person.office ? `<p class="faculty-detail"><strong>研究室</strong>${esc(person.office)}</p>` : ""}
      ${person.lab ? `<p class="faculty-detail"><strong>實驗室</strong>${esc(person.lab)}</p>` : ""}
      ${person.courses?.length ? `<div class="tag-cloud">${person.courses.map((course) => `<span>${esc(course)}</span>`).join("")}</div>` : ""}
      <p><a href="${esc(detailHref)}">完整師資介紹</a></p>
    </div>
  </article>`;
}

function renderFacultyDetail() {
  const id = Number(new URLSearchParams(location.search).get("id") || 0);
  const person = siteData.faculty[id] || siteData.faculty[0];
  if (!person) return;
  updateDocumentMeta(`${person.name}｜師資介紹`, `${person.role} ${person.enName || ""}，研究領域：${person.expertise || "人工智慧應用工程"}`);
  updatePersonSchema(person);
  const peers = siteData.faculty.map((item, index) => {
    const active = item === person;
    return `<a class="faculty-name-link ${active ? "is-active" : ""}" ${active ? `aria-current="page"` : ""} href="./faculty-detail.html?id=${index}"><span class="person-name">${esc(item.name)}</span></a>`;
  }).join("");
  const expertiseTags = (person.expertise || "").split(/[、，,\/]/).map((item) => item.trim()).filter(Boolean).slice(0, 10);
  const infoCards = [
    person.expertise ? { title: "研究領域", body: person.expertise, type: "expertise" } : null,
    person.education ? { title: "學歷", body: person.education, type: "education" } : null,
    person.office ? { title: "研究室 / 辦公室", body: person.office, type: "office" } : null,
    person.lab ? { title: "實驗室", body: person.lab, type: "lab" } : null
  ].filter(Boolean);
  $("[data-faculty-side]").innerHTML = peers;
  $("[data-faculty-detail]").innerHTML = `
    <section class="faculty-profile-hero">
      <div class="faculty-photo-frame">
        <img src="${esc(person.photo)}" alt="${esc(person.name)}">
      </div>
      <div class="faculty-hero-copy">
        <nav class="breadcrumb dark" aria-label="麵包屑"><a href="./">首頁</a><a href="./faculty.html">師資陣容</a><span class="person-name">${esc(person.name)}</span></nav>
        <p class="section-kicker">Faculty Profile</p>
        <h1 class="person-name">${esc(person.name)}</h1>
        <p class="faculty-profile-role">${esc(person.role)}</p>
        <p class="faculty-en-name">${esc(person.enName || "")}</p>
        ${expertiseTags.length ? `<div class="faculty-keywords">${expertiseTags.map((tag) => `<span>${esc(tag)}</span>`).join("")}</div>` : ""}
        <div class="faculty-contact-row">
          ${person.email ? `<a href="mailto:${esc(person.email)}">${esc(person.email)}</a>` : ""}
          ${person.phone ? `<span>${esc(person.phone)}</span>` : ""}
          ${person.office ? `<span>${esc(person.office)}</span>` : ""}
        </div>
      </div>
    </section>
    <section class="faculty-profile-grid">
      ${infoCards.map((card, index) => `<article class="faculty-info-card ${esc(card.type)}"><span class="profile-card-index">${String(index + 1).padStart(2, "0")}</span><h2>${esc(card.title)}</h2><p>${esc(card.body)}</p></article>`).join("")}
      ${person.courses?.length ? `<article class="faculty-info-card courses"><span class="profile-card-index">${String(infoCards.length + 1).padStart(2, "0")}</span><h2>開授課程</h2><div class="tag-cloud">${person.courses.map((course) => `<span>${esc(course)}</span>`).join("")}</div></article>` : ""}
    </section>`;
}

function renderAwardsCarousel() {
  const host = $("[data-awards-carousel]");
  if (!host) return;
  const slides = siteData.awardSlides || siteData.news.filter((item) => item.category === "獲獎公告");
  host.innerHTML = `
    <div class="award-viewport" aria-live="polite">
      ${slides.map((item, index) => `
        <article id="award-slide-${index}" class="award-slide ${index === 0 ? "is-active" : ""}" role="group" aria-roledescription="slide" aria-label="${index + 1} / ${slides.length}：${esc(item.title)}" aria-hidden="${index === 0 ? "false" : "true"}">
          <img src="${esc(item.image || siteData.identity.defaultImage)}" alt="${esc(item.title)}">
        </article>
      `).join("")}
    </div>
    <div class="award-controls">
      <button type="button" data-award-prev aria-label="上一則獲獎資訊">‹</button>
      <div class="award-dots" aria-label="獲獎輪播分頁">${slides.map((item, index) => `<button type="button" class="${index === 0 ? "is-active" : ""}" data-award-dot="${index}" aria-label="切換獲獎資訊 ${index + 1}：${esc(item.title)}" aria-controls="award-slide-${index}" ${index === 0 ? `aria-current="true"` : ""}></button>`).join("")}</div>
      <button type="button" data-award-next aria-label="下一則獲獎資訊">›</button>
    </div>`;
  startAwards();
}

function renderAwardsPage() {
  const list = $("[data-awards-page]");
  const awards = siteData.awardSlides || siteData.news.filter((item) => item.category === "獲獎公告");
  list.innerHTML = awards.map((item, index) => `
    <article class="award-card">
      <figure><img src="${esc(item.image || siteData.identity.defaultImage)}" alt="${esc(item.title)}"></figure>
      <div>
        <span class="award-index">${String(index + 1).padStart(2, "0")}</span>
        <time>${esc(item.date)}</time>
        <h2>${esc(item.title)}</h2>
        <p>${esc(item.summary || item.title)}</p>
        <div class="award-meta"><span>Achievement</span><span>NCUT AI</span></div>
        ${item.href ? `<a href="${esc(item.href)}" target="${linkTarget(item.href)}">查看資料</a>` : ""}
      </div>
    </article>`).join("");
  renderAwardsCarousel();
}

function renderCampusLinks() {
  const host = $("[data-campus-links]");
  if (!host) return;
  host.innerHTML = (siteData.campusLinks || []).map((link, index) => `
    <a class="campus-link-card" href="${esc(link.href)}" target="_blank" rel="noreferrer">
      <span class="campus-link-index">${String(index + 1).padStart(2, "0")}</span>
      <span>校內連結</span>
      <strong>${esc(link.label)}</strong>
      <small>${esc(link.href)}</small>
    </a>`).join("");
}

function renderOriginalHome() {
  const host = $("[data-original-home]");
  if (!host) return;
  const original = siteData.originalHome || {};
  host.innerHTML = `
    <section class="original-block">
      <p class="section-kicker">Teaching Features</p>
      <h2>原系網教學特色</h2>
      <div class="story-grid">${(original.teachingFeatures || []).map((item) => `<article><h3>${esc(item)}</h3><p>已整理進首頁主視覺輪播與系所介紹內容。</p></article>`).join("")}</div>
    </section>
    <section class="original-block">
      <p class="section-kicker">Campus Links</p>
      <h2>校內連結</h2>
      <div class="campus-link-grid">${(original.campusLinks || siteData.campusLinks || []).map((link) => `<a class="campus-link-card" href="${esc(link.href)}" target="_blank" rel="noreferrer"><span>外部資源</span><strong>${esc(link.label)}</strong><small>${esc(link.href)}</small></a>`).join("")}</div>
    </section>
    <section class="original-block">
      <p class="section-kicker">Archive Pages</p>
      <h2>系所頁面資料</h2>
      <div class="archive-grid original-grid">${(original.archiveCards || []).map((page) => `<article class="archive-card"><p class="archive-source">本站資料頁</p><h2>${esc(page.title)}</h2><p>${esc(page.summary)}</p></article>`).join("")}</div>
    </section>`;
}

async function renderOfficialArchive() {
  location.replace("./");
}

function officialCategory(page) {
  const title = page.title || "";
  const url = page.url || "";
  const labelText = `${title} ${url}`;
  if (/公告|mobileloadmod|消息|新聞/.test(labelText) || /Nbr=726/.test(url)) return "公告消息";
  if (/教師專區/.test(title) || /412-1063-2410/.test(url)) return "教師專區";
  if (/系主任|專任教師|行政人員|系所成員|師資介紹/.test(title) || /Nbr=730|r730|\/406-1063-/.test(url)) return "師資與成員";
  if (/學分計畫|課程地圖|課程綱要|實務專題|歷屆專題|專題影片|專題海報|畢業門檻|核心證照|校外實習|實習|課程抵免|系學會|系友會|學生專區/.test(title)) return "學生專區";
  if (/產學攜手|海外青年|海青|產攜|招生/.test(title)) return "專班與招生";
  if (/系所介紹|系所沿革|教學宗旨|發展方向|課程與就業|專業實驗室|本校校務發展/.test(title)) return "系所介紹";
  if (/聯絡/.test(title)) return "聯絡與其他";
  return "聯絡與其他";
}

async function renderResources() {
  const archive = await fetch("./data/official-pages.json", { cache: "no-store" }).then((r) => r.json());
  const search = $("[data-resource-search]");
  const list = $("[data-resource-list]");
  const meta = $("[data-resource-meta]");
  if (search) search.value = initialSearchQuery();
  const render = () => {
    const query = (search?.value || "").trim().toLowerCase();
    const resources = archive.resources.filter((item) => {
      const haystack = `${item.label} ${item.href}`.toLowerCase();
      return !isOriginalDeptLink(item.href) && (!query || haystack.includes(query));
    });
    meta.innerHTML = `<strong>${resources.length}</strong> / ${archive.resourceCount} 個外部與文件資源符合搜尋。系所內容請改由本站各分類頁瀏覽。資料更新時間：${esc(archive.generatedAt)}`;
    list.innerHTML = resources.length ? resources.map((item) => `
      <a class="resource-item" href="${esc(item.href)}" target="_blank" rel="noreferrer">
        <span>${esc(resourceType(item.href))}</span>
        <strong>${esc(item.label || item.href)}</strong>
        <small>${esc(item.href)}</small>
      </a>`).join("") : renderEmptyState("找不到符合條件的文件或資源", "請改用其他關鍵字搜尋，或回到最新消息查看目前公開資訊。", [
      { label: "清除搜尋", href: "./resources.html", className: "text-link" },
      { label: "查看最新消息", href: "./news.html", className: "text-link" }
    ]);
    enhanceRenderedMediaAndLinks(list);
  };
  search?.addEventListener("input", debounce(() => {
    syncSearchQuery(search.value);
    render();
  }));
  render();
}

function resourceType(href) {
  const lower = href.toLowerCase();
  if (lower.includes(".pdf")) return "PDF";
  if (lower.includes(".doc")) return "DOC";
  if (lower.includes(".xls")) return "XLS";
  if (lower.startsWith("mailto:")) return "Email";
  if (lower.includes("downloadfile")) return "Download";
  return "Link";
}

async function renderOfficialDetail() {
  location.replace("./");
  return;
  const archive = await fetch("./data/official-pages.json", { cache: "no-store" }).then((r) => r.json());
  const id = Number(new URLSearchParams(location.search).get("id") || 0);
  const page = archive.pages[id] || archive.pages[0];
  const visibleLinks = (page.links || []).map((link) => archiveLink(link, archive)).filter(Boolean);
  const pageImages = (page.images || []).filter((image) => !isBlockedSiteImage(image.src));
  updateDocumentMeta(`${page.title} - 資料頁`, (page.text || []).slice(0, 3).join(" "));
  $("[data-official-detail]").innerHTML = `
    <nav class="breadcrumb" aria-label="麵包屑"><a href="./">首頁</a><span>${esc(page.title)}</span></nav>
    <p class="section-kicker">Official Archive</p>
    <h1>${esc(page.title)}</h1>
    <p class="local-note">本頁內容已整理為新網站資料頁；校外與校內系統連結保留外部入口。</p>
    ${pageImages.length ? `<figure class="official-hero-image"><img src="${esc(pageImages[0].src)}" alt="${esc(pageImages[0].alt || page.title)}"></figure>` : ""}
    <section class="content-section official-text-section">
      <h2>頁面內容</h2>
      <div class="official-text-stack">${(page.text || []).map((line) => `<p>${esc(line)}</p>`).join("")}</div>
    </section>
    ${visibleLinks.length ? `<section class="content-section related-links"><h2>相關入口</h2><div class="related-link-grid">${visibleLinks.map((link) => `<a href="${esc(link.href)}" target="${link.external ? "_blank" : "_self"}" rel="noreferrer">${esc(link.label || link.href)}</a>`).join("")}</div></section>` : ""}
    ${pageImages.length > 1 ? `<section class="content-section"><h2>圖片資源</h2><div class="image-resource-grid">${pageImages.slice(1).map((image) => `<figure><img src="${esc(image.src)}" alt="${esc(image.alt || "頁面圖片")}"><figcaption>${esc(image.alt || "頁面圖片")}</figcaption></figure>`).join("")}</div></section>` : ""}
  `;
  enhanceRenderedMediaAndLinks($("[data-official-detail]"));
}

function startHero() {
  const slides = $$(".hero-slide");
  const dots = $$("[data-dot]");
  const dotsHost = $("[data-dots]");
  const current = $("[data-hero-current]");
  const total = $("[data-hero-total]");
  const progress = $("[data-hero-progress]");
  const pauseButton = $("[data-hero-pause]");
  const hoverTargets = [$("[data-hero]"), $(".slider-controls"), $("[data-metrics]")].filter(Boolean);
  const mobileHeroQuery = window.matchMedia("(max-width: 700px)");
  let userPaused = false;
  let interactionPaused = false;
  if (total) total.textContent = String(slides.length).padStart(2, "0");
  const resolveMobileHeroIndex = (index, direction = 1) => {
    if (!slides.length) return index;
    let nextIndex = (index + slides.length) % slides.length;
    if (!mobileHeroQuery.matches) return nextIndex;
    for (let attempts = 0; attempts < slides.length; attempts += 1) {
      if (slides[nextIndex].classList.contains("has-mobile-image")) return nextIndex;
      nextIndex = (nextIndex + direction + slides.length) % slides.length;
    }
    return index;
  };
  const syncMobileHeroVideo = () => {
    const isMobile = mobileHeroQuery.matches;
    $$(".hero-video").forEach((media) => {
      if (media.tagName !== "VIDEO") return;
      media.toggleAttribute("data-mobile-paused", isMobile);
      if (isMobile) {
        media.pause();
        media.currentTime = 0;
      } else {
        media.play?.().catch(() => {});
      }
    });
    if (isMobile && slides[heroIndex]?.classList.contains("has-video") && !slides[heroIndex]?.classList.contains("has-mobile-image")) {
      show(resolveMobileHeroIndex(heroIndex + 1, 1));
    }
  };
  const show = (index, direction = index < heroIndex ? -1 : 1) => {
    heroIndex = resolveMobileHeroIndex(index, direction);
    slides.forEach((slide, i) => {
      const active = i === heroIndex;
      slide.classList.toggle("is-active", active);
      slide.setAttribute("aria-hidden", String(!active));
    });
    dots.forEach((dot, i) => {
      const active = i === heroIndex;
      dot.classList.toggle("is-active", active);
      if (active) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
    });
    if (current) current.textContent = String(heroIndex + 1).padStart(2, "0");
  };
  const scheduleNext = () => {
    clearTimeout(heroTimer);
    if (userPaused || interactionPaused) {
      if (progress) progress.style.animationPlayState = "paused";
      return;
    }
    const activeSlide = slides[heroIndex];
    const delay = mobileHeroQuery.matches && activeSlide?.classList.contains("has-mobile-image")
      ? 6500
      : activeSlide?.querySelector(".hero-video") ? 60000 : 6500;
    if (progress) {
      progress.style.animation = "none";
      progress.offsetHeight;
      progress.style.setProperty("--hero-duration", `${delay}ms`);
      progress.style.animation = "heroProgress var(--hero-duration) linear forwards";
    }
    heroTimer = setTimeout(() => {
      show(heroIndex + 1);
      scheduleNext();
    }, delay);
  };
  const stop = () => {
    clearTimeout(heroTimer);
    if (progress) progress.style.animationPlayState = "paused";
  };
  const resume = () => {
    if (progress) progress.style.animationPlayState = "running";
    scheduleNext();
  };
  const updatePauseButton = () => {
    if (!pauseButton) return;
    pauseButton.setAttribute("aria-pressed", String(userPaused));
    pauseButton.setAttribute("aria-label", userPaused ? "播放主視覺輪播" : "暫停主視覺輪播");
    pauseButton.textContent = userPaused ? "▶" : "Ⅱ";
  };
  const restart = () => { scheduleNext(); };
  $("[data-prev]")?.addEventListener("click", () => { show(heroIndex - 1, -1); restart(); });
  $("[data-next]")?.addEventListener("click", () => { show(heroIndex + 1, 1); restart(); });
  dotsHost?.addEventListener("click", (event) => {
    const dot = event.target.closest("[data-dot]");
    if (!dot || !dotsHost.contains(dot)) return;
    show(Number(dot.dataset.dot), 1);
    restart();
  });
  pauseButton?.addEventListener("click", () => {
    userPaused = !userPaused;
    updatePauseButton();
    if (userPaused) stop();
    else resume();
  });
  hoverTargets.forEach((target) => {
    target.addEventListener("mouseenter", () => { interactionPaused = true; stop(); });
    target.addEventListener("mouseleave", () => { interactionPaused = false; if (!userPaused) resume(); });
    target.addEventListener("focusin", () => { interactionPaused = true; stop(); });
    target.addEventListener("focusout", (event) => {
      if (event.relatedTarget && target.contains(event.relatedTarget)) return;
      interactionPaused = false;
      if (!userPaused) resume();
    });
  });
  mobileHeroQuery.addEventListener?.("change", syncMobileHeroVideo);
  syncMobileHeroVideo();
  show(heroIndex);
  updatePauseButton();
  scheduleNext();
}

function startAwards() {
  const slides = $$(".award-slide");
  const dots = $$("[data-award-dot]");
  const carousel = $("[data-awards-carousel]");
  const dotsHost = $(".award-dots", carousel || document);
  let awardInteractionPaused = false;
  if (!slides.length) return;
  const show = (index) => {
    awardIndex = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      const active = i === awardIndex;
      slide.classList.toggle("is-active", active);
      slide.setAttribute("aria-hidden", String(!active));
    });
    dots.forEach((dot, i) => {
      const active = i === awardIndex;
      dot.classList.toggle("is-active", active);
      if (active) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
    });
  };
  const stop = () => { clearInterval(awardTimer); };
  const restart = () => {
    clearInterval(awardTimer);
    if (awardInteractionPaused) return;
    awardTimer = setInterval(() => show(awardIndex + 1), 5200);
  };
  $("[data-award-prev]")?.addEventListener("click", () => { show(awardIndex - 1); restart(); });
  $("[data-award-next]")?.addEventListener("click", () => { show(awardIndex + 1); restart(); });
  dotsHost?.addEventListener("click", (event) => {
    const dot = event.target.closest("[data-award-dot]");
    if (!dot || !dotsHost.contains(dot)) return;
    show(Number(dot.dataset.awardDot));
    restart();
  });
  carousel?.addEventListener("mouseenter", () => { awardInteractionPaused = true; stop(); });
  carousel?.addEventListener("mouseleave", () => { awardInteractionPaused = false; restart(); });
  carousel?.addEventListener("focusin", () => { awardInteractionPaused = true; stop(); });
  carousel?.addEventListener("focusout", (event) => {
    if (event.relatedTarget && carousel.contains(event.relatedTarget)) return;
    awardInteractionPaused = false;
    restart();
  });
  show(awardIndex);
  restart();
}

class PageTransitionController {
  constructor() {
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.linkSelector = "a[href]";
    this.exitDuration = 2300;
    this.exitTimer = 0;
  }

  static installOnce() {
    if (document.documentElement.dataset.pageTransitionReady) return;
    document.documentElement.dataset.pageTransitionReady = "true";
    new PageTransitionController().install();
  }

  install() {
    document.addEventListener("click", (event) => this.onClick(event), true);
    window.addEventListener("pageshow", (event) => this.onPageReveal(event.persisted));
    window.addEventListener("focus", () => this.onPageReveal(false));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") this.onPageReveal(false);
    });
  }

  onPageReveal(restoredFromCache = false) {
    window.clearTimeout(this.exitTimer);
    if (!restoredFromCache && document.body.classList.contains("is-exiting-page")) return;
    const shouldShowReturnTransition = restoredFromCache || PageLoader.consumeReturnTransition();
    if (!shouldShowReturnTransition || !this.canAnimateTransition()) {
      PageLoader.clearExitState();
      return;
    }
    PageLoader.showReturn().hide();
  }

  canAnimateTransition() {
    return !this.reducedMotion.matches;
  }

  isDisabledControl(element) {
    return element?.disabled || element?.getAttribute("aria-disabled") === "true";
  }

  sameSiteNavigationUrl(event) {
    const link = event.target.closest(this.linkSelector);
    if (!link || this.isDisabledControl(link)) return "";
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return "";
    if (link.target && link.target !== "_self") return "";
    if (link.hasAttribute("download")) return "";
    const href = link.getAttribute("href") || "";
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript):/i.test(href)) return "";
    const url = new URL(href, location.href);
    if (url.origin !== location.origin) return "";
    if (isTranslateProxyPage()) return englishTranslateHref(href);
    if (url.pathname === location.pathname && url.search === location.search && url.hash) return "";
    if (url.href === location.href) return "";
    return url.href;
  }

  onClick(event) {
    if (document.body.classList.contains("is-exiting-page")) {
      event.preventDefault();
      return;
    }
    if (!this.canAnimateTransition()) return;
    const navigationUrl = this.sameSiteNavigationUrl(event);
    if (!navigationUrl) return;
    event.preventDefault();
    PageLoader.rememberReturnTransition();
    PageLoader.continueNextTransition();
    showPageTransition();
    this.exitTimer = window.setTimeout(() => {
      location.assign(navigationUrl);
    }, this.exitDuration);
  }
}

function setupPageTransitions() {
  PageTransitionController.installOnce();
}

function setupInteractions() {
  setupPageTransitions();
  const header = $("[data-header]");
  const menu = $(".menu-toggle");
  const nav = $(".site-nav");
  const topButton = $("[data-top]");
  const progress = document.createElement("div");
  progress.className = "scroll-progress";
  progress.setAttribute("aria-hidden", "true");
  document.body.prepend(progress);
  if (!document.querySelector(".ambient-bg")) {
    document.body.insertAdjacentHTML("afterbegin", `
      <div class="ambient-bg" aria-hidden="true">
        <div class="ambient-circuit ambient-circuit-a"></div>
        <div class="ambient-circuit ambient-circuit-b"></div>
        <div class="ambient-duel">
          <span class="ambient-duel-letter ambient-duel-a">A</span>
          <span class="ambient-duel-letter ambient-duel-i">I</span>
          <span class="ambient-duel-impact"></span>
          <img class="ambient-duel-logo" src="./assets/ai-official-icon.png" alt="">
        </div>
        <div class="ambient-ring"></div>
        <div class="ambient-mark"></div>
      </div>
    `);
  }
  let duelFinalTimer;
  let revealElements = [];
  const revealVisible = () => {
    const threshold = window.innerHeight * 0.92;
    revealElements.forEach((el) => {
      if (!el.classList.contains("reveal") && el.getBoundingClientRect().top < threshold) {
        el.classList.add("reveal");
      }
    });
  };
  if (menu) menu.setAttribute("aria-label", "開啟主選單");
  if (topButton && !topButton.hasAttribute("aria-label")) topButton.setAttribute("aria-label", "返回頁面頂端");
  let lastScrollY = -1;
  let scrollTicking = false;
  let lastScrollRatio = -1;
  let lastPastHero = false;
  const setMenuOpen = (open) => {
    header?.classList.toggle("is-open", open);
    menu?.setAttribute("aria-expanded", String(open));
    menu?.setAttribute("aria-label", open ? "關閉主選單" : "開啟主選單");
    document.body.classList.toggle("nav-open", open);
  };
  const updateScrollState = (force = false) => {
    const currentScrollY = window.scrollY;
    if (!force && currentScrollY === lastScrollY) return;
    lastScrollY = currentScrollY;
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const ratio = Math.min(1, Math.max(0, currentScrollY / max));
    const pastHero = currentScrollY > window.innerHeight * 0.72;
    header?.classList.toggle("is-scrolled", currentScrollY > 20);
    topButton?.classList.toggle("is-visible", currentScrollY > 300);
    progress.style.transform = `scaleX(${ratio})`;
    if (Math.abs(ratio - lastScrollRatio) > 0.002) {
      lastScrollRatio = ratio;
      const isAtBottom = ratio > 0.985;
      const collision = isAtBottom ? 1 : Math.abs(Math.sin(ratio * Math.PI * 8));
      const settle = Math.min(1, Math.max(0, (ratio - 0.82) / 0.18));
      const spread = (1 - collision) * (1 - settle);
      const finalPulse = ratio > 0.88 ? Math.sin(Math.min(1, (ratio - 0.88) / 0.12) * Math.PI) : 0;
      if (isAtBottom && !document.body.classList.contains("is-duel-final")) {
        document.body.classList.add("is-duel-final");
        window.clearTimeout(duelFinalTimer);
        duelFinalTimer = window.setTimeout(() => {
          document.body.classList.remove("is-duel-final");
        }, 1350);
      } else if (ratio < 0.94) {
        document.body.classList.remove("is-duel-final");
        window.clearTimeout(duelFinalTimer);
      }
      document.documentElement.style.setProperty("--scroll-ratio", ratio.toFixed(4));
      document.documentElement.style.setProperty("--scroll-px", `${currentScrollY.toFixed(0)}px`);
      document.documentElement.style.setProperty("--duel-collision", collision.toFixed(4));
      document.documentElement.style.setProperty("--duel-spread", spread.toFixed(4));
      document.documentElement.style.setProperty("--duel-final", finalPulse.toFixed(4));
    }
    if (pastHero !== lastPastHero) {
      lastPastHero = pastHero;
      document.body.classList.toggle("is-past-hero", pastHero);
    }
  };
  const requestScrollUpdate = (force = false) => {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(() => {
      scrollTicking = false;
      updateScrollState(force);
    });
  };
  menu?.addEventListener("click", () => {
    setMenuOpen(!header?.classList.contains("is-open"));
  });
  nav?.addEventListener("click", (event) => {
    if (event.target.closest("a[href]")) setMenuOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const wasOpen = header?.classList.contains("is-open");
    setMenuOpen(false);
    if (wasOpen) menu?.focus();
  });
  document.addEventListener("click", (event) => {
    if (!header?.classList.contains("is-open")) return;
    if (header.contains(event.target)) return;
    setMenuOpen(false);
  });
  topButton?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  document.addEventListener("click", (event) => {
    const categoryButton = event.target.closest("[data-category]");
    const pageButton = event.target.closest("[data-news-page]");
    if (!categoryButton && !pageButton) return;
    if (categoryButton) {
      activeCategory = categoryButton.dataset.category;
      activeNewsPage = 1;
    } else {
      activeNewsPage = Number(pageButton.dataset.newsPage);
    }
    renderNewsWidgets();
  });
  const revealTargets = [
    ".section",
    ".feature-band",
    ".media-band",
    ".directory-hero",
    ".page-main",
    ".section-head",
    ".story-grid article",
    ".module-card",
    ".faculty-card",
    ".staff-card",
    ".news-list",
    ".news-list a",
    ".news-list article",
    ".video-grid iframe",
    ".content-section",
    ".page-feature-block",
    ".archive-card",
    ".resource-item",
    ".campus-link-card",
    ".award-card",
    ".resource-hub-group",
    ".career-track",
    ".curriculum-card",
    ".lab-profile-card",
    ".program-link-card",
    ".faculty-profile-hero",
    ".faculty-profile-grid article"
  ].join(",");
  revealElements = $$(revealTargets);
  revealElements.forEach((el, index) => {
    el.style.setProperty("--reveal-delay", `${Math.min(index % 6, 5) * 70}ms`);
  });
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("reveal");
        observer.unobserve(entry.target);
      }
    }), { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    revealElements.forEach((el) => observer.observe(el));
  } else {
    revealElements.forEach((el) => el.classList.add("reveal"));
  }
  enhanceRenderedMediaAndLinks();
  window.addEventListener("scroll", () => requestScrollUpdate(), { passive: true });
  window.addEventListener("resize", () => requestScrollUpdate(true));
  requestAnimationFrame(() => {
    updateScrollState(true);
    revealVisible();
  });
}

function enhanceRenderedMediaAndLinks(root = document) {
  setupVideoStartTimes(root);
  $$("a[href]", root).forEach((link) => {
    const href = link.getAttribute("href") || "";
    if (!isExternalHref(href)) return;
    link.setAttribute("target", "_blank");
    const rel = new Set((link.getAttribute("rel") || "").split(/\s+/).filter(Boolean));
    rel.add("noopener");
    rel.add("noreferrer");
    link.setAttribute("rel", [...rel].join(" "));
  });

  $$("iframe", root).forEach((frame) => {
    if (!frame.classList.contains("hero-video") && !frame.hasAttribute("loading")) {
      frame.setAttribute("loading", "lazy");
    }
    if (!frame.hasAttribute("referrerpolicy")) {
      frame.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    }
    if (!frame.hasAttribute("title")) {
      frame.setAttribute("title", "嵌入式影音內容");
    }
    if (!frame.classList.contains("hero-video") && !frame.hasAttribute("allow")) {
      frame.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");
    }
  });

  $$("img", root).forEach((image) => {
    image.setAttribute("decoding", "async");
    const shouldLoadImmediately = image.closest(".brand, .site-loader, .content-hero-mark, .faculty-photo-frame, .award-slide.is-active");
    if (!image.hasAttribute("alt")) {
      image.setAttribute("alt", "");
    }
    if (!image.getAttribute("alt") && image.closest(".brand, .site-footer")) {
      image.setAttribute("alt", `${siteData?.identity?.title || "人工智慧應用工程系"} Logo`);
    }
    if (!image.hasAttribute("width") || !image.hasAttribute("height")) {
      if (image.closest(".brand, .site-loader, .content-hero-mark, .site-footer")) {
        image.setAttribute("width", "512");
        image.setAttribute("height", "512");
      } else if (image.closest(".faculty-card")) {
        image.setAttribute("width", "184");
        image.setAttribute("height", "184");
      } else if (image.closest(".faculty-photo-frame")) {
        image.setAttribute("width", "360");
        image.setAttribute("height", "460");
      } else if (image.closest(".award-slide, .award-card, .archive-card, .official-hero-image, .page-image, .student-resource-image")) {
        image.setAttribute("width", "1200");
        image.setAttribute("height", "630");
      }
    }
    if (!shouldLoadImmediately && !image.hasAttribute("loading")) {
      image.setAttribute("loading", "lazy");
    }
    if (shouldLoadImmediately) {
      image.setAttribute("fetchpriority", "high");
      if (image.hasAttribute("loading")) image.removeAttribute("loading");
    } else if (!image.hasAttribute("fetchpriority")) {
      image.setAttribute("fetchpriority", "low");
    }
    if (image.dataset.fallbackReady) return;
    image.dataset.fallbackReady = "true";
    image.addEventListener("error", () => {
      if (image.dataset.fallbackApplied) return;
      image.dataset.fallbackApplied = "true";
      image.classList.add("image-fallback");
      if (!image.getAttribute("alt")) {
        image.setAttribute("alt", "圖片暫時無法載入");
      }
      image.src = siteData?.identity?.logo || "./assets/ai-official-icon.png";
    });
  });
  updateBreadcrumbSchema();
}

function openImageLightbox(src, alt = "圖片資料") {
  if (!src) return;
  document.querySelector(".image-lightbox")?.remove();
  const lightbox = document.createElement("div");
  lightbox.className = "image-lightbox";
  lightbox.setAttribute("role", "dialog");
  lightbox.setAttribute("aria-modal", "true");
  lightbox.setAttribute("aria-label", alt || "圖片放大檢視");
  lightbox.innerHTML = `
    <div class="image-lightbox-panel">
      <button class="image-lightbox-close" type="button" aria-label="關閉圖片檢視">×</button>
      <img src="${esc(src)}" alt="${esc(alt)}">
      <p>${esc(alt)}</p>
    </div>
  `;
  document.body.append(lightbox);
  document.body.classList.add("has-lightbox");
  const close = () => {
    lightbox.remove();
    document.body.classList.remove("has-lightbox");
    document.removeEventListener("keydown", onKeydown);
  };
  const onKeydown = (event) => {
    if (event.key === "Escape") close();
  };
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox || event.target.closest(".image-lightbox-close")) close();
  });
  document.addEventListener("keydown", onKeydown);
  lightbox.querySelector(".image-lightbox-close")?.focus();
}

window.openImageLightbox = openImageLightbox;

document.addEventListener("click", (event) => {
  const trigger = event.target.closest("[data-lightbox-src]");
  if (!trigger) return;
  openImageLightbox(trigger.dataset.lightboxSrc, trigger.dataset.lightboxAlt || trigger.querySelector("img")?.alt || "圖片資料");
});

loadSite().catch(renderSiteError);
