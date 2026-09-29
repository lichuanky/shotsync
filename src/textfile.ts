// 文本文件白名单：扩展名为主判定（浏览器对 .md/.csv/.yaml 常报空 MIME 或
// application/octet-stream），MIME 兜底。两个前端（gallery/page.ts、
// hosted/ui.ts）内联本文件的导出：先 `${JSON.stringify(TEXT_EXTENSIONS)}`
// 注入数组，再 `${fn.toString()}` 注入函数——toString 不含模块级闭包引用，
// 两者缺一浏览器端会报未定义。修改判定时两端自动一致。

export const TEXT_EXTENSIONS = ["txt", "md", "markdown", "csv", "json", "xml", "yaml", "yml"];

export const TEXT_ACCEPT_ATTR =
  "image/*," + TEXT_EXTENSIONS.map((e) => "." + e).join(",");

export function isTextFileName(name: string): boolean {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return false; // 无扩展名或 .hidden 形式
  return TEXT_EXTENSIONS.includes(name.slice(dot + 1).toLowerCase());
}

export function isTextMime(mime: string): boolean {
  const m = mime.split(";")[0].trim().toLowerCase();
  return m.startsWith("text/") || m === "application/json" || m === "application/xml";
}
