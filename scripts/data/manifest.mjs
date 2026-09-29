/**
 * Discover, load, and structurally validate test-data manifests.
 * Structural findings are reported under check id DC-00.
 * Contract: docs/test-data-contract.md
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FIELD_TYPES } from "./values.mjs";

export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);
export const MANIFEST_DIR = path.join(REPO_ROOT, ".quality", "data");

const LIFECYCLES = ["reusable", "mutating", "one-time-use"];
const SOURCE_KINDS = ["static", "generated", "api", "db", "env"];
const DATASET_ID_RE = /^DS-[a-z0-9-]+-\d{2}$/;
const TC_ID_RE = /^TC-\d{2}$/;
const AC_ID_RE = /^US-\d{3}-AC-\d+$/;

const SOURCE_KEYS = {
  static: { required: [], optional: [] },
  generated: { required: ["generator", "count"], optional: [] },
  api: { required: ["baseUrl", "path"], optional: ["method", "body", "collection"] },
  db: { required: ["connection", "table", "key"], optional: ["where"] },
  env: { required: ["vars"], optional: [] },
};

export function rel(absPath) {
  return path.relative(REPO_ROOT, absPath).split(path.sep).join("/");
}

/** All manifest files, or just the ones for `story`. */
export function discoverManifests({ story = null, manifestPaths = [] } = {}) {
  if (manifestPaths.length > 0) {
    return manifestPaths.map((p) => path.resolve(REPO_ROOT, p));
  }
  if (!fs.existsSync(MANIFEST_DIR)) return [];
  const files = fs
    .readdirSync(MANIFEST_DIR)
    .filter((name) => name.endsWith(".data.json"))
    .sort()
    .map((name) => path.join(MANIFEST_DIR, name));
  if (!story) return files;
  return files.filter((f) => path.basename(f) === `${story}.data.json`);
}

function finding(datasetId, message, extra = {}) {
  return {
    check: "DC-00",
    datasetId,
    severity: "error",
    verdict: "INVALID",
    message,
    ...extra,
  };
}

function validateField(datasetId, name, spec) {
  const out = [];
  const where = `fields.${name}`;
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
    out.push(finding(datasetId, `${where} must be an object`));
    return out;
  }
  if (!FIELD_TYPES.includes(spec.type)) {
    out.push(
      finding(
        datasetId,
        `${where}.type ${JSON.stringify(spec.type)} is not one of ${FIELD_TYPES.join(", ")}`
      )
    );
  }
  if (spec.type === "enum" && !Array.isArray(spec.values)) {
    out.push(finding(datasetId, `${where} is an enum, so values is required`));
  }
  if (spec.minLength !== undefined && spec.maxLength !== undefined) {
    if (spec.minLength > spec.maxLength) {
      out.push(finding(datasetId, `${where}.minLength is greater than maxLength`));
    }
  }
  if (spec.min !== undefined && spec.max !== undefined && spec.min > spec.max) {
    out.push(finding(datasetId, `${where}.min is greater than max`));
  }
  return out;
}

function validateSource(datasetId, source) {
  const out = [];
  if (!source || typeof source !== "object") {
    out.push(finding(datasetId, "source is required and must be an object"));
    return out;
  }
  if (!SOURCE_KINDS.includes(source.kind)) {
    out.push(
      finding(
        datasetId,
        `source.kind ${JSON.stringify(source.kind)} is not one of ${SOURCE_KINDS.join(", ")}`
      )
    );
    return out;
  }
  const { required, optional } = SOURCE_KEYS[source.kind];
  for (const key of required) {
    if (source[key] === undefined) {
      out.push(finding(datasetId, `source.${key} is required for kind ${source.kind}`));
    }
  }
  const allowed = new Set(["kind", ...required, ...optional]);
  for (const key of Object.keys(source)) {
    if (!allowed.has(key)) {
      out.push(finding(datasetId, `source.${key} is not valid for kind ${source.kind}`));
    }
  }
  if (source.kind === "db" && typeof source.where === "string") {
    if (source.where.includes(";")) {
      out.push(finding(datasetId, "source.where must not contain a semicolon"));
    }
  }
  if (source.kind === "db" && typeof source.table === "string") {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(source.table)) {
      out.push(finding(datasetId, `source.table ${source.table} is not a plain identifier`));
    }
  }
  return out;
}

