/**
 * Parse the TC tables in .quality/<slug>/test-cases.md.
 * Used by DC-08 to prove manifests and test cases agree.
 */
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./manifest.mjs";

const NO_DATA = new Set(["", "none", "n/a", "na", "-", "—"]);

function splitRow(line) {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function isSeparator(cells) {
  return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));
}

/** True when a TC's Test Data cell promises no data at all. */
export function declaresNoData(testData) {
  return NO_DATA.has((testData ?? "").toLowerCase().trim());
}

export function testCasesPath(story) {
  return path.join(REPO_ROOT, ".quality", story, "test-cases.md");
}

/**
 * Story slugs that have test cases, whether or not they have a manifest.
 * A story with data-bearing TCs and no manifest is exactly the gap DC-08 has
 * to report, so it cannot be discovered from manifests alone.
 */
export function discoverStoriesWithTestCases() {
  const root = path.join(REPO_ROOT, ".quality");
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "runs" && entry.name !== "data")
    .map((entry) => entry.name)
    .filter((slug) => fs.existsSync(testCasesPath(slug)))
    .sort();
}

/**
 * Returns `null` when the story has no test-cases.md yet, so callers can tell
 * "no test cases written" apart from "test cases with no data".
 */
export function loadTestCases(story) {
  const file = testCasesPath(story);
  if (!fs.existsSync(file)) return null;

  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  const rows = new Map();
  let header = null;

  for (const line of lines) {
    if (!line.trim().startsWith("|")) {
      header = null;
      continue;
    }
    const cells = splitRow(line);
    if (isSeparator(cells)) continue;
    if (!header) {
      if (cells.includes("TC") && cells.includes("Test Data")) header = cells;
      continue;
    }
    const row = {};
    header.forEach((name, i) => {
      row[name] = cells[i] ?? "";
    });
    const tc = (row.TC ?? "").toUpperCase();
    if (!/^TC-\d{2}$/.test(tc)) continue;
    rows.set(tc, {
      tc,
      title: row.Title ?? "",
      testData: row["Test Data"] ?? "",
      tracesTo: row["Traces To"] ?? "",
      automation: row.Automation ?? "",
    });
  }

  return { file: path.relative(REPO_ROOT, file).split(path.sep).join("/"), rows };
}
