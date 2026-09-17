let data;
let assets = [];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

const listFields = new Set([
  "duties",
  "sections.0.body",
  "sections.0.items",
  "children",
  "focus",
  "courses",
  "outcomes",
  "themes",
  "training"
]);

boot();

async function boot() {
  bindStaticEvents();
  const status = await api("/api/status", { auth: false }).catch(() => ({ authenticated: false }));
  if (status.authenticated) await loadEditor();
}

function bindStaticEvents() {
  $$("[data-save]").forEach((button) => button.addEventListener("click", save));
  $("[data-login]")?.addEventListener("submit", login);
  $("[data-logout]")?.addEventListener("click", logout);
  $("[data-admin-search]")?.addEventListener("input", filterAdminItems);
  $("[data-refresh-git]")?.addEventListener("click", refreshGitStatus);
  $("[data-build]")?.addEventListener("click", runBuild);
  $("[data-commit]")?.addEventListener("click", commitChanges);
  $("[data-push]")?.addEventListener("click", pushChanges);
  $("[data-asset-upload]")?.addEventListener("submit", uploadAsset);

  document.addEventListener("click", (event) => {
    const nav = event.target.closest("[data-admin-target]");
    if (nav) setActiveAdminPanel(nav.dataset.adminTarget);

    const remove = event.target.closest("[data-remove]");
    if (remove) {
      removePath(remove.dataset.remove);
      renderAll();
    }

    const copy = event.target.closest("[data-copy-asset]");
    if (copy) copyText(copy.dataset.copyAsset);
  });

  document.addEventListener("input", (event) => {
    const field = event.target.closest("[data-path]");
    if (!field || !data) return;
    setPath(field.dataset.path, field.dataset.kind === "list" ? toList(field.value) : field.value);
    syncJson();
    refreshReferences();
  });

  bindAddButtons();
}

function bindAddButtons() {
  $("[data-add-hero]")?.addEventListener("click", () => {
    data.hero ||= [];
    data.hero.push({
      kicker: "NCUT AI",
      title: "新增首頁輪播",
      text: "請輸入輪播說明文字。",
      image: data.identity?.defaultImage || data.identity?.logo || "",
      position: "center center",
      video: "",
      primary: { label: "了解更多", href: "./" },
      secondary: { label: "查看資訊", href: "./" }
    });
    renderAll();
  });
  $("[data-add-news]")?.addEventListener("click", () => {
    data.news ||= [];
    const id = `news-${today()}-${Date.now()}`;
    data.news.unshift({ id, date: today(), category: "系所公告", title: "新增最新消息", summary: "", detail: [], href: `./news-detail.html?id=${id}`, sourceHref: "", image: data.identity?.defaultImage || "" });
    renderAll();
  });
  $("[data-add-faculty]")?.addEventListener("click", () => {
    data.faculty ||= [];
    data.faculty.push({ name: "新增教師", enName: "", role: "助理教授", email: "", phone: "", photo: data.identity?.logo || "", education: "", expertise: "", office: "", lab: "" });
    renderAll();
  });
  $("[data-add-staff]")?.addEventListener("click", () => {
    data.staff ||= [];
    data.staff.push({ name: "新增行政人員", role: "行政人員", email: "", phone: "", duties: [] });
    renderAll();
  });
  $("[data-add-page]")?.addEventListener("click", () => {
    data.pages ||= [];
    data.pages.push({ slug: `page-${Date.now()}`, group: "一般頁面", title: "新增內容頁", summary: "", image: "", sections: [{ heading: "段落標題", body: ["段落內容"], items: [] }], links: [] });
    renderAll();
  });
  $("[data-add-student-resource]")?.addEventListener("click", () => {
    data.studentResources ||= [];
    data.studentResources.push({ title: "新增學生資源", category: "學生資源", summary: "", href: "", children: [] });
    renderAll();
  });
}

