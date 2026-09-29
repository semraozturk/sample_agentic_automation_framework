import fs from "node:fs";
import path from "node:path";
import type { Page, TestInfo } from "@playwright/test";

/** Save a full-page PNG under `.quality/<slug>/screenshots/` (Playwright cwd is `e2e/`). */
export async function captureEvidence(
  page: Page,
  info: TestInfo,
  slug: string,
  fileStem?: string
): Promise<void> {
  const tc = info.title.match(/^(TC-\d+)/)?.[1] ?? "shot";
  const stem = fileStem ?? tc;
  const dir = path.resolve(process.cwd(), "..", ".quality", slug, "screenshots");
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, `${stem}.png`);
  await page.screenshot({ path: dest, fullPage: true });
}
