/**
 * Server statico della dashboard web.
 *
 * È deliberatamente separato dai Thing: la dashboard è un client come un
 * altro, non fa parte del modello WoT. Serve solo i file di src/dashboard/
 * (copiati in dist/dashboard/ dallo script postbuild) e le immagini.
 */

import { createServer, Server } from "http";
import { readFile } from "fs/promises";
import { extname, join, normalize } from "path";

/**
 * Percorsi "puliti" della dashboard mappati sui file che li servono.
 *
 * /temperature e /humidity puntano allo stesso documento: metric.html si
 * configura dal pathname, invece di esistere in due copie quasi identiche.
 */
const ROUTES: Record<string, string> = {
  "/": "index.html",
  "/dashboard": "dashboard.html",
  "/temperature": "metric.html",
  "/humidity": "metric.html",
  "/pump": "pump.html",
};

/** Asset serviti direttamente dalla cartella della dashboard. */
const ASSETS = new Set(["/style.css", "/app.js"]);

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/**
 * Risolve un pathname della richiesta nel file da servire, relativo a __dirname.
 * Restituisce null se il path non è riconosciuto o tenta di uscire dalle
 * directory consentite (path traversal).
 */
function resolveFile(pathname: string): string | null {
  // Rotta pulita (es. /temperature) oppure stesso nome con estensione.
  const route = ROUTES[pathname] ?? ROUTES[pathname.replace(/\.html$/, "")];
  if (route) {
    return join(__dirname, "dashboard", route);
  }

  // Asset serviti direttamente: foglio di stile, script condiviso e immagini.
  if (ASSETS.has(pathname)) {
    return join(__dirname, "dashboard", pathname.slice(1));
  }
  if (pathname.startsWith("/img/")) {
    const candidate = normalize(join(__dirname, pathname));
    // normalize() risolve gli eventuali "..": se il risultato esce da img/, rifiuta.
    return candidate.startsWith(join(__dirname, "img")) ? candidate : null;
  }

  return null;
}

/** Avvia il server della dashboard sulla porta indicata. */
export function startDashboardServer(port: number): Server {
  const server = createServer(async (req, res) => {
    const pathname = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`)
      .pathname;
    const filePath = resolveFile(pathname);

    if (!filePath) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Risorsa non trovata");
      return;
    }

    try {
      const content = await readFile(filePath);
      const contentType = CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream";
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content);
    } catch (error) {
      console.error(`[DASHBOARD] Impossibile leggere ${filePath}:`, error);
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Errore nel caricamento della risorsa");
    }
  });

  server.listen(port, () => {
    console.log(`[DASHBOARD] Attiva su http://localhost:${port}/`);
  });

  return server;
}
