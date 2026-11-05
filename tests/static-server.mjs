import { createServer } from "node:http";
import { existsSync, statSync, createReadStream } from "node:fs";
import { extname, join, resolve, sep } from "node:path";

const root = resolve("out");
const port = Number(process.env.PORT || 3000);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2"
};

createServer((req, res) => {
  if (!["GET", "HEAD"].includes(req.method || "")) {
    res.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }

  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url || "/", "http://localhost").pathname); }
  catch { res.writeHead(400).end("Bad request"); return; }

  let file = resolve(root, "." + pathname);
  if (file !== root && !file.startsWith(root + sep)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file) && !extname(file) && existsSync(file + ".html")) file += ".html";
  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
    return;
  }

  res.writeHead(200, {
    "Content-Type": types[extname(file)] || "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": file.includes(sep + "_next" + sep + "static" + sep) ? "public, max-age=31536000, immutable" : "no-store"
  });
  if (req.method === "HEAD") res.end();
  else createReadStream(file).pipe(res);
}).listen(port, "127.0.0.1", () => {
  process.stdout.write("PartyHub static test server listening on " + port + "\n");
});
