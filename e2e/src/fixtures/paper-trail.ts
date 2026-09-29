import { test as base } from "@playwright/test";
import path from "node:path";
import { captureEvidence } from "../helpers/evidence";
import { createDataAccessor, type DataAccessor } from "../helpers/test-data";
import { annotateTraceability } from "../helpers/traceability";

const ISSUE_BY_SLUG: Record<string, { issue: number; url: string }> = {
  "us-001": {
    issue: 2,
    url: "https://github.com/semraozturk/sample_agentic_automation_framework/issues/2",
  },
  "us-002": {
    issue: 4,
    url: "https://github.com/semraozturk/sample_agentic_automation_framework/issues/4",
  },
};

function slugFromSpecPath(specPath: string | undefined): string | null {
  if (!specPath) return null;
  const base = path.basename(specPath, ".spec.ts").toLowerCase();
  return /^us-\d+$/.test(base) ? base : null;
}

export const test = base.extend<
  { paperTrailSlug: string | null; data: DataAccessor },
  { dataAccessor: DataAccessor }
>({
  paperTrailSlug: async ({}, use, testInfo) => {
    const slug = slugFromSpecPath(testInfo.file);
    await use(slug);
  },

  // Worker-scoped: the reservation is read once, and one-time-use records are
  // partitioned per worker so two tests never share one.
  dataAccessor: [
    async ({}, use, workerInfo) => {
      await use(createDataAccessor(workerInfo.workerIndex));
    },
    { scope: "worker" },
  ],

  data: async ({ dataAccessor }, use) => {
    await use(dataAccessor);
  },
});

test.beforeEach(async ({ paperTrailSlug }, testInfo) => {
  if (!paperTrailSlug) return;
  const row = ISSUE_BY_SLUG[paperTrailSlug];
  annotateTraceability(testInfo, {
    issueNumber: row?.issue,
    issueUrl: row?.url,
  });
});

test.afterEach(async ({ page, paperTrailSlug }, testInfo) => {
  if (!paperTrailSlug || testInfo.status !== "passed") return;
  const tc = testInfo.title.match(/^(TC-\d+)/)?.[1];
  if (!tc) return;
  const evidenceNames: Record<string, Record<string, string>> = {
    "us-002": {
      "TC-01": "TC-01-start-fields",
      "TC-02": "TC-02-empty-submit",
      "TC-03": "TC-03-log-heading",
      "TC-04": "TC-04-read-only-summary",
    },
  };
  const fileStem = evidenceNames[paperTrailSlug]?.[tc] ?? tc;
  await captureEvidence(page, testInfo, paperTrailSlug, fileStem);
});
