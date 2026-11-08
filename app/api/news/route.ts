import { fetchOfficialNews } from "@/lib/news";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const key = new Request(new URL("/__soso-official-news-v1", request.url).toString());
  const cache = typeof caches !== "undefined" ? (caches as unknown as { default?: Cache }).default : undefined;
  try {
    const cached = await cache?.match(key);
    if (cached) return new Response(cached.body, { status: 200, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
  } catch { /* Cache is optional in local previews. */ }

  const result = await fetchOfficialNews();
  const response = Response.json(result, { headers: { "Cache-Control": "public, max-age=900" } });
  try { await cache?.put(key, response.clone()); } catch { /* News still works without edge caching. */ }
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
