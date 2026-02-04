import * as fs from "node:fs";
import * as path from "node:path";

export function loadTdJson(filename: string) {
  const p = path.join(process.cwd(), "models", filename);
  const raw = fs.readFileSync(p, "utf-8");
  return JSON.parse(raw);
}
