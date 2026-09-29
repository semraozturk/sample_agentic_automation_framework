import type { Page } from "@playwright/test";

export class StartPage {
  constructor(private readonly page: Page) { }

  async open() {
    await this.page.goto("/start.html");
  }

  async clearStorage() {
    await this.page.evaluate(() => localStorage.clear());
  }

  heading() {
    return this.page.getByRole("heading", { level: 1, name: "Start a record" });
  }

  addressField() {
    return this.page.getByTestId("field-address");
  }

  moveInField() {
    return this.page.getByTestId("field-move-in");
  }

  depositField() {
    return this.page.getByTestId("field-deposit");
  }

  submitButton() {
    return this.page.getByTestId("submit-start");
  }

  formError() {
    return this.page.getByRole("alert");
  }

  async submitEmpty() {
    await this.submitButton().click();
  }

  async fillAndSubmit(fields: {
    address: string;
    moveIn: string;
    deposit?: string;
  }) {
    await this.addressField().fill(fields.address);
    await this.moveInField().fill(fields.moveIn);
    if (fields.deposit !== undefined) {
      await this.depositField().fill(fields.deposit);
    }
    await this.submitButton().click();
  }

  /** `serve` may expose start.html as /start. */
  isStartUrl(url: string): boolean {
    return /\/start(\.html)?\/?$/i.test(new URL(url).pathname);
  }
}
