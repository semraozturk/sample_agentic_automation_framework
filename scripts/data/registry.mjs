/**
 * Adapter and check registries.
 * Both load by reading their folder, so adding a source kind or a rule means
 * dropping in a file — the runner needs no edit.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ADAPTER_DIR = path.join(HERE, "adapters");
const CHECK_DIR = path.join(HERE, "checks");

async function importAll(dir, pattern) {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((name) => pattern.test(name)).sort();
  const loaded = [];
  for (const name of files) {
    loaded.push({ name, module: await import(pathToFileURL(path.join(dir, name)).href) });
  }
  return loaded;
}

export async function loadAdapters() {
  const adapters = new Map();
  for (const { name, module } of await importAll(ADAPTER_DIR, /\.mjs$/)) {
    if (!module.kind) throw new Error(`adapter ${name} does not export a kind`);
    for (const fn of ["probe", "describe", "fetch", "count", "lease", "release"]) {
      if (typeof module[fn] !== "function") {
        throw new Error(`adapter ${name} is missing ${fn}()`);
      }
    }
    adapters.set(module.kind, module);
  }
  return adapters;
}

export async function loadChecks() {
  const checks = [];
  for (const { name, module } of await importAll(CHECK_DIR, /^dc-\d+.*\.mjs$/)) {
    const check = module.default;
    if (!check?.id || typeof check.run !== "function") {
      throw new Error(`check ${name} must default-export { id, run }`);
    }
    checks.push(check);
  }
  return checks.sort((a, b) => a.id.localeCompare(b.id));
}
