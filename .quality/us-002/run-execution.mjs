/**
 * /test-it harness for US-002 — not a committed regression suite.
 * Run: npx --yes -p playwright node .quality/us-002/run-execution.mjs
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE = process.env.BASE_URL || "http://localhost:3000";
const OUT = __dirname;
const shots = path.join(OUT, "screenshots");
const logs = path.join(OUT, "logs");

fs.mkdirSync(shots, { recursive: true });
fs.mkdirSync(logs, { recursive: true });

function fail(id, reason) {
  return { id, status: "FAIL", reason };
}
function pass(id, note) {
  return { id, status: "PASS", note };
}

function isStartUrl(url) {
  return /\/start(\.html)?\/?$/i.test(url);
}

(async () => {
  const results = [];
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    await page.goto(BASE + "/start", { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "domcontentloaded" });
  } catch (err) {
    const blocked = ["TC-01", "TC-02", "TC-03", "TC-04"].map((id) => ({
      id,
      status: "BLOCKED",
      reason: String(err),
    }));
    fs.writeFileSync(
      path.join(logs, "execution.json"),
      JSON.stringify({ blocked, error: String(err) }, null, 2)
    );
    await browser.close();
    process.exit(2);
  }

  // TC-01
  {
    const address = page.getByTestId("field-address");
    const moveIn = page.getByTestId("field-move-in");
    const deposit = page.getByTestId("field-deposit");
    const ok =
      (await address.isVisible()) &&
      (await moveIn.isVisible()) &&
      (await deposit.isVisible());
    await page.screenshot({ path: path.join(shots, "TC-01-start-fields.png"), fullPage: true });
    if (ok) {
      results.push(pass("TC-01", "address, move-in, deposit fields visible"));
    } else {
      results.push(fail("TC-01", "one or more fields not visible"));
    }
  }

  // TC-02
  {
    await page.evaluate(() => localStorage.clear());
    await page.goto(BASE + "/start", { waitUntil: "domcontentloaded" });
    await page.getByTestId("submit-start").click();
    const alert = page.getByRole("alert");
    const alertVisible = await alert.isVisible();
    const alertText = alertVisible ? await alert.innerText() : "";
    const url = page.url();
    const hasTenancy = await page.evaluate(
      () => window.PaperTrailStorage && window.PaperTrailStorage.hasTenancy()
    );
    await page.screenshot({ path: path.join(shots, "TC-02-empty-submit.png"), fullPage: true });
    const ok =
      isStartUrl(url) &&
      alertVisible &&
      /address and move-in date/i.test(alertText) &&
      !hasTenancy;
    if (ok) {
      results.push(pass("TC-02", `alert=${alertText.trim()}; no tenancy saved`));
    } else {
      results.push(
        fail("TC-02", `url=${url} alert=${alertVisible} text=${alertText} tenancy=${hasTenancy}`)
      );
    }
  }

  // TC-03
  {
    await page.evaluate(() => localStorage.clear());
    await page.goto(BASE + "/start", { waitUntil: "domcontentloaded" });
    await page.getByTestId("field-address").fill("42 Test Lane");
    await page.getByTestId("field-move-in").fill("2026-08-01");
    await page.getByTestId("submit-start").click();
    await page.waitForLoadState("domcontentloaded");
    const heading = await page.getByTestId("tenancy-heading").innerText();
    const url = page.url();
    await page.screenshot({ path: path.join(shots, "TC-03-log-heading.png"), fullPage: true });
    if (/log(\.html)?\/?$/i.test(url) && heading === "42 Test Lane") {
      results.push(pass("TC-03", `url=${url}; heading=${heading}`));
    } else {
      results.push(fail("TC-03", `url=${url} heading=${heading}`));
    }
  }

  // TC-04
  {
    await page.evaluate(() => localStorage.clear());
    await page.goto(BASE + "/start", { waitUntil: "domcontentloaded" });
    await page.getByTestId("field-address").fill("99 Read Only Road");
    await page.getByTestId("field-move-in").fill("2026-07-15");
    await page.getByTestId("field-deposit").fill("900");
    await page.getByTestId("submit-start").click();
    await page.waitForLoadState("domcontentloaded");
    const summary = page.getByTestId("tenancy-summary");
    const summaryText = await summary.innerText();
    const controlCount = await summary.locator("input, textarea, select, button").count();
    const readOnlyCopy = /read-only/i.test(summaryText);
    await page.screenshot({ path: path.join(shots, "TC-04-read-only-summary.png"), fullPage: true });
    const ok =
      summaryText.includes("99 Read Only Road") &&
      controlCount === 0 &&
      readOnlyCopy;
    if (ok) {
      results.push(pass("TC-04", `controls=${controlCount}; read-only copy present`));
    } else {
      results.push(
        fail("TC-04", `address=${summaryText.includes("99 Read Only Road")} controls=${controlCount} copy=${readOnlyCopy}`)
      );
    }
  }

  await browser.close();
  fs.writeFileSync(path.join(logs, "execution.json"), JSON.stringify({ results }, null, 2));
  console.log(JSON.stringify({ results }, null, 2));
  const failed = results.some((r) => r.status === "FAIL" || r.status === "BLOCKED");
  process.exit(failed ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
