/**
 * /test-it harness for US-001 — not a committed regression suite.
 * Run: npx --yes -p playwright node .quality/us-001/run-execution.mjs
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

(async () => {
  const results = [];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  try {
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 15000 });
  } catch (err) {
    const blocked = ["TC-01", "TC-02", "TC-03", "TC-04"].map((id) => ({
      id,
      status: "BLOCKED",
      reason: String(err),
    }));
    fs.writeFileSync(path.join(logs, "execution.json"), JSON.stringify({ blocked, error: String(err) }, null, 2));
    await browser.close();
    process.exit(2);
  }

  // TC-01
  {
    const problem = await page.locator("h2", { hasText: "The problem" }).count();
    const steps = await page.locator("ol.steps > li").count();
    const body = (await page.locator("body").innerText()).toLowerCase();
    const roles = ["tenant", "landlord or agent", "contractor", "deposit scheme or court"];
    const missing = roles.filter((r) => !body.includes(r));
    await page.screenshot({ path: path.join(shots, "TC-01-home-roles.png"), fullPage: true });
    if (problem >= 1 && steps >= 1 && missing.length === 0) {
      results.push(pass("TC-01", `problem h2=${problem}, how-it-works items=${steps}, roles present`));
    } else {
      results.push(
        fail(
          "TC-01",
          `problem=${problem} steps=${steps} missingRoles=${missing.join("|") || "none"}`
        )
      );
    }
  }

  // TC-02
  {
    const limits = page.locator("section").filter({ has: page.locator("h2", { hasText: "What this is not" }) });
    const text = (await limits.innerText()).toLowerCase();
    await page.locator("h2", { hasText: "What this is not" }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(shots, "TC-02-limits.png"), fullPage: true });
    const isRecord = text.includes("record");
    const notVerdict = text.includes("verdict");
    const notAdvice =
      text.includes("legal advice") || text.includes("lawyer") || text.includes("your rights");
    if (isRecord && notVerdict && notAdvice) {
      results.push(pass("TC-02", "limits section: record, not verdict, not lawyer/rights/legal advice"));
    } else {
      results.push(fail("TC-02", `record=${isRecord} verdict=${notVerdict} advice=${notAdvice}`));
    }
  }

  // TC-03
  {
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: "Start a record" }).click();
    await page.waitForLoadState("domcontentloaded");
    const url = page.url();
    const heading = await page.locator("h1").innerText();
    await page.screenshot({ path: path.join(shots, "TC-03-start-html.png"), fullPage: true });
    if (/start(\.html)?\/?$/i.test(url) && /start a record/i.test(heading)) {
      results.push(pass("TC-03", `url=${url}`));
    } else {
      results.push(fail("TC-03", `url=${url} h1=${heading}`));
    }
  }

  // TC-04
  {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    const metrics = await page.evaluate(() => {
      const el = document.documentElement;
      return {
        clientWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
      };
    });
    await page.screenshot({ path: path.join(shots, "TC-04-phone-width.png"), fullPage: true });
    const overflow = metrics.scrollWidth > metrics.clientWidth + 1;
    if (!overflow) {
      results.push(pass("TC-04", JSON.stringify(metrics)));
    } else {
      results.push(fail("TC-04", `horizontal overflow ${JSON.stringify(metrics)}`));
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
