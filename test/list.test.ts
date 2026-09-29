/// <reference types="@cloudflare/workers-types" />
import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { handleList } from "../src/handlers/list";
import { fullKey, makeId } from "../src/ids";
import { Env } from "../src/responses";

declare global {
  interface ProvidedEnv extends Env {}
}

async function seed(epochMs: number, hasThumb: string) {
  const id = makeId(epochMs, "aaaaaa".slice(0, 5) + (epochMs % 10));
  await (env as Env).BUCKET.put(fullKey(id, "png"), new Uint8Array([1]), {
    httpMetadata: { contentType: "image/png" },
    customMetadata: { hasThumb, source: "mac", uploadedAt: "x", origName: "" },
  });
  return id;
}

function listReq(qs = "", token = "test-token"): Request {
  return new Request(`https://x/api/list${qs}`, { headers: { authorization: `Bearer ${token}` } });
}

describe("handleList", () => {
  beforeEach(async () => {
    // vitest-pool-workers isolates storage per test, no manual cleanup needed
  });

  it("401 without token", async () => {
    const res = await handleList(new Request("https://x/api/list"), env as any);
    expect(res.status).toBe(401);
  });

  it("returns items newest-first with metadata", async () => {
    await seed(1000, "false");
    await seed(3000, "true");
    await seed(2000, "false");
    const res = await handleList(listReq(), env as any);
    const body = await res.json<{ items: any[]; cursor: string | null }>();
    const times = body.items.map((i) => i.time);
    expect(times).toEqual([3000, 2000, 1000]); // reversed order
    const newest = body.items[0];
    expect(newest.hasThumb).toBe(true);
    expect(newest.contentType).toBe("image/png");
    expect(newest.source).toBe("mac");
  });

  it("respects limit and returns cursor", async () => {
    await seed(1000, "false");
    await seed(2000, "false");
    await seed(3000, "false");
    const res = await handleList(listReq("?limit=2"), env as any);
    const body = await res.json<{ items: any[]; cursor: string | null }>();
    expect(body.items.length).toBe(2);
    expect(body.cursor).toBeTruthy();
  });
});

// The gallery used to render every text card as "…" and then fetch each one
// separately. On the live demo pool that left four cards visibly empty from
// 1.8s (list resolved) until 3.6s (last fetch landed). The snippet now travels
// with the list, so these tests pin the three properties that make that safe.
describe("handleList: inline text snippets", () => {
  async function seedText(epochMs: number, body: string) {
    const id = makeId(epochMs, "t" + (epochMs % 10000));
    await (env as Env).BUCKET.put(fullKey(id, "txt"), new TextEncoder().encode(body), {
      httpMetadata: { contentType: "text/plain" },
      customMetadata: { hasThumb: "false", source: "mac", uploadedAt: "x", origName: "" },
    });
    return id;
  }

  it("carries a text item's preview so the card needs no follow-up request", async () => {
    await seedText(1_700_000_000_000, "会议室改到 3F-北，14:00 见");
    const body = await (await handleList(listReq(), env as Env)).json<{
      items: { contentType: string; snippet?: string }[];
    }>();
    const text = body.items.find(i => i.contentType.startsWith("text/"))!;
    expect(text.snippet).toBe("会议室改到 3F-北，14:00 见");
  });

  it("truncates to the same length the client used to slice to", async () => {
    await seedText(1_700_000_001_000, "x".repeat(400));
    const body = await (await handleList(listReq(), env as Env)).json<{
      items: { snippet?: string }[];
    }>();
    expect(body.items.find(i => i.snippet)!.snippet).toHaveLength(140);
  });

  it("leaves image items alone — no snippet, and their bodies are never read", async () => {
    await seed(1_700_000_002_000, "true");
    const body = await (await handleList(listReq(), env as Env)).json<{
      items: { contentType: string; snippet?: string }[];
    }>();
    const img = body.items.find(i => i.contentType.startsWith("image/"))!;
    expect(img.snippet).toBeUndefined();
  });

  it("never leaks the internal R2 key, which only exists to read the snippet", async () => {
    await seedText(1_700_000_003_000, "hi");
    const raw = await (await handleList(listReq(), env as Env)).text();
    expect(raw).not.toContain("full/");
    expect(JSON.parse(raw).items.every((i: Record<string, unknown>) => !("key" in i))).toBe(true);
  });

  it("carries the original filename from customMetadata", async () => {
    const id = makeId(1_700_000_004_000, "n00004");
    await (env as Env).BUCKET.put(fullKey(id, "txt"), new TextEncoder().encode("hello"), {
      httpMetadata: { contentType: "text/plain" },
      customMetadata: { hasThumb: "false", source: "pwa", uploadedAt: "x", origName: "笔记.md" },
    });
    const body = await (await handleList(listReq(), env as Env)).json<{ items: { name?: string; time?: number }[] }>();
    expect(body.items.find(i => i.time === 1_700_000_004_000)!.name).toBe("笔记.md");
  });

  it("inlines at most MAX_INLINE_SNIPPETS, leaving the rest for the client", async () => {
    // A pool that is all text must not turn one list call into `limit` reads.
    for (let i = 0; i < 25; i++) await seedText(1_700_000_100_000 + i * 1000, "line " + i);
    const body = await (await handleList(listReq("?limit=40"), env as Env)).json<{
      items: { contentType: string; snippet?: string }[];
    }>();
    const texts = body.items.filter(i => i.contentType.startsWith("text/"));
    expect(texts.length).toBe(25);
    expect(texts.filter(i => i.snippet !== undefined).length).toBe(20);
  });
});
