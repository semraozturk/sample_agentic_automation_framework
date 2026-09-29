/**
 * DC-08 — manifests and test cases agree.
 * Catches the two drifts that make a manifest lie: a dataset pointing at a TC
 * that no longer exists, and a TC that promises data nobody declared.
 */
import { declaresNoData, testCasesPath } from "../testcases.mjs";
import { rel } from "../manifest.mjs";

export default {
  id: "DC-08",
  title: "Manifest and test cases agree",
  severity: "warn",
  appliesTo: () => true,

  async run(dataset, ctx) {
    const findings = [];
    const suite = ctx.testCasesFor(dataset.story);

    if (!suite) {
      return [
        {
          message: `no test cases at ${rel(testCasesPath(dataset.story))} — run /test-case for this story`,
        },
      ];
    }

    for (const tc of dataset.usedBy) {
      const row = suite.rows.get(tc);
      if (!row) {
        findings.push({
          message: `usedBy names ${tc}, which is not in ${suite.file}`,
          remediation: "fix usedBy or reopen the story and add the TC",
        });
        continue;
      }
      if (declaresNoData(row.testData)) {
        findings.push({
          message: `${tc} declares Test Data "none" but a dataset is bound to it`,
        });
      }
    }

    for (const ac of dataset.traces ?? []) {
      const tracedByAnyTc = dataset.usedBy.some((tc) =>
        (suite.rows.get(tc)?.tracesTo ?? "").includes(ac)
      );
      if (!tracedByAnyTc) {
        findings.push({
          message: `traces ${ac}, but none of ${dataset.usedBy.join(", ")} trace to it in ${suite.file}`,
        });
      }
    }

    return findings;
  },

  /**
   * Story-level pass: TCs that promise data but have no dataset. Run once per
   * story rather than once per dataset, so the finding is not repeated.
   */
  async runForStory(story, datasets, ctx) {
    const suite = ctx.testCasesFor(story);
    if (!suite) return [];
    const covered = new Set(datasets.flatMap((d) => d.usedBy ?? []));
    const findings = [];
    for (const row of suite.rows.values()) {
      if (declaresNoData(row.testData)) continue;
      if (covered.has(row.tc)) continue;
      findings.push({
        message: `${row.tc} declares Test Data "${row.testData}" but no dataset covers it`,
        remediation: `add a dataset to .quality/data/${story}.data.json with usedBy ["${row.tc}"]`,
      });
    }
    return findings;
  },
};
