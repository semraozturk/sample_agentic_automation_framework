/** Verdict precedence and the exit-code contract. */

export const VERDICTS = ["READY", "DEGRADED", "INVALID", "EXHAUSTED", "UNREACHABLE"];

const RANK = new Map(VERDICTS.map((v, i) => [v, i]));

export const BLOCKING = new Set(["INVALID", "EXHAUSTED", "UNREACHABLE"]);

/** The worst verdict wins: UNREACHABLE > EXHAUSTED > INVALID > DEGRADED > READY. */
export function worst(a, b) {
  return (RANK.get(a) ?? 0) >= (RANK.get(b) ?? 0) ? a : b;
}

/** A finding's verdict hint, else derived from its severity. */
export function verdictForFinding(finding) {
  if (finding.verdict) return finding.verdict;
  return finding.severity === "warn" ? "DEGRADED" : "INVALID";
}

export function verdictFor(findings) {
  return findings.reduce((acc, f) => worst(acc, verdictForFinding(f)), "READY");
}

/** 0 ready, 1 blocking, 2 degraded only. */
export function exitCodeFor(verdict, { strict = false } = {}) {
  if (BLOCKING.has(verdict)) return 1;
  if (verdict === "DEGRADED") return strict ? 1 : 2;
  return 0;
}
