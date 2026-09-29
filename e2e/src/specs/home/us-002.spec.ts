import { expect } from "@playwright/test";
import { test } from "../../fixtures/paper-trail";
import { START_REQUIRED_ERROR } from "../../business/start-copy";
import { LogPage } from "../../pages/log.page";
import { StartPage } from "../../pages/start.page";

/** Shape declared in .quality/data/us-002.data.json. */
type Tenancy = { address: string; moveIn: string; deposit?: string };

test.describe("US-002 Start form captures the tenancy", () => {
  test.beforeEach(async ({ page }) => {
    const start = new StartPage(page);
    await start.open();
    await start.clearStorage();
    await start.open();
  });

  test("TC-01: US-002-AC-1 Start form shows address, move-in, and deposit fields", async ({
    page,
  }) => {
    const start = new StartPage(page);
    await expect(start.addressField()).toBeVisible();
    await expect(start.moveInField()).toBeVisible();
    await expect(start.depositField()).toBeVisible();
  });

  test("TC-02: US-002-AC-2 Empty required fields show one error and stay on start", async ({
    page,
  }) => {
    const start = new StartPage(page);
    await test.step("Submit without required fields", () => start.submitEmpty());
    await expect(start.formError()).toHaveText(START_REQUIRED_ERROR);
    expect(start.isStartUrl(page.url())).toBeTruthy();
  });

  test("TC-03: US-002-AC-3 Valid submit opens log with address as heading", async ({
    page,
    data,
  }) => {
    const start = new StartPage(page);
    const log = new LogPage(page);
    const tenancy = data<Tenancy>("DS-us-002-03");
    await test.step("Fill and submit start form", () =>
      start.fillAndSubmit({ address: tenancy.address, moveIn: tenancy.moveIn }));
    await expect(log.heading()).toHaveText(tenancy.address);
  });

  test("TC-04: US-002-AC-4 Tenancy summary is read-only on the log page", async ({
    page,
    data,
  }) => {
    const start = new StartPage(page);
    const log = new LogPage(page);
    const tenancy = data<Tenancy>("DS-us-002-04");
    await test.step("Create tenancy from start form", () =>
      start.fillAndSubmit({
        address: tenancy.address,
        moveIn: tenancy.moveIn,
        deposit: tenancy.deposit,
      }));
    await expect(log.tenancySummary()).toContainText(tenancy.address);
    await expect(log.tenancySummary()).toContainText(/read-only/i);
    await expect(log.summaryEditableControls()).toHaveCount(0);
  });
});
