/** Writers for data-readiness.json and data-readiness.md. */
import fs from "node:fs";
import path from "node:path";
import { BLOCKING } from "./verdict.mjs";

const VERDICT_MARK = {
  READY: "READY",
  DEGRADED: "DEGRADED",
  EXHAUSTED: "EXHAUSTED",
  UNREACHABLE: "UNREACHABLE",
  INVALID: "INVALID",
};

function cell(text) {
  return String(text ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function locate(finding) {
  const parts = [];
  if (finding.field) parts.push(`\`${finding.field}\``);
  if (finding.recordIndex !== undefined && finding.recordIndex !== null) {
    parts.push(`record ${finding.recordIndex}`);
  }
  return parts.join(" ") || "—";
}

export function renderMarkdown(report) {
  const lines = [];
  lines.push(`# Data readiness — ${report.runId}`, "");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Scope: ${report.scope.description}`);
  lines.push(`Command: \`${report.command}\``);
  lines.push(`Verdict: **${VERDICT_MARK[report.verdict]}** (exit ${report.exitCode})`, "");

  if (report.datasets.length === 0) {
    lines.push("No datasets in scope.", "");
  } else {
    lines.push("## Datasets", "");
    lines.push("| Dataset | Story | TCs | Entity | Lifecycle | Source | Records | Available | Checked | Verdict |");
    lines.push("|---------|-------|-----|--------|-----------|--------|---------|-----------|---------|---------|");
    for (const d of report.datasets) {
      lines.push(
        `| ${cell(d.id)} | ${cell(d.story)} | ${cell((d.usedBy ?? []).join(", "))} | ${cell(d.entity)} | ${cell(d.lifecycle)} | ${cell(d.source)} | ${cell(d.recordCount ?? "—")} | ${cell(d.available ?? "—")} | ${cell(d.checked)} | ${cell(VERDICT_MARK[d.verdict])} |`
      );
    }
    lines.push("");
  }

  const findings = report.findings;
  if (findings.length > 0) {
    lines.push("## Findings", "");
    lines.push("| Check | Dataset | Where | Severity | Message | Remediation |");
    lines.push("|-------|---------|-------|----------|---------|-------------|");
    for (const f of findings) {
      lines.push(
        `| ${cell(f.check)} | ${cell(f.datasetId ?? f.story ?? "—")} | ${cell(locate(f))} | ${cell(f.severity)} | ${cell(f.message)} | ${cell(f.remediation ?? "—")} |`
      );
    }
    lines.push("");
  } else {
    lines.push("## Findings", "", "None — every dataset in scope is READY.", "");
  }

  const cached = report.datasets.filter((d) => d.checked === "cached").length;
  lines.push("## Checks run", "");
  if (cached > 0) {
    lines.push(
      `${cached} dataset(s) were reused from today's cache and not re-evaluated. Use \`--no-cache\` to force a live check.`,
      ""
    );
  }
  lines.push("| Check | Title | Datasets evaluated | Findings |");
  lines.push("|-------|-------|--------------------|----------|");
  for (const c of report.checks) {
    lines.push(`| ${cell(c.id)} | ${cell(c.title)} | ${c.evaluated} | ${c.findings} |`);
  }
  lines.push("");

  if (report.reservation) {
    lines.push("## Reservation", "");
    lines.push(`Leases: ${report.reservation.leaseCount}`);
    lines.push(`File: \`${report.reservation.file}\``, "");
  }

  lines.push("## Next steps", "");
  for (const step of nextSteps(report)) lines.push(`- ${step}`);
  lines.push("");

  return lines.join("\n");
}

function nextSteps(report) {
  const steps = [];
  const blocked = report.datasets.filter((d) => BLOCKING.has(d.verdict));
  if (blocked.length === 0 && report.verdict === "READY") {
    steps.push("Data is ready — run the suite (`node scripts/quality-run.mjs --all`).");
  }
  for (const d of blocked) {
    const remedies = report.findings
      .filter((f) => f.datasetId === d.id && f.remediation)
      .map((f) => f.remediation);
    steps.push(
      `${d.id} is ${d.verdict}${remedies.length ? ` — ${[...new Set(remedies)].join("; ")}` : ""}`
    );
  }
  if (report.verdict === "DEGRADED") {
    steps.push("Warnings only: the suite can run, but fix these before they become blocking.");
  }
  if (report.findings.some((f) => f.check === "DC-08")) {
    steps.push("Reconcile manifests with `.quality/<slug>/test-cases.md` (DC-08).");
  }
  return steps;
}

export function writeReports(report, runDir) {
  fs.mkdirSync(runDir, { recursive: true });
  const jsonPath = path.join(runDir, "data-readiness.json");
  const mdPath = path.join(runDir, "data-readiness.md");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2) + "\n");
  fs.writeFileSync(mdPath, renderMarkdown(report));
  return { jsonPath, mdPath };
}
