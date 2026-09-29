import type { Page } from "@playwright/test";

/** True when the document is wider than the viewport (sideways scroll). */
export async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  const metrics = await page.evaluate(() => {
    const el = document.documentElement;
    return { clientWidth: el.clientWidth, scrollWidth: el.scrollWidth };
  });
  return metrics.scrollWidth > metrics.clientWidth + 1;
}