function validateDataset(dataset, story, index) {
  const out = [];
  const id = dataset?.id ?? `datasets[${index}]`;

  if (!dataset || typeof dataset !== "object" || Array.isArray(dataset)) {
    return [finding(id, "dataset must be an object")];
  }
  if (!DATASET_ID_RE.test(dataset.id ?? "")) {
    out.push(finding(id, `id must match DS-<slug>-NN, got ${JSON.stringify(dataset.id)}`));
  } else if (!dataset.id.startsWith(`DS-${story}-`)) {
    out.push(finding(id, `id does not carry this manifest's story slug ${story}`));
  }

  if (!Array.isArray(dataset.usedBy) || dataset.usedBy.length === 0) {
    out.push(finding(id, "usedBy must list at least one TC id"));
  } else {
    for (const tc of dataset.usedBy) {
      if (!TC_ID_RE.test(tc)) out.push(finding(id, `usedBy entry ${tc} must match TC-NN`));
    }
  }

  for (const ac of dataset.traces ?? []) {
    if (!AC_ID_RE.test(ac)) out.push(finding(id, `traces entry ${ac} must match US-NNN-AC-N`));
  }

  if (typeof dataset.entity !== "string" || dataset.entity.trim() === "") {
    out.push(finding(id, "entity is required"));
  }
  if (!LIFECYCLES.includes(dataset.lifecycle)) {
    out.push(
      finding(
        id,
        `lifecycle ${JSON.stringify(dataset.lifecycle)} is not one of ${LIFECYCLES.join(", ")}`
      )
    );
  }

  out.push(...validateSource(id, dataset.source));

  if (!dataset.fields || typeof dataset.fields !== "object" || Array.isArray(dataset.fields)) {
    out.push(finding(id, "fields is required and must be an object"));
  } else {
    if (Object.keys(dataset.fields).length === 0) {
      out.push(finding(id, "fields must declare at least one field"));
    }
    for (const [name, spec] of Object.entries(dataset.fields)) {
      out.push(...validateField(id, name, spec));
    }
  }

  const kind = dataset.source?.kind;
  if (kind === "static") {
    if (!Array.isArray(dataset.records) || dataset.records.length === 0) {
      out.push(finding(id, "source kind static requires a non-empty records array"));
    }
  } else if (dataset.records !== undefined) {
    out.push(finding(id, `records is only valid for source kind static, not ${kind}`));
  }

  if (dataset.lifecycle === "one-time-use") {
    if (!Number.isInteger(dataset.demandPerRun) || dataset.demandPerRun < 1) {
      out.push(finding(id, "lifecycle one-time-use requires demandPerRun >= 1"));
    }
    if (kind === "static") {
      out.push(
        finding(
          id,
          "lifecycle one-time-use cannot use source kind static — inline records cannot be leased"
        )
      );
    }
  }
  if (dataset.lifecycle === "mutating") {
    if (typeof dataset.teardown !== "string" || dataset.teardown.trim() === "") {
      out.push(finding(id, "lifecycle mutating requires a teardown description"));
    }
  }
  for (const parent of dataset.dependsOn ?? []) {
    if (!DATASET_ID_RE.test(parent)) {
      out.push(finding(id, `dependsOn entry ${parent} must match DS-<slug>-NN`));
    }
  }

  return out;
}

/** Read one manifest file. Never throws — parse errors come back as findings. */
export function loadManifest(file) {
  const relPath = rel(file);
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch (err) {
    return {
      file: relPath,
      story: null,
      datasets: [],
      hash: null,
      findings: [finding(null, `cannot read manifest: ${err.message}`)],
    };
  }

  const hash = crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      file: relPath,
      story: null,
      datasets: [],
      hash,
      findings: [finding(null, `manifest is not valid JSON: ${err.message}`)],
    };
  }

  const findings = [];
  if (parsed.version !== 1) {
    findings.push(finding(null, `version must be 1, got ${JSON.stringify(parsed.version)}`));
  }
  const story = typeof parsed.story === "string" ? parsed.story : null;
  if (!story || !/^[a-z0-9][a-z0-9-]*$/.test(story)) {
    findings.push(finding(null, `story must be a lowercase slug, got ${JSON.stringify(parsed.story)}`));
  } else {
    const expected = `${story}.data.json`;
    if (path.basename(file) !== expected) {
      findings.push(finding(null, `story ${story} does not match file name (expected ${expected})`));
    }
  }
  if (!Array.isArray(parsed.datasets) || parsed.datasets.length === 0) {
    findings.push(finding(null, "datasets must be a non-empty array"));
    return { file: relPath, story, datasets: [], hash, findings };
  }

  const seen = new Set();
  parsed.datasets.forEach((dataset, index) => {
    findings.push(...validateDataset(dataset, story, index));
    if (dataset?.id) {
      if (seen.has(dataset.id)) {
        findings.push(finding(dataset.id, "duplicate dataset id in this manifest"));
      }
      seen.add(dataset.id);
    }
  });

  const datasets = parsed.datasets
    .filter((d) => d && typeof d === "object" && DATASET_ID_RE.test(d.id ?? ""))
    .map((d) => ({ ...d, manifestFile: relPath, manifestHash: hash, story }));

  return { file: relPath, story, datasets, hash, findings };
}

/** Every dataset in scope, plus manifest-level findings. */
export function loadManifests({ story = null, manifestPaths = [], tcs = [] } = {}) {
  const files = discoverManifests({ story, manifestPaths });
  const manifests = files.map(loadManifest);
  let datasets = manifests.flatMap((m) => m.datasets);
  if (tcs.length > 0) {
    const wanted = new Set(tcs.map((t) => t.toUpperCase()));
    datasets = datasets.filter((d) => (d.usedBy ?? []).some((tc) => wanted.has(tc.toUpperCase())));
  }
  const findings = manifests.flatMap((m) =>
    m.findings.map((f) => ({ ...f, manifestFile: m.file, story: m.story }))
  );
  return { files: files.map(rel), manifests, datasets, findings };
}
