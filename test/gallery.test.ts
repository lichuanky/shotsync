/// <reference types="@cloudflare/workers-types" />
import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src/index";
import { Env } from "../src/responses";

declare global {
  interface ProvidedEnv extends Env {}
}

async function galleryHTML(e: Env): Promise<string> {
  const res = await worker.fetch(new Request("https://x/"), e);
  return res.text();
}

describe("gallery settings panel", () => {
  it("normal mode ships a settings button, a token panel, and a logout control", async () => {
    const html = await galleryHTML(env as Env);
    expect(html).toContain('id="settingsBtn"');
    expect(html).toContain('id="settings"');
    expect(html).toContain('id="tokenReveal"');
    expect(html).toContain('id="tokenCopy"');
    expect(html).toContain('id="logoutBtn"');
  });

  it("inlines the same maskToken the unit tests cover, not a hand-copied variant", async () => {
    const html = await galleryHTML(env as Env);
    expect(html).toContain("const maskToken = function");
  });

  it("demo mode hides the settings button along with the other write controls", async () => {
    const html = await galleryHTML({ ...(env as Env), DEMO_MODE: "1" });
    // The hide list is an array literal followed by .forEach(...); the settings
    // button must be in that list, not merely referenced elsewhere in the page.
    expect(html).toMatch(/\[[^\]]*"#settingsBtn"[^\]]*\]\.forEach/);
  });
});

describe("gallery text file upload", () => {
  it("uploads text files through the same picker with the original filename", async () => {
    const html = await galleryHTML(env as Env);
    // accept 覆盖白名单文本扩展名
    expect(html).toContain(".md,.markdown,.csv,.json,.xml,.yaml,.yml");
    // 上传走 x-filename 头保留原始文件名（服务端 origName 已支持）
    expect(html).toContain('"x-filename"');
  });

  it("inlines isTextMime so JSON/XML MIME-only uploads are accepted", async () => {
    const html = await galleryHTML(env as Env);
    // 与托管端对齐：浏览器对 .json/.xml 可能报 application/json 或 application/xml，
    // 仅靠 f.type.startsWith("text/") 会漏判。内联函数应与 textfile.ts 同源。
    expect(html).toContain("const isTextMime = function");
  });
});

describe("gallery inline script integrity", () => {
  it("emits a syntactically valid inline <script> (template escapes must survive)", async () => {
    const html = await galleryHTML(env as Env);
    const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    expect(scripts.length).toBeGreaterThan(0);
    for (const js of scripts) new Function(js); // 语法非法时抛错
  });
});

describe("gallery text download", () => {
  it("shows a dedicated download button for text items with original-name fallback", async () => {
    const html = await galleryHTML(env as Env);
    // 查看器有独立下载按钮
    expect(html).toContain('id="dlBtn"');
    // 下载用 anchor.download 显式指定文件名（原始名优先，回退 <id>.txt）
    expect(html).toContain(".download =");
    expect(html).toContain("currentName || (currentId");
  });

  it("exposes the current item filename and toggles the button per kind", async () => {
    const html = await galleryHTML(env as Env);
    // 状态变量记录当前文件名
    expect(html).toContain("currentName =");
    // openFull 内根据类型显隐下载按钮
    expect(html).toMatch(/#dlBtn["']?\)\.hidden/);
  });

  it("names image downloads with the original filename, falling back to <id>.<ext>", async () => {
    const html = await galleryHTML(env as Env);
    // saveBtn 图片分支与 dlBtn 文本分支同链路：原始名优先，回退 <id>.<ext>
    expect(html).toContain('currentName || (currentId + "." + ext)');
    // openFull 的文本/图片两个分支都从卡片恢复原始名（声明行不算）
    const restores = html.match(/currentName = \(cell && cell\.dataset\.name\) \|\| null/g) || [];
    expect(restores.length).toBe(2);
  });

  it("reuses the viewer's cached blob so share/download fires within user activation", async () => {
    const html = await galleryHTML(env as Env);
    // openFull 图片分支缓存 blob，saveBtn 优先复用（不再每次点击都 await fetch，
    // 避免 Android 上 fetch 耗尽 user activation 导致 Web Share 面板转圈挂起）
    expect(html).toContain("currentBlob = blob");
    expect(html).toContain("let blob = currentBlob");
    expect(html).toContain("currentBlob = null");
  });

  it("keeps blob URLs alive long enough for slow download starts (no 1s revoke)", async () => {
    const html = await galleryHTML(env as Env);
    // Windows Chrome/Edge 启动下载是异步的：1s 即撤销 blob URL 会与下载启动
    // 竞态，浏览器报「无法下载 - 网络问题」。revoke 必须延迟到 30s 量级。
    expect(html).not.toContain("revokeObjectURL(url), 1000");
    const longRevokes = html.match(/revokeObjectURL\(url\), 30000\)/g) || [];
    expect(longRevokes.length).toBe(2); // saveBtn 图片分支 + dlBtn 文本分支
  });

  it("uses Web Share only on mobile; PC downloads via anchor like text files", async () => {
    const html = await galleryHTML(env as Env);
    // Windows 桌面 canShare({files}) 为 true 但系统分享面板保存文件不可靠
    //（闪退/无响应）。仅移动端走 Web Share，PC 一律 anchor 下载（与 dlBtn 同路）。
    expect(html).toContain("const isMobile =");
    expect(html).toContain("if (isMobile && navigator.canShare");
  });
});

describe("gallery UI cleanup", () => {
  it("hides the about footer in normal mode but keeps it visible in demo mode", async () => {
    const html = await galleryHTML(env as Env);
    // 正式版页脚隐藏（hidden 属性内联在 footer 开标签上）
    expect(html).toContain('<footer id="aboutFooter" hidden');
    // 登录页「了解 shotsync」链接不受影响
    expect(html).toContain("了解 shotsync · 部署与使用教程");

    const demoHtml = await galleryHTML({ ...(env as Env), DEMO_MODE: "1" });
    // demo 演示站页脚可见（hidden 已被替换链摘除）
    expect(demoHtml).toContain('<footer id="aboutFooter" style=');
    expect(demoHtml).not.toContain('<footer id="aboutFooter" hidden');
  });

  it("renders text cards and viewer without the filename prefix", async () => {
    const html = await galleryHTML(env as Env);
    // 卡片与查看器不再拼文件名前缀行
    expect(html).not.toContain('item.name + "\\n"');
    expect(html).not.toContain('name + "\\n"');
    // 下载命名链路仍依赖 dataset.name，必须保留
    expect(html).toContain("el.dataset.name = item.name");
    expect(html).toContain("currentName = (cell && cell.dataset.name) || null");
  });
});
