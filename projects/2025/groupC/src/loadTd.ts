import * as fs from "node:fs";
import * as path from "node:path";

// Funzione per caricare le Thing Descriptions dal file system.
export function loadTdJson(filename: string) {
  const p = path.join(process.cwd(), "models", filename);
  const raw = fs.readFileSync(p, "utf-8");
  return JSON.parse(raw);
}
