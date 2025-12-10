export async function onRequest({ request }) {
  const url = new URL(request.url);
  const target = url.searchParams.get("url");

  if (!target) {
    return new Response("Missing ?url=", { status: 400 });
  }

  const response = await fetch(target, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; x64) AppleWebKit/537.36",
    },
  });

  const newHeaders = new Headers(response.headers);
  newHeaders.delete("X-Frame-Options");
  newHeaders.delete("Content-Security-Policy");
  newHeaders.set("Cache-Control", "no-cache");

  return new Response(response.body, {
    status: response.status,
    headers: newHeaders,
  });
}
