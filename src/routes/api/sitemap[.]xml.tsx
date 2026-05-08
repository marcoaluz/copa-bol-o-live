import { createFileRoute } from "@tanstack/react-router";

const STATIC_PATHS = ["/", "/home", "/chaveamento", "/grupos", "/ranking", "/ajuda"];

export const Route = createFileRoute("/api/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const today = new Date().toISOString().split("T")[0];
        const urls = STATIC_PATHS.map(
          (p) => `  <url><loc>${origin}${p}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq></url>`,
        ).join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
        return new Response(xml, {
          headers: { "Content-Type": "application/xml; charset=utf-8" },
        });
      },
    },
  },
});
