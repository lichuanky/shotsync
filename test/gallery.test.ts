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
