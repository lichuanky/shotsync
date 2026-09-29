import { describe, it, expect } from "vitest";
import { isTextFileName, isTextMime, TEXT_ACCEPT_ATTR } from "../src/textfile";

describe("isTextFileName", () => {
  it("accepts whitelisted extensions", () => {
    for (const name of ["a.txt", "b.md", "c.markdown", "d.csv", "e.json", "f.xml", "g.yaml", "h.yml", "i.TXT", "j.Md"]) {
      expect(isTextFileName(name), name).toBe(true);
    }
  });
  it("rejects binaries, unknown extensions and extension-less names", () => {
    for (const name of ["a.png", "a.jpg", "a.heic", "a.sh", "a.sql", "a.pdf", "noext", ".hidden"]) {
      expect(isTextFileName(name), name).toBe(false);
    }
  });
});

describe("isTextMime", () => {
  it("accepts text/* and structured text mimes", () => {
    for (const mime of ["text/plain", "text/markdown", "text/csv", "application/json", "application/xml", "text/xml", "text/yaml"]) {
      expect(isTextMime(mime), mime).toBe(true);
    }
  });
  it("rejects images and opaque types", () => {
    for (const mime of ["image/png", "application/octet-stream", "application/pdf", ""]) {
      expect(isTextMime(mime), mime).toBe(false);
    }
  });
});

describe("TEXT_ACCEPT_ATTR", () => {
  it("covers images and whitelisted text extensions", () => {
    expect(TEXT_ACCEPT_ATTR).toContain("image/*");
    expect(TEXT_ACCEPT_ATTR).toContain(".md");
    expect(TEXT_ACCEPT_ATTR).toContain(".csv");
    expect(TEXT_ACCEPT_ATTR).toContain(".json");
  });
});
