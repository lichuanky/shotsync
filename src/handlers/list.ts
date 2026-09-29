import { Env, err, json } from "../responses";
import { canRead } from "../auth";
import { epochMsFromId, idFromFullKey } from "../ids";

// How many text previews one list call will read inline. Bounded on purpose: a
// pool that is entirely text would otherwise turn a single list request into
// `limit` object reads. Past this cap the client falls back to fetching the
// rest lazily — the pre-existing behaviour — so nothing breaks; items far down
// a text-heavy pool are just as slow as they were before.
const MAX_INLINE_SNIPPETS = 20;

// Matches the truncation the gallery already applied client-side, so moving the
// work server-side does not change what a card displays.
const SNIPPET_CHARS = 140;

export async function handleList(request: Request, env: Env): Promise<Response> {
  if (!canRead(request, env)) return err(401, "unauthorized");

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);
  const cursor = url.searchParams.get("cursor") || undefined;

  // `include` is missing from R2ListOptions in @cloudflare/workers-types ^4.0.0,
  // so assert the options to an extended type. The arg stays assignable to
  // R2ListOptions, so the R2Objects return type is preserved (unlike `as any`).
  const res = await env.BUCKET.list({
    prefix: "full/",
    limit,
    cursor,
    include: ["customMetadata", "httpMetadata"],
  } as R2ListOptions & { include: ("httpMetadata" | "customMetadata")[] });

  const items = res.objects.map((o) => {
    const id = idFromFullKey(o.key);
    return {
      id,
      key: o.key,
      time: epochMsFromId(id),
      contentType: o.httpMetadata?.contentType || "application/octet-stream",
      hasThumb: o.customMetadata?.hasThumb === "true",
      source: o.customMetadata?.source || "unknown",
      name: o.customMetadata?.origName || "",
    };
  });

  // Text previews ride along with the list rather than costing one browser
  // round-trip each.
  //
  // Measured against the live demo pool before this change: the list resolved
  // at 1.8s, and the four text cards then fired four sequential /i/<id>
  // fetches that did not finish until 3.6s — so a first-time visitor spent
  // ~1.8s looking at four cards that said nothing but "…". These reads are
  // Worker->R2 in the same region and cost milliseconds, whereas the fetches
  // they replace crossed the network from wherever the visitor happens to be.
  const textItems = items.filter((i) => i.contentType.startsWith("text/"));
  await Promise.all(
    textItems.slice(0, MAX_INLINE_SNIPPETS).map(async (item) => {
      try {
        const obj = await env.BUCKET.get(item.key);
        if (!obj) return;
        (item as { snippet?: string }).snippet = (await obj.text()).slice(0, SNIPPET_CHARS);
      } catch {
        // Leave snippet unset: the client still lazy-fetches anything without
        // one, so a failed read here degrades to the previous behaviour rather
        // than to an empty card.
      }
    })
  );

  // `key` is an internal R2 path; it exists only to fetch the snippet above
  // and must not leak into the response the client caches.
  const payload = items.map(({ key: _key, ...rest }) => rest);

  return json({ items: payload, cursor: res.truncated ? res.cursor : null });
}
