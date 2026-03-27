/**
 * GPTfy Agent Generator — Puppeteer end-to-end scenarios.
 *
 * Prerequisites: dev server running (`npm run dev`).
 *
 *   BASE_URL=http://127.0.0.1:3000 npm run test:e2e
 *   HEADLESS=false BASE_URL=http://127.0.0.1:3000 npm run test:e2e
 *
 * Scenarios: HTTP health, session API, home, navigation, connect/status/admin/generate UI,
 * accordion controls, new/update tabs, and full "Generate only" → output panel (template path).
 */

import puppeteer from "puppeteer";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const HEADLESS = process.env.HEADLESS !== "false";

/** Next.js dev keeps HMR sockets open — `networkidle` may never settle. */
const NAV = { waitUntil: "load" };

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "Assertion failed");
}

async function fetchJson(url) {
  const res = await fetch(url);
  assert(res.ok, `GET ${url} → ${res.status}`);
  return res.json();
}

async function runScenario(name, fn) {
  process.stdout.write(`  • ${name} … `);
  try {
    await fn();
    console.log("ok");
  } catch (e) {
    console.log("FAIL");
    throw e;
  }
}

/** React-controlled textarea: native setter + input (plain `.value` does not update React state). */
async function setReactTextareaValue(page, selector, text) {
  await page.$eval(
    selector,
    (el, value) => {
      const node = el;
      const set = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      if (!set) throw new Error("textarea value setter missing");
      set.call(node, value);
      node.dispatchEvent(new Event("input", { bubbles: true }));
    },
    text
  );
}

async function clickButtonContaining(page, substring) {
  const clicked = await page.evaluate((sub) => {
    const buttons = [...document.querySelectorAll("button")];
    const b = buttons.find((x) => (x.textContent || "").includes(sub));
    if (b) {
      b.click();
      return true;
    }
    return false;
  }, substring);
  assert(clicked, `button containing "${substring}" not found`);
}

async function main() {
  console.log(`\nPuppeteer E2E — BASE_URL=${BASE} (HEADLESS=${HEADLESS})\n`);

  await runScenario("Server responds (GET /)", async () => {
    const res = await fetch(BASE + "/");
    assert(res.ok, `GET / → ${res.status}`);
  });

  await runScenario("API /api/session returns JSON", async () => {
    const j = await fetchJson(BASE + "/api/session");
    assert(typeof j === "object" && j !== null, "session payload");
    assert("connected" in j, "session.connected");
  });

  const browser = await puppeteer.launch({
    headless: HEADLESS ? "new" : false,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--window-size=1400,900"],
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);
  page.setDefaultNavigationTimeout(90000);

  try {
    await runScenario("Home: hero and primary links", async () => {
      await page.goto(BASE + "/", NAV);
      const h1 = await page.$eval("h1", (el) => el.textContent || "");
      assert(h1.includes("Build agentic"), "home h1");
      assert((await page.$$('a[href="/connect"]')).length >= 1, "link Connect");
      assert((await page.$$('a[href="/generate"]')).length >= 1, "link Generate");
    });

    await runScenario("Routes: connect, status, generate, admin render", async () => {
      const cases = [
        ["/connect", "Salesforce"],
        ["/generate", "Use case"],
        ["/admin", "OpenAI"],
      ];
      for (const [path, needle] of cases) {
        await page.goto(BASE + path, { waitUntil: "networkidle2" });
        const body = await page.evaluate(() => document.body.innerText);
        assert(body.includes(needle), `expected "${needle}" on ${path}`);
      }
      await page.goto(BASE + "/status", { waitUntil: "networkidle2" });
      await page.waitForFunction(
        () => !document.body.innerText.includes("Loading…"),
        { timeout: 30000 }
      );
      const statusBody = await page.evaluate(() => document.body.innerText);
      assert(
        /Connection check|Connect Salesforce|GPTfy|metadata/i.test(statusBody),
        "status page meaningful content"
      );
    });

    await runScenario("Generate: accordions + expand/collapse + New agent tab", async () => {
      await page.goto(BASE + "/generate", NAV);
      await page.waitForSelector('[data-testid="e2e-use-case"]');

      const deployOpen = await page.$eval("#acc-trigger-deploy", (el) => el.getAttribute("aria-expanded"));
      assert(deployOpen === "true", "deploy accordion starts open");

      await page.click("#acc-trigger-deploy");
      await page.waitForFunction(
        () => document.querySelector("#acc-trigger-deploy")?.getAttribute("aria-expanded") === "false"
      );

      await page.click("#acc-trigger-deploy");
      await page.waitForFunction(
        () => document.querySelector("#acc-trigger-deploy")?.getAttribute("aria-expanded") === "true"
      );

      await clickButtonContaining(page, "Expand all");
      await clickButtonContaining(page, "New agent");
      const newSelected = await page.$eval(
        'button[role="tab"][aria-selected="true"]',
        (el) => el.textContent || ""
      );
      assert(newSelected.includes("New agent"), "New agent tab selected");

      await clickButtonContaining(page, "Update existing agent");
      await clickButtonContaining(page, "Collapse (keep use case open)");
    });

    await runScenario("Generate only: output panel (connected) or auth gate (not connected)", async () => {
      await page.goto(BASE + "/generate", NAV);
      await page.waitForSelector('[data-testid="e2e-use-case"]');

      const useCase =
        "E2E Puppeteer: create Tasks on Account, read-only Case, no delete DML. " + "x".repeat(20);
      await setReactTextareaValue(page, '[data-testid="e2e-use-case"]', useCase);

      const genResponsePromise = page.waitForResponse(
        (r) => r.url().includes("/api/generate/full") && r.request().method() === "POST",
        { timeout: 120000 }
      );
      await page.click('[data-testid="e2e-btn-generate-preview"]');
      const genRes = await genResponsePromise;
      const status = genRes.status();

      if (status === 401) {
        await page.waitForFunction(
          () => document.body.innerText.includes("Connect Salesforce first"),
          { timeout: 15000 }
        );
        return;
      }

      assert(genRes.ok(), `generate/full status ${status}`);
      await page.waitForSelector('[data-testid="e2e-output-panel"]', { timeout: 120000 });
      const hasSpec = await page.evaluate(() => document.body.innerText.includes("Spec"));
      assert(hasSpec, "output tabs include Spec");
    });

    await runScenario("Publish button present (not clicked — needs Salesforce)", async () => {
      await page.goto(BASE + "/generate", NAV);
      const publish = await page.$('[data-testid="e2e-btn-publish-pipeline"]');
      assert(publish, "publish pipeline button exists");
    });
  } finally {
    await browser.close();
  }

  console.log("\nAll scenarios passed.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
