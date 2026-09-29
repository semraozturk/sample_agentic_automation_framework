import type { TestInfo } from "@playwright/test";

const AC_RE = /(US-\d+-AC-\d+)/;
const STORY_RE = /(US-\d+)/;

/** Push issue + AC annotations for the HTML report from the standard TC title shape. */
export function annotateTraceability(
  info: TestInfo,
  opts: { issueUrl?: string; issueNumber?: number }
): void {
  const ac = info.title.match(AC_RE)?.[1];
  const story = info.title.match(STORY_RE)?.[1];
  if (story) {
    info.annotations.push({ type: "story", description: story });
  }
  if (ac) {
    info.annotations.push({ type: "ac", description: ac });
  }
  if (opts.issueNumber != null && opts.issueUrl) {
    info.annotations.push({
      type: "issue",
      description: `#${opts.issueNumber} — ${opts.issueUrl}`,
    });
  }
}
