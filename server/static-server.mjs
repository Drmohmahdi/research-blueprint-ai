// خادم ملفات ثابتة بلا أي تبعيات خارجية لتقديم بناء React (dist/) في
// الإنتاج — بديل عن حزمة serve لتفادي ثغرة DoS في تبعياتها الفرعية
// (brace-expansion عبر minimatch/serve-handler). يدعم SPA fallback
// (أي مسار غير موجود كملف يعيد index.html) لأن React Router يتولى
// التوجيه على جهة العميل.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { randomUUID, createHash } from "node:crypto";

const DIST_DIR = join(import.meta.dirname, "..", "dist");
const GATE_HTML_PATH = join(import.meta.dirname, "gate.html");
const PORT = Number(process.env.PORT || 3004);
const API_ORIGIN = process.env.FRONTEND_API_ORIGIN || "'self'";

// Temporary development-only access gate, mirroring backend/app/services/site_gate.py.
// Both sides must hash the same way so a single successful login (which sets
// the baseerah_gate cookie via the backend's /api/site-gate/verify) unlocks
// both the compiled SPA bundle here and the API. Disabled when unset.
const SITE_GATE_PASSWORD = process.env.SITE_GATE_PASSWORD || "";
const GATE_COOKIE_NAME = "baseerah_gate";
const GATE_TOKEN = SITE_GATE_PASSWORD
  ? createHash("sha256").update(`baseerah-site-gate:${SITE_GATE_PASSWORD}`).digest("hex")
  : null;
let gateHtmlCache = null;

function getCookie(req, name) {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return decodeURIComponent(part.slice(idx + 1).trim());
  }
  return null;
}

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
  const requestId = /^[0-9a-f-]{36}$/i.test(req.headers["x-request-id"] || "")
    ? req.headers["x-request-id"]
    : randomUUID();
  const securityHeaders = {
    "X-Request-ID": requestId,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' ${API_ORIGIN}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
  };
  if (process.env.NODE_ENV === "production") {
    securityHeaders["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  }
  try {
    if (GATE_TOKEN && getCookie(req, GATE_COOKIE_NAME) !== GATE_TOKEN) {
      if (gateHtmlCache === null) {
        gateHtmlCache = await readFile(GATE_HTML_PATH).catch(() => Buffer.from("Site locked."));
      }
      res.writeHead(200, {
        ...securityHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        // This static, self-authored page has no user-generated content or
        // XSS surface, so its inline <script>/<style> are allowed here only —
        // the real SPA below keeps the strict script-src 'self' policy.
        "Content-Security-Policy": `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ${API_ORIGIN}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
      });
      res.end(gateHtmlCache);
      return;
    }

    const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const safePath = normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
    let filePath = join(DIST_DIR, safePath);

    let fileStat = await stat(filePath).catch(() => null);
    if (!fileStat || fileStat.isDirectory()) {
      filePath = join(DIST_DIR, "index.html");
      fileStat = await stat(filePath).catch(() => null);
    }
    if (!fileStat) {
      res.writeHead(404, securityHeaders).end("Not found");
      return;
    }

    const body = await readFile(filePath);
    const contentType = MIME_TYPES[extname(filePath)] || "application/octet-stream";
    const isImmutableAsset = safePath.startsWith("/assets/");
    res.writeHead(200, {
      ...securityHeaders,
      "Content-Type": contentType,
      "Cache-Control": isImmutableAsset ? "public, max-age=31536000, immutable" : "no-cache",
    });
    res.end(body);
  } catch {
    res.writeHead(500, securityHeaders).end("Internal server error");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Research Blueprint AI frontend serving dist/ at http://0.0.0.0:${PORT}`);
});
