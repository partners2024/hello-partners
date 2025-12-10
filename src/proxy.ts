export async function handleProxy(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const target = url.searchParams.get("url");

  if (!target) {
    return new Response("Missing ?url=", { status: 400 });
  }

  const resp = await fetch(target, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });

  const body = await resp.arrayBuffer();
  const headers = new Headers(resp.headers);

  // ลบ header ที่บล็อก iframe
  const blockList = [
    "x-frame-options",
    "frame-options",
    "content-security-policy",
    "content-security-policy-report-only"
  ];

  blockList.forEach(h => headers.delete(h));

  // อนุญาตให้ iframe โหลด
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Cross-Origin-Resource-Policy", "cross-origin");
  headers.set("Cross-Origin-Embedder-Policy", "unsafe-none");
  headers.set("Cross-Origin-Opener-Policy", "unsafe-none");

  return new Response(body, {
    status: resp.status,
    headers
  });
}
