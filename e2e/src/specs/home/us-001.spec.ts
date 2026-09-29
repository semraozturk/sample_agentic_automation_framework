import { expect } from "@playwright/test";
import { test } from "../../fixtures/paper-trail";
import { HOME_ROLES } from "../../business/home-copy";
import { hasHorizontalOverflow } from "../../helpers/overflow";
import { readStaticRecord } from "../../helpers/test-data";
import { HomePage } from "../../pages/home.page";
import { StartPage } from "../../pages/start.page";

/** test.use needs the value at collection time, before fixtures exist. */
const phone = readStaticRecord<{ width: number; height: number }>("DS-us-001-01");

test.describe("US-001 Home explains the product and roles", () => {
  test("TC-01: US-001-AC-1 Home shows problem, numbered how-it-works, and four roles", async ({
    page,
  }) => {
    const home = new HomePage(page);
    await test.step("Open home", () => home.open());
    await expect(home.problemHeading()).toBeVisible();
    await expect(home.howItWorksItems()).toHaveCount(4);
    const labels = (await home.roleLabels()).map((t) => t.trim().toLowerCase());
    for (const role of HOME_ROLES) {
      expect(labels, `missing role: ${role}`).toContain(role.toLowerCase());
    }
  });

  test("TC-02: US-001-AC-2 Limits section says this is a record, not legal advice or a verdict", async ({
    page,
  }) => {
    const home = new HomePage(page);
    await test.step("Open home", () => home.open());
    const limits = home.limitsSection();
    await limits.scrollIntoViewIfNeeded();
    const text = (await limits.innerText()).toLowerCase();
    expect(text).toContain("record");
    expect(text).toContain("verdict");
    expect(
      text.includes("legal advice") || text.includes("lawyer") || text.includes("your rights")
    ).toBeTruthy();
  });

  test("TC-03: US-001-AC-3 Start a record opens start.html", async ({ page }) => {
    const home = new HomePage(page);
    const start = new StartPage(page);
    await test.step("Open home", () => home.open());
    await test.step("Click Start a record", () => home.clickStartARecord());
    expect(start.isStartUrl(page.url())).toBeTruthy();
    await expect(start.heading()).toBeVisible();
  });

  test.describe("phone-width", () => {
    test.use({ viewport: { width: phone.width, height: phone.height } });

    test("TC-04: US-001-AC-4 Phone-width home has no clip and no sideways scroll", async ({
      page,
    }) => {
      const home = new HomePage(page);
      await test.step(`Open home at ${phone.width}×${phone.height}`, () => home.open());
      expect(await hasHorizontalOverflow(page)).toBe(false);
      await expect(home.problemHeading()).toBeVisible();
    });
  });
});
