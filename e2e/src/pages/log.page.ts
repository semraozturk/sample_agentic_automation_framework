import type { Page } from "@playwright/test";

export class LogPage {
  constructor(private readonly page: Page) { }

  heading() {
    return this.page.getByTestId("tenancy-heading");
  }

  tenancySummary() {
    return this.page.getByTestId("tenancy-summary");
  }

  summaryEditableControls() {
    return this.tenancySummary().locator("input, textarea, select, button");
  }

  isLogUrl(url: string): boolean {
    return /\/log(\.html)?\/?$/i.test(new URL(url).pathname);
  }
}
