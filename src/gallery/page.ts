import { maskToken } from "./settings";
import { isTextFileName, isTextMime, TEXT_ACCEPT_ATTR, TEXT_EXTENSIONS } from "../textfile";

// The demo variant is derived once at module load (see the bottom of this file)
// by flipping the DEMO const the inline script declares.
export const galleryHTML = /* html */ `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>shotsync</title>
<meta name="description" content="shotsync 跨设备图片与文字池。在自己的 Cloudflare 实例中上传截图、照片和文字，从另一台设备取回。">
<meta name="robots" content="noindex, follow">
<link rel="manifest" href="/manifest.webmanifest">
<meta name="theme-color" content="#111111">
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #111; color: #eee; font: 15px/1.4 -apple-system, system-ui, sans-serif; }
  header { position: sticky; top: 0; display: flex; align-items: center; gap: 12px;
           padding: 10px 14px; background: #181818; border-bottom: 1px solid #2a2a2a; }
  header h1 { font-size: 16px; margin: 0; flex: 1; }
  button { background: #2b6cff; color: #fff; border: 0; border-radius: 8px; padding: 8px 12px; font-size: 14px; }
  #grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 6px; padding: 6px; }
  #grid img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px; background: #222; cursor: pointer; }
  #gate { position: fixed; inset: 0; display: flex; flex-direction: column; gap: 12px;
          align-items: center; justify-content: center; background: #111; padding: 24px; }
  #gate input { padding: 10px; border-radius: 8px; border: 1px solid #333; background: #1c1c1c; color: #eee; width: min(360px, 90vw); }
  .hidden { display: none !important; }
  #toast { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
           background: #333; padding: 10px 16px; border-radius: 20px; opacity: 0; transition: opacity .2s; }
  #toast.show { opacity: 1; }
  #grid .txtcell { width: 100%; aspect-ratio: 1; border-radius: 6px; background: #1c2030; color: #cdd3e0;
                   padding: 8px; font-size: 12px; line-height: 1.35; overflow: hidden; cursor: pointer;
                   white-space: pre-wrap; word-break: break-word; }
  #viewerText { flex: 1; min-height: 0; overflow: auto; margin: 0; padding: 16px; white-space: pre-wrap;
                word-break: break-word; color: #eee; font: 14px/1.6 ui-monospace, monospace; }
  #compose { position: fixed; inset: 0; z-index: 11; background: rgba(0,0,0,.92);
             display: flex; flex-direction: column; gap: 10px; padding: 12px; }
  #compose textarea { flex: 1; min-height: 0; resize: none; padding: 12px; border-radius: 8px;
                      border: 1px solid #333; background: #1c1c1c; color: #eee; font-size: 15px; }
  #compose .row { display: flex; justify-content: flex-end; gap: 10px; }
  #settings { position: fixed; inset: 0; z-index: 11; background: rgba(0,0,0,.92);
              display: flex; align-items: center; justify-content: center; padding: 16px; }
  #settings .card { width: 100%; max-width: 420px; background: #181818; border: 1px solid #2a2a2a;
                    border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
  #settings h2 { font-size: 16px; margin: 0; }
  #settings .kv { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: #aaa; }
  #settings code { font: 13px/1.4 ui-monospace, Menlo, monospace; color: #eee; word-break: break-all;
                   background: #222; padding: 8px; border-radius: 8px; user-select: all; }
  #settings .row { display: flex; justify-content: flex-end; gap: 10px; }
  #grid .sel { outline: 3px solid #2b6cff; outline-offset: -3px; opacity: .8; }
</style>
<!-- Inline so the browser never requests /favicon.ico, which this Worker does
     not serve and which showed up as a 404 on every desktop page load. -->
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%232b6cff'/%3E%3Cpath d='M9 20.5l5-9 4 6 2-3 3 6z' fill='%23fff'/%3E%3Ccircle cx='11.5' cy='11' r='2' fill='%23fff'/%3E%3C/svg%3E">
</head>
<body>
  <div id="gate" class="hidden">
    <div>输入访问 token</div>
    <p style="max-width:320px;color:#aaa;font-size:14px;line-height:1.6;margin:0">这是独立部署的个人图片池，无需注册账号。请输入部署者设置的访问令牌。</p>
    <input id="tokenInput" type="password" placeholder="ShotSync 访问令牌" autocomplete="off">
    <button id="tokenSave">进入相册</button>
    <a href="/about" style="color:#9dbdff">了解 shotsync · 部署与使用教程</a>
    <div id="gateErr" style="color:#ff6b6b"></div>
  </div>

  <header class="hidden" id="bar">
    <h1>shotsync</h1>
    <input id="fileInput" type="file" accept="${TEXT_ACCEPT_ATTR}" multiple class="hidden">
    <button id="textBtn" style="background:#444">✎ 文字</button>
    <button id="uploadBtn">+ 图片</button>
    <button id="selectBtn" style="background:#444">选择</button>
    <button id="settingsBtn" style="background:#444" title="设置" aria-label="设置">⚙</button>
    <button id="delSelBtn" class="hidden" style="background:#d23">删除选中</button>
    <button id="cancelSelBtn" class="hidden" style="background:#444">取消</button>
  </header>
  <main id="grid"></main>
  <footer id="aboutFooter" hidden style="padding:20px;text-align:center"><a href="/about" style="color:#9dbdff">关于 shotsync · 部署与使用教程</a></footer>
  <div id="toast"></div>

  <div id="compose" class="hidden">
    <textarea id="composeText" placeholder="粘贴或输入文字，发送到图池…"></textarea>
    <div class="row">
      <button id="composeSend">发送</button>
      <button id="composeCancel" style="background:#444">取消</button>
    </div>
  </div>

  <div id="settings" class="hidden">
    <div class="card">
      <h2>设置</h2>
      <div class="kv"><span>相册地址（其他设备照着输）</span><code id="settingsUrl"></code></div>
      <div class="kv"><span>访问 token</span><code id="tokenValue"></code></div>
      <div class="row">
        <button id="tokenReveal" style="background:#444">显示</button>
        <button id="tokenCopy">复制</button>
      </div>
      <div class="row" style="justify-content:space-between;margin-top:6px">
        <button id="logoutBtn" style="background:#d23">退出登录</button>
        <button id="settingsClose" style="background:#444">关闭</button>
      </div>
    </div>
  </div>

  <div id="viewer" class="hidden" style="position:fixed;inset:0;background:rgba(0,0,0,.95);display:flex;flex-direction:column;z-index:10">
    <div style="display:flex;justify-content:flex-end;gap:10px;padding:10px">
      <button id="shareBtn" style="background:#0a8a5f">分享</button>
      <button id="saveBtn" style="background:#2b6cff">保存</button>
      <button id="dlBtn" style="background:#0a8a5f" hidden>下载</button>
      <button id="delBtn" style="background:#d23">删除</button>
      <button id="closeBtn" style="background:#444">关闭</button>
    </div>
    <img id="viewerImg" class="hidden" style="flex:1;min-height:0;object-fit:contain;width:100%">
    <pre id="viewerText" class="hidden"></pre>
  </div>

<script>
// Inlined from ./textfile so the browser can use the same whitelist without a
// bundler round-trip. Both must be injected — TEXT_EXTENSIONS powers the picker
// accept attribute and isTextFileName drives the upload branching. Mask token
// pattern below matches the same build-time toString() approach (see
// hosted/ui.ts for the multi-line variant of this contract).
const TEXT_EXTENSIONS = ${JSON.stringify(TEXT_EXTENSIONS)};
const isTextFileName = ${isTextFileName.toString()};
const isTextMime = ${isTextMime.toString()};
const DEMO = false; // the DEMO_MODE worker serves this page with "true" (see index.ts)
// Demo chrome switches to English for non-Chinese browsers (HN/Reddit visitors).
// Normal pools are unaffected: DEMO_EN is always false when DEMO is false.
const DEMO_EN = DEMO && !((navigator.language || "").toLowerCase().startsWith("zh"));
const TOKEN_KEY = "shotsync_token";
let token = localStorage.getItem(TOKEN_KEY) || "";

const $ = (s) => document.querySelector(s);
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 1800); }
function authHeaders() { return { authorization: "Bearer " + token }; }

async function apiOk() {
  const res = await fetch("/api/list?limit=1", { headers: authHeaders() });
  return res.ok;
}

function showGate(err) { $("#gate").classList.remove("hidden"); $("#bar").classList.add("hidden"); if (err) $("#gateErr").textContent = err; }
function showApp() { $("#gate").classList.add("hidden"); $("#bar").classList.remove("hidden"); }

$("#tokenSave").onclick = async () => {
  token = $("#tokenInput").value.trim();
  if (!token) return;
  localStorage.setItem(TOKEN_KEY, token);
  if (await apiOk()) { showApp(); setupUpload(); await initFeed(); }
  else { localStorage.removeItem(TOKEN_KEY); showGate("token 无效"); }
};

// Settings panel: where this device points and the token it holds, so a second
// device can be set up without digging through localStorage. The token is
// masked by default — this app auto-uploads Mac screenshots, so a plaintext
// token on screen is one ⌘⇧3 away from landing in the pool. maskToken is the
// real function from ./settings (see its unit tests), inlined at build time.
const maskToken = ${maskToken.toString()};
let tokenShown = false;
function renderToken() {
  $("#tokenValue").textContent = tokenShown ? token : maskToken(token);
  $("#tokenReveal").textContent = tokenShown ? "隐藏" : "显示";
}
function closeSettings() { tokenShown = false; $("#settings").classList.add("hidden"); }
$("#settingsBtn").onclick = () => {
  tokenShown = false;
  $("#settingsUrl").textContent = location.origin;
  renderToken();
  $("#settings").classList.remove("hidden");
};
$("#settingsClose").onclick = closeSettings;
$("#tokenReveal").onclick = () => { tokenShown = !tokenShown; renderToken(); };
$("#tokenCopy").onclick = async () => {
  try { await navigator.clipboard.writeText(token); toast("token 已复制"); }
  catch { prompt("访问 token，选中复制：", token); }
};
// Log out = forget the token and reload: boot() then lands on the gate with no
// leftover poll timer or duplicated upload handlers to worry about.
$("#logoutBtn").onclick = () => {
  if (!confirm("退出登录？这台设备之后要重新输入 token。")) return;
  localStorage.removeItem(TOKEN_KEY);
  location.reload();
};

// Task 10-12 implementation:

// Full viewer: shows an image or a text item, with delete + save/copy
let currentId = null, currentKind = "image", currentName = null, currentBlob = null;

async function openFull(id) {
  currentId = id;
  const v = $("#viewer"), img = $("#viewerImg"), txt = $("#viewerText");
  img.removeAttribute("src"); img.classList.add("hidden");
  txt.textContent = ""; txt.classList.add("hidden");
  v.classList.remove("hidden");
  try {
    const res = await fetch("/i/" + id + "?size=full", { headers: authHeaders() });
    if (!res.ok) return;
    const ct = res.headers.get("content-type") || "";
    if (ct.indexOf("text/") === 0) {
      currentKind = "text";
      // openFull only takes an id, so pull the original filename from the
      // matching card's dataset (written by makeCell when the list item had
      // one). Falls back to the bare body when the card is gone or has no
      // name, preserving pre-Task-4 behaviour for pasted notes.
      const cell = document.querySelector('#grid [data-id="' + id + '"]');
      // 仅供下载命名（a.download），不再拼进预览/复制内容。
      currentName = (cell && cell.dataset.name) || null;
      const body = await res.text();
      txt.textContent = body;
      txt.classList.remove("hidden");
    } else {
      currentKind = "image";
      // 图片下载命名与文本分支同链路：原始名优先，回退 <id>.<ext>
      const cell = document.querySelector('#grid [data-id="' + id + '"]');
      currentName = (cell && cell.dataset.name) || null;
      // 缓存全尺寸 blob 供 saveBtn 复用：点「保存」时不再二次 fetch——
      // Android 的 Web Share 要求 user activation 有效期（约 5s）内调用，
      // 点击后再 await 网络请求会耗尽 activation，分享面板转圈挂起。
      const blob = await res.blob();
      currentBlob = blob;
      const url = URL.createObjectURL(blob);
      img.addEventListener("load", () => URL.revokeObjectURL(url), { once: true });
      img.src = url; img.classList.remove("hidden");
    }
    $("#saveBtn").textContent = currentKind === "text"
      ? (DEMO_EN ? "Copy" : "复制")
      : (DEMO_EN ? "Save" : "保存");
    $("#dlBtn").hidden = currentKind !== "text";
  } catch {}
}

document.querySelector("#closeBtn").onclick = () => document.querySelector("#viewer").classList.add("hidden");

// Mint a public, signed, 7-day link for the current item and copy it to the
// clipboard. Copy (not the OS share sheet) because the desktop share sheet has
// no "copy link" entry; clipboard works on both desktop and mobile. If the
// clipboard API is blocked, fall back to a prompt() showing the URL to copy.
document.querySelector("#shareBtn").onclick = async () => {
  if (!currentId) return;
  try {
    const res = await fetch("/api/share/" + currentId, { method: "POST", headers: authHeaders() });
    if (!res.ok) { toast("生成链接失败"); return; }
    const { url } = await res.json();
    try {
      await navigator.clipboard.writeText(url);
      toast("链接已复制（7天有效）");
    } catch {
      prompt("分享链接（7天有效），选中复制：", url);
    }
  } catch { toast("生成链接失败"); }
};

// Save/download the current full image. Mobile: Web Share (save to Photos / forward).
// Desktop or no-share: trigger a file download. Re-fetches the blob (viewer URL is revoked on load).
document.querySelector("#saveBtn").onclick = async () => {
  if (!currentId) return;
  if (currentKind === "text") {
    try { await navigator.clipboard.writeText($("#viewerText").textContent); toast(DEMO_EN ? "Copied" : "已复制"); }
    catch { toast(DEMO_EN ? "Copy failed — long-press to select" : "复制失败，请长按选择"); }
    return;
  }
  try {
    // 优先复用 openFull 缓存的 blob（无网络等待，保住 user activation）；
    // 缓存为空（如刷新后直开）才回退到现场 fetch。
    let blob = currentBlob;
    if (!blob) {
      const res = await fetch("/i/" + currentId + "?size=full", { headers: authHeaders() });
      if (!res.ok) { toast(DEMO_EN ? "Save failed" : "保存失败"); return; }
      blob = await res.blob();
    }
    const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const file = new File([blob], currentName || (currentId + "." + ext), { type: blob.type || "image/jpeg" });
    // 仅移动端走 Web Share（保存到相册/转发）。Windows 桌面的 canShare({files})
    // 也为 true，但其系统分享面板保存文件不可靠（闪退/无响应）——PC 一律
    // anchor 下载，与 dlBtn 文本下载同路。
    const isMobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    if (isMobile && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file] });
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = file.name;
      document.body.appendChild(a); a.click(); a.remove();
      // Windows Chrome/Edge 启动下载是异步的（保存对话框/杀软扫描都会拖慢），
      // 过早 revoke 会与下载启动竞态 → 「无法下载 - 网络问题」。延迟到 30s。
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    }
  } catch (e) {
    if (e && e.name !== "AbortError") toast(DEMO_EN ? "Save failed" : "保存失败"); // ignore user-cancelled share
  } finally {
    currentBlob = null;
  }
};

// Download the current text item as a file. Original filename (from upload)
// when present, otherwise <id>.txt for pasted notes. Plain anchor download —
// Android clipboards cannot hold very long text, so download is the escape hatch.
document.querySelector("#dlBtn").onclick = async () => {
  if (!currentId || currentKind !== "text") return;
  try {
    const res = await fetch("/i/" + currentId + "?size=full", { headers: authHeaders() });
    if (!res.ok) { toast(DEMO_EN ? "Download failed" : "下载失败"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = currentName || (currentId + ".txt");
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  } catch { toast(DEMO_EN ? "Download failed" : "下载失败"); }
};

document.querySelector("#delBtn").onclick = async () => {
  if (!currentId || !confirm("删除这条？")) return;
  const res = await fetch("/api/img/" + currentId, { method: "DELETE", headers: authHeaders() });
  if (res.ok) {
    const cell = document.querySelector('#grid [data-id="' + currentId + '"]');
    if (cell) cell.remove();
    knownIds.delete(currentId);
    document.querySelector("#viewer").classList.add("hidden");
    toast("已删除");
  } else { toast("删除失败"); }
};

// Task 10: Gallery feed with lazy thumbnail loading, infinite scroll, and polling
let cursor = null, loading = false, knownIds = new Set(), pollTimer = null;
let contentObserver;

// Multi-select batch delete: tap cells to select, then "delete selected".
let selectMode = false; const selected = new Set();
function toggleSelect(el) {
  const id = el.dataset.id;
  if (selected.has(id)) { selected.delete(id); el.classList.remove("sel"); }
  else { selected.add(id); el.classList.add("sel"); }
  $("#delSelBtn").textContent = "删除选中 (" + selected.size + ")";
}
function enterSelect() {
  selectMode = true; selected.clear();
  $("#selectBtn").classList.add("hidden"); $("#textBtn").classList.add("hidden"); $("#uploadBtn").classList.add("hidden");
  $("#delSelBtn").classList.remove("hidden"); $("#cancelSelBtn").classList.remove("hidden");
  $("#delSelBtn").textContent = "删除选中 (0)";
}
function exitSelect() {
  selectMode = false; selected.clear();
  document.querySelectorAll("#grid .sel").forEach((e) => e.classList.remove("sel"));
  $("#selectBtn").classList.remove("hidden"); $("#textBtn").classList.remove("hidden"); $("#uploadBtn").classList.remove("hidden");
  $("#delSelBtn").classList.add("hidden"); $("#cancelSelBtn").classList.add("hidden");
}
async function deleteSelected() {
  if (!selected.size) { exitSelect(); return; }
  if (!confirm("删除选中的 " + selected.size + " 项？")) return;
  const ids = [...selected];
  let ok = 0;
  await Promise.all(ids.map(async (id) => {
    try {
      const res = await fetch("/api/img/" + id, { method: "DELETE", headers: authHeaders() });
      if (res.ok) {
        ok++;
        const cell = document.querySelector('#grid [data-id="' + id + '"]');
        if (cell) cell.remove();
        knownIds.delete(id);
      }
    } catch {}
  }));
  exitSelect();
  toast("已删除 " + ok + " 项");
}

async function fetchPage(c) {
  const qs = c ? "?cursor=" + encodeURIComponent(c) + "&limit=40" : "?limit=40";
  const res = await fetch("/api/list" + qs, { headers: authHeaders() });
  if (!res.ok) throw new Error("list failed");
  return res.json();
}

async function loadThumb(img) {
  const id = img.dataset.id;
  try {
    const res = await fetch("/i/" + id + "?size=thumb", { headers: authHeaders() });
    if (!res.ok) return;
    const url = URL.createObjectURL(await res.blob());
    img.addEventListener("load", () => URL.revokeObjectURL(url), { once: true });
    img.src = url;
  } catch {}
}

async function loadTextSnippet(card) {
  try {
    const res = await fetch("/i/" + card.dataset.id, { headers: authHeaders() });
    if (!res.ok) return;
    card.textContent = (await res.text()).slice(0, 140);
  } catch {}
}

function makeCell(item) {
  const isText = (item.contentType || "").indexOf("text/") === 0;
  const el = document.createElement(isText ? "div" : "img");
  el.dataset.id = item.id;
  el.dataset.kind = isText ? "text" : "image";
  // 原始文件名仅供下载命名（openFull → currentName → a.download / share），
  // 文本与图片卡片都需要。
  if (item.name) el.dataset.name = item.name;
  if (isText) {
    el.className = "txtcell";
    // /api/list now carries the preview, so the card renders its real text on
    // first paint. The "…" placeholder and the lazy fetch remain for items the
    // server did not inline (past MAX_INLINE_SNIPPETS, or a failed read).
    el.textContent = item.snippet || "…";
  }
  el.onclick = () => { if (selectMode) toggleSelect(el); else openFull(item.id); };
  // Nothing left to load for a text card that already has its snippet —
  // observing it would fire one pointless request per card.
  if (!(isText && item.snippet)) contentObserver.observe(el);
  return el;
}

function appendItems(items, prepend) {
  const grid = document.querySelector("#grid");
  for (const it of items) {
    if (knownIds.has(it.id)) continue;
    knownIds.add(it.id);
    const cell = makeCell(it);
    if (prepend) grid.prepend(cell); else grid.append(cell);
  }
}

async function loadMore() {
  if (loading || cursor === false) return;
  loading = true;
  try {
    const { items, cursor: next } = await fetchPage(cursor);
    appendItems(items, false);
    cursor = next || false;
  } finally { loading = false; }
}

async function poll() {
  try {
    const { items } = await fetchPage(null);
    // Server returns newest-first; reverse the new batch so prepending yields newest at top.
    appendItems(items.filter((i) => !knownIds.has(i.id)).reverse(), true);
  } catch {}
}

async function initFeed() {
  contentObserver = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) {
      if (e.target.dataset.kind === "text") loadTextSnippet(e.target);
      else loadThumb(e.target);
      contentObserver.unobserve(e.target);
    }
  }, { rootMargin: "200px" });

  cursor = null; knownIds = new Set();
  document.querySelector("#grid").innerHTML = "";
  await loadMore();

  window.onscroll = () => {
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 400) loadMore();
  };
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(poll, 20000);
}

function fitDims(w, h, maxEdge) {
  const longEdge = Math.max(w, h);
  if (longEdge <= maxEdge) return { w, h };
  const s = maxEdge / longEdge;
  return { w: Math.round(w * s), h: Math.round(h * s) };
}

async function encode(bitmap, maxEdge, type, quality) {
  const { w, h } = maxEdge ? fitDims(bitmap.width, bitmap.height, maxEdge)
                           : { w: bitmap.width, h: bitmap.height };
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function uploadOne(file) {
  const bitmap = await createImageBitmap(file);          // Browser decodes (including HEIC on iOS)
  let full, thumb;
  try {
    full = await encode(bitmap, null, "image/jpeg", 0.92);
    thumb = await encode(bitmap, 480, "image/jpeg", 0.7);
  } finally {
    bitmap.close();                                      // release decoded pixel buffer (mobile memory)
  }
  const fd = new FormData();
  fd.set("full", full, "u.jpg");
  fd.set("thumb", thumb, "t.jpg");
  // x-filename 携带原始文件名（服务端存 origName）：图片经转码后 FormData
  // 名只是占位（u.jpg），没有这个头下载时就只能回退 <id>.jpg。浏览器 fetch
  // 请求头不允许非 ISO-8859-1 字符，中文名必须 encodeURIComponent。
  const res = await fetch("/api/upload", { method: "POST", headers: { ...authHeaders(), "x-source": "pwa", "x-filename": encodeURIComponent(file.name || "u.jpg") }, body: fd });
  if (!res.ok) throw new Error("upload failed");
  return (await res.json()).id;
}

async function uploadTextFile(file) {
  const text = await file.text();
  const fd = new FormData();
  fd.set("full", new Blob([text], { type: "text/plain" }), file.name || "file.txt");
  const res = await fetch("/api/upload", { method: "POST", headers: { ...authHeaders(), "x-source": "pwa", "x-filename": encodeURIComponent(file.name || "file.txt") }, body: fd });
  if (!res.ok) throw new Error("upload failed");
  return (await res.json()).id;
}

async function sendText(text) {
  if (!text.trim()) return false;
  const fd = new FormData();
  fd.set("full", new Blob([text], { type: "text/plain" }), "note.txt");
  const res = await fetch("/api/upload", { method: "POST", headers: { ...authHeaders(), "x-source": "pwa" }, body: fd });
  if (!res.ok) { toast("文字发送失败"); return false; }
  return true;
}

function setupUpload() {
  const input = $("#fileInput");
  $("#uploadBtn").onclick = () => input.click();
  input.onchange = async () => {
    const files = [...input.files];
    input.value = "";
    let ok = 0;
    for (const f of files) {
      try {
        if (f.type.startsWith("image/")) { await uploadOne(f); }
        else if (isTextFileName(f.name) || isTextMime(f.type)) { await uploadTextFile(f); }
        else { throw new Error("unsupported"); }
        ok++;
      } catch { toast("有文件上传失败"); }
    }
    if (ok > 0) toast(ok === files.length ? "上传完成" : ok + "/" + files.length + " 上传成功");
    await poll();
  };

  const compose = $("#compose"), composeText = $("#composeText");
  $("#textBtn").onclick = () => { composeText.value = ""; compose.classList.remove("hidden"); composeText.focus(); };
  $("#composeCancel").onclick = () => compose.classList.add("hidden");
  $("#composeSend").onclick = async () => {
    if (await sendText(composeText.value)) { compose.classList.add("hidden"); toast("已发送"); await poll(); }
  };

  $("#selectBtn").onclick = enterSelect;
  $("#cancelSelBtn").onclick = exitSelect;
  $("#delSelBtn").onclick = deleteSelected;
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

// Read-only demo pool: offer the hosted service and self-hosting without enabling writes.
async function enterDemo() {
  showApp();
  ["#uploadBtn", "#textBtn", "#selectBtn", "#settingsBtn", "#shareBtn", "#dlBtn", "#delBtn"].forEach((s) => $(s).classList.add("hidden"));
  if (DEMO_EN) document.documentElement.lang = "en";
  $("#bar h1").textContent = DEMO_EN ? "shotsync · read-only demo" : "shotsync · 只读演示池";
  $("#closeBtn").textContent = DEMO_EN ? "Close" : "关闭";
  $("#bar").style.flexWrap = "wrap";
  const hosted = document.createElement("a");
  hosted.id = "hosted-link";
  hosted.href = "https://shotsync-hosted.defiabell.workers.dev";
  hosted.textContent = DEMO_EN ? "Use online →" : "直接使用在线版 →";
  hosted.style.cssText = "background:#2b6cff;color:#fff;font-size:13px;text-decoration:none;padding:8px 12px;border-radius:8px;white-space:nowrap";
  $("#bar").appendChild(hosted);
  const link = document.createElement("a");
  link.href = "https://github.com/Defiabell/shotsync";
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = DEMO_EN ? "Deploy your own in ~5 min →" : "5 分钟部署自己的 →";
  link.style.cssText = "color:#8ab4ff;font-size:13px;text-decoration:none;white-space:nowrap";
  $("#bar").appendChild(link);
  await initFeed();
}

(async function boot() {
  if (DEMO) { await enterDemo(); return; }
  if (token && await apiOk()) { showApp(); setupUpload(); await initFeed(); }
  else { showGate(); }
})();
</script>
</body>
</html>`;

// 正式版页脚隐藏（aboutFooter 带 hidden），demo 演示站替换后可见——与
// const DEMO 的字符串替换同构。
export const galleryDemoHTML = galleryHTML
  .replace("const DEMO = false", "const DEMO = true")
  .replace('<footer id="aboutFooter" hidden', '<footer id="aboutFooter"');
