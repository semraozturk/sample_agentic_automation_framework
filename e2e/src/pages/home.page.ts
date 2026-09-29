import type { Page } from "@playwright/test";

export class HomePage {
  constructor(private readonly page: Page) { }

  async open(): Promise<void> {
    await this.page.goto("/", { waitUntil: "domcontentloaded" });
  }

  problemHeading() {
    return this.page.getByRole("heading", { name: "The problem" });
  }

  howItWorksItems() {
    return this.page.locator("ol.steps > li");
  }

  async roleLabels(): Promise<string[]> {
    return this.page.locator(".role-tag").allTextContents();
  }

  limitsSection() {
    return this.page.locator("section").filter({
      has: this.page.getByRole("heading", { name: "What this is not" }),
    });
  }

  startRecordLink() {
    return this.page.getByRole("link", { name: "Start a record" });
  }

  async clickStartARecord(): Promise<void> {
    await this.startRecordLink().click();
    await this.page.waitForLoadState("domcontentloaded");
  }
}
