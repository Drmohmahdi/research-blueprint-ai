// خادم ملفات ثابتة بلا أي تبعيات خارجية لتقديم بناء React (dist/) في
// الإنتاج — بديل عن حزمة serve لتفادي ثغرة DoS في تبعياتها الفرعية
// (brace-expansion عبر minimatch/serve-handler). يدعم SPA fallback
// (أي مسار غير موجود كملف يعيد index.html) لأن React Router يتولى
// التوجيه على جهة العميل.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";

const DIST_DIR = join(import.meta.dirname, "..", "dist");
const PORT = Number(process.env.PORT || 3004);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

const server = createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const safePath = normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
    let filePath = join(DIST_DIR, safePath);

    let fileStat = await stat(filePath).catch(() => null);
    if (!fileStat || fileStat.isDirectory()) {
      filePath = join(DIST_DIR, "index.html");
      fileStat = await stat(filePath).catch(() => null);
    }
    if (!fileStat) {
      res.writeHead(404).end("Not found");
      return;
    }

    const body = await readFile(filePath);
    const contentType = MIME_TYPES[extname(filePath)] || "application/octet-stream";
    const isImmutableAsset = safePath.startsWith("/assets/");
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": isImmutableAsset ? "public, max-age=31536000, immutable" : "no-cache",
    });
    res.end(body);
  } catch (err) {
    res.writeHead(500).end("Internal server error");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Research Blueprint AI frontend serving dist/ at http://0.0.0.0:${PORT}`);
});
