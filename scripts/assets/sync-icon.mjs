import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "../..");

const source = resolve(repoRoot, "packages/ui/assets/icon.png");
const targets = [
  resolve(repoRoot, "apps/web/public/icon.png"),
  resolve(repoRoot, "apps/admin/public/icon.png"),
];

if (!existsSync(source)) {
  console.error(`[sync-icon] Source icon not found: ${source}`);
  process.exit(1);
}

for (const target of targets) {
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  console.log(`[sync-icon] Copied icon to ${target}`);
}