async function login(event) {
  event.preventDefault();
  const password = new FormData(event.currentTarget).get("password");
  const response = await fetch("../api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  });
  if (!response.ok) {
    setStatus("密碼錯誤，請重新輸入。", true);
    return;
  }
  await loadEditor();
}

async function logout() {
  await api("/api/logout", { method: "POST" }).catch(() => {});
  location.reload();
}

async function loadEditor() {
  data = await api("/api/site");
  $("[data-login]")?.classList.add("hidden");
  $("[data-editor]")?.classList.remove("hidden");
  await Promise.all([refreshGitStatus(), loadAssets()]);
  renderAll();
  setStatus("資料已載入。");
}

async function save() {
  try {
    const jsonText = $("[data-json-editor]")?.value;
    if (jsonText?.trim()) data = JSON.parse(jsonText);
    SiteReferences.resolve(data);
  } catch (error) {
    setStatus(`資料格式或引用錯誤：${error.message}`, true);
    return;
  }

  const result = await api("/api/site", {
    method: "POST",
    body: data
  }).catch((error) => ({ ok: false, message: error.message }));
  if (!result.ok) {
    setStatus(result.message || "儲存失敗。", true);
    return;
  }
  setStatus(`已儲存，備份：${result.backup || "已建立"}`);
  await refreshGitStatus();
}

async function loadAssets() {
  const result = await api("/api/assets");
  assets = result.assets || [];
  renderAssets();
}

async function uploadAsset(event) {
  event.preventDefault();
  const file = new FormData(event.currentTarget).get("asset");
  if (!file || !file.size) {
    setStatus("請先選擇要上傳的檔案。", true);
    return;
  }
  setStatus("正在上傳素材...");
  const dataUrl = await fileToDataUrl(file);
  const result = await api("/api/assets/upload", {
    method: "POST",
    body: { name: file.name, dataUrl }
  }).catch((error) => ({ ok: false, message: error.message }));
  if (!result.ok) {
    setStatus(result.message || "上傳失敗。", true);
    return;
  }
  event.currentTarget.reset();
  await loadAssets();
  await refreshGitStatus();
  setStatus(`已上傳：${result.asset.path}`);
}

async function refreshGitStatus() {
  const node = $("[data-git-status]");
  if (node) node.textContent = "讀取中...";
  const result = await api("/api/git/status").catch((error) => ({ status: "", error: error.message }));
  if (node) node.textContent = result.status || result.error || "目前沒有 Git 狀態輸出。";
}

async function runBuild() {
  setCommandOutput("正在執行 build...");
  const result = await api("/api/build", { method: "POST" }).catch((error) => ({ ok: false, stderr: error.message }));
  setCommandOutput(formatCommandResult(result));
  setStatus(result.ok ? "Build 成功，GitHub Pages 靜態包可產生。" : "Build 失敗，請查看輸出。", !result.ok);
  await refreshGitStatus();
}

async function commitChanges() {
  const message = $("[data-commit-message]")?.value.trim();
  if (!message) {
    setStatus("請先輸入 commit 訊息。", true);
    return;
  }
  setCommandOutput("正在建立 commit...");
  const result = await api("/api/git/commit", {
    method: "POST",
    body: { message }
  }).catch((error) => ({ ok: false, stderr: error.message }));
  setCommandOutput(formatCommandResult(result));
  setStatus(result.ok ? "Commit 已建立。" : "Commit 失敗，請查看輸出。", !result.ok);
  await refreshGitStatus();
}

async function pushChanges() {
  if (!confirm("確定要推送到 origin main 並觸發 GitHub Pages 部署嗎？")) return;
  setCommandOutput("正在推送到 GitHub...");
  const result = await api("/api/git/push", { method: "POST" }).catch((error) => ({ ok: false, stderr: error.message }));
  setCommandOutput(formatCommandResult(result));
  setStatus(result.ok ? "已推送到 GitHub，請到 Actions / Pages 查看部署狀態。" : "Push 失敗，請查看輸出。", !result.ok);
  await refreshGitStatus();
}

function renderAll() {
  renderOverview();
  renderContent();
  renderAssets();
  syncJson();
  refreshReferences();
}

function refreshReferences() {
  if (!data) return;
  const referenceList = document.querySelector('[data-reference-list]');
  if (referenceList) referenceList.innerHTML = Object.entries(SiteReferences.values(data))
    .map(([key, value]) => `<li><code>${esc(`{{${key}}}`)}</code> → ${esc(value)}</li>`).join('');
  document.querySelectorAll('[data-path]').forEach(field => {
    let preview = field.parentElement.querySelector('[data-reference-preview]');
    if (!preview) {
      preview = document.createElement('small');
      preview.dataset.referencePreview = '';
      field.parentElement.append(preview);
    }
    preview.hidden = !field.value.includes('{{');
    if (preview.hidden) return;
    try { preview.textContent = `顯示預覽：${SiteReferences.resolveText(field.value, data)}`; }
    catch (error) { preview.textContent = error.message; }
  });
}

function renderOverview() {
  const stats = [
    ["首頁輪播", data.hero?.length || 0, "首頁主視覺與行動按鈕"],
    ["最新消息", data.news?.length || 0, "公告、活動與招生資訊"],
    ["師資", data.faculty?.length || 0, "教師與研究資訊"],
    ["內容頁", data.pages?.length || 0, "系所介紹、課程與實驗室"],
    ["學生資源", data.studentResources?.length || 0, "表單、連結與專區"],
    ["素材", assets.length || 0, "圖片、影片與 PDF"]
  ];
  $("[data-admin-overview]").innerHTML = stats.map(([label, value, hint]) => `
    <article class="stat-card">
      <span>${esc(label)}</span>
      <strong>${esc(value)}</strong>
      <small>${esc(hint)}</small>
    </article>
  `).join("");
}

function renderContent() {
  const sections = [
    ["首頁輪播", renderHero()],
    ["首頁統計", renderMetrics()],
    ["快速連結", renderQuickLinks()],
    ["最新消息", renderNews()],
    ["師資", renderFaculty()],
    ["行政人員", renderStaff()],
    ["內容頁", renderPages()],
    ["學生資源", renderStudentResources()],
    ["影音", renderVideos()]
  ];
  $("[data-content-editor]").innerHTML = sections
    .filter(([, body]) => body.trim())
    .map(([title, body]) => `<h3 class="editor-subtitle">${esc(title)}</h3>${body}`)
    .join("");
}

function renderHero() {
  return (data.hero || []).map((item, i) => itemCard("輪播", i, `hero.${i}`, [
    input("小標", `hero.${i}.kicker`, item.kicker),
    input("標題", `hero.${i}.title`, item.title),
    textarea("說明", `hero.${i}.text`, item.text),
    input("圖片路徑", `hero.${i}.image`, item.image),
    input("圖片位置", `hero.${i}.position`, item.position || "center center"),
    input("影片路徑或 YouTube embed", `hero.${i}.video`, item.video || ""),
    input("主按鈕文字", `hero.${i}.primary.label`, item.primary?.label || ""),
    input("主按鈕連結", `hero.${i}.primary.href`, item.primary?.href || ""),
    input("副按鈕文字", `hero.${i}.secondary.label`, item.secondary?.label || ""),
    input("副按鈕連結", `hero.${i}.secondary.href`, item.secondary?.href || "")
  ], item.title)).join("");
}

function renderMetrics() {
  return (data.metrics || []).map((item, i) => itemCard("統計", i, `metrics.${i}`, [
    input("數字", `metrics.${i}.value`, item.value),
    input("標籤", `metrics.${i}.label`, item.label)
  ], item.value)).join("");
}

function renderQuickLinks() {
  return (data.quickLinks || []).map((item, i) => itemCard("快速連結", i, `quickLinks.${i}`, [
    input("小標", `quickLinks.${i}.kicker`, item.kicker),
    input("文字", `quickLinks.${i}.label`, item.label),
    input("連結", `quickLinks.${i}.href`, item.href)
  ], item.label)).join("");
}

function renderNews() {
  return (data.news || []).map((item, i) => itemCard("消息", i, `news.${i}`, [
    input("站內公告 ID", `news.${i}.id`, item.id || ""),
    input("日期", `news.${i}.date`, item.date, "date"),
    input("分類", `news.${i}.category`, item.category),
    input("標題", `news.${i}.title`, item.title),
    textarea("摘要", `news.${i}.summary`, item.summary),
    textarea("詳細內容，每行一段", `news.${i}.detail`, fromList(item.detail), "list"),
    input("站內連結", `news.${i}.href`, item.href || ""),
    input("原始來源連結（備查）", `news.${i}.sourceHref`, item.sourceHref || ""),
    input("圖片路徑", `news.${i}.image`, item.image || "")
  ], item.title)).join("");
}

function renderFaculty() {
  return (data.faculty || []).map((item, i) => itemCard("教師", i, `faculty.${i}`, [
    input("姓名", `faculty.${i}.name`, item.name),
    input("英文名", `faculty.${i}.enName`, item.enName),
    input("職稱", `faculty.${i}.role`, item.role),
    `<label>聘任類別<select data-path="faculty.${i}.employmentType"><option value="fullTime" ${(item.employmentType || 'fullTime') === 'fullTime' ? 'selected' : ''}>專任</option><option value="partTime" ${item.employmentType === 'partTime' ? 'selected' : ''}>兼任</option><option value="other" ${item.employmentType === 'other' ? 'selected' : ''}>其他</option></select></label>`,
    input("Email", `faculty.${i}.email`, item.email),
    input("電話", `faculty.${i}.phone`, item.phone),
    input("照片路徑", `faculty.${i}.photo`, item.photo),
    input("辦公室", `faculty.${i}.office`, item.office || ""),
    input("實驗室", `faculty.${i}.lab`, item.lab || ""),
    textarea("學歷", `faculty.${i}.education`, item.education || ""),
    textarea("專長", `faculty.${i}.expertise`, item.expertise || "")
  ], item.name)).join("");
}

function renderStaff() {
  return (data.staff || []).map((item, i) => itemCard("行政", i, `staff.${i}`, [
    input("姓名", `staff.${i}.name`, item.name),
    input("職稱", `staff.${i}.role`, item.role),
    input("Email", `staff.${i}.email`, item.email),
    input("電話", `staff.${i}.phone`, item.phone),
    textarea("職務，每行一筆", `staff.${i}.duties`, fromList(item.duties), "list")
  ], item.name)).join("");
}

function renderPages() {
  return (data.pages || []).map((item, i) => itemCard("頁面", i, `pages.${i}`, [
    input("Slug", `pages.${i}.slug`, item.slug),
    input("群組", `pages.${i}.group`, item.group),
    input("標題", `pages.${i}.title`, item.title),
    textarea("摘要", `pages.${i}.summary`, item.summary),
    input("圖片路徑", `pages.${i}.image`, item.image || ""),
    input("第一段標題", `pages.${i}.sections.0.heading`, item.sections?.[0]?.heading || ""),
    textarea("第一段內容，每行一段", `pages.${i}.sections.0.body`, fromList(item.sections?.[0]?.body), "list")
  ], item.title)).join("");
}

function renderStudentResources() {
  return (data.studentResources || []).map((item, i) => itemCard("學生資源", i, `studentResources.${i}`, [
    input("標題", `studentResources.${i}.title`, item.title),
    input("分類", `studentResources.${i}.category`, item.category),
    textarea("摘要", `studentResources.${i}.summary`, item.summary),
    input("連結", `studentResources.${i}.href`, item.href || "")
  ], item.title)).join("");
}

function renderVideos() {
  return (data.videos || []).map((item, i) => itemCard("影音", i, `videos.${i}`, [
    input("標題", `videos.${i}.title`, item.title),
    input("影片路徑或 YouTube embed", `videos.${i}.embed`, item.embed)
  ], item.title)).join("");
}

function renderAssets() {
  const list = $("[data-asset-list]");
  if (!list) return;
  list.innerHTML = assets.length ? assets.map((asset) => `
    <article class="asset-item">
      <div>
        <strong>${esc(asset.name)}</strong>
        <span>${esc(asset.path)} · ${formatSize(asset.size)} · ${esc(asset.modified || "")}</span>
      </div>
      <button type="button" data-copy-asset="${esc(asset.path)}">複製路徑</button>
    </article>
  `).join("") : `<p class="muted">目前沒有素材。</p>`;
}

function itemCard(type, index, path, fields, title = "") {
  return `
    <article class="item">
      <div class="item-head">
        <h3>${esc(type)} ${index + 1}${title ? `：${esc(title)}` : ""}</h3>
        <button class="danger" type="button" data-remove="${esc(path)}">刪除</button>
      </div>
      <div class="grid">${fields.join("")}</div>
    </article>`;
}

function input(label, path, value = "", type = "text") {
  return `<label>${esc(label)}<input type="${esc(type)}" data-path="${esc(path)}" value="${esc(value)}"></label>`;
}

function textarea(label, path, value = "", kind = "") {
  return `<label>${esc(label)}<textarea data-path="${esc(path)}" ${kind ? `data-kind="${esc(kind)}"` : ""}>${esc(value)}</textarea></label>`;
}

function setActiveAdminPanel(name) {
  $$("[data-admin-target]").forEach((button) => button.classList.toggle("is-active", button.dataset.adminTarget === name));
  $$("[data-admin-panel]").forEach((panel) => panel.classList.toggle("is-focused", panel.dataset.adminPanel === name));
  document.querySelector(`[data-admin-panel="${CSS.escape(name)}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function filterAdminItems() {
  const query = ($("[data-admin-search]")?.value || "").trim().toLowerCase();
  $$(".item").forEach((item) => {
    item.hidden = Boolean(query && !item.textContent.toLowerCase().includes(query));
  });
}

function setPath(path, value) {
  const parts = path.split(".");
  let ref = data;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = normalizeKey(parts[i]);
    const nextKey = normalizeKey(parts[i + 1]);
    if (ref[key] == null) ref[key] = typeof nextKey === "number" ? [] : {};
    ref = ref[key];
  }
  ref[normalizeKey(parts.at(-1))] = value;
}

function removePath(path) {
  const parts = path.split(".");
  let ref = data;
  for (let i = 0; i < parts.length - 1; i += 1) ref = ref?.[normalizeKey(parts[i])];
  const key = normalizeKey(parts.at(-1));
  if (Array.isArray(ref)) ref.splice(key, 1);
  else if (ref && key in ref) delete ref[key];
  syncJson();
}

function normalizeKey(key) {
  return /^\d+$/.test(key) ? Number(key) : key;
}

function toList(value) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function fromList(value) {
  return Array.isArray(value) ? value.join("\n") : (value || "");
}

function syncJson() {
  const editor = $("[data-json-editor]");
  if (editor) editor.value = JSON.stringify(data, null, 2);
}

async function api(path, options = {}) {
  const init = { method: options.method || "GET", headers: {} };
  if (options.body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }
  const response = await fetch(`..${path}`, init);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || result.stderr || `HTTP ${response.status}`);
  return result;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    setStatus(`已複製路徑：${text}`);
  } catch {
    setStatus("瀏覽器不允許自動複製，請手動選取路徑。", true);
  }
}

function formatCommandResult(result) {
  return [
    `exit code: ${result.code ?? "unknown"}`,
    result.stdout ? `\nstdout:\n${result.stdout}` : "",
    result.stderr ? `\nstderr:\n${result.stderr}` : ""
  ].join("").trim();
}

function setCommandOutput(text) {
  const node = $("[data-command-output]");
  if (node) node.textContent = text || "";
}

function setStatus(message, isError = false) {
  const status = $("[data-status]");
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("is-error", isError);
}

function formatSize(size = 0) {
  if (size > 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size > 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
