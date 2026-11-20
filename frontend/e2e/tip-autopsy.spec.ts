import path from "node:path";
import { expect, test } from "@playwright/test";

const MANDATORY_DISCLAIMER =
  "This report describes historical facts and risk factors around a tip. It is not investment advice or SEBI-registered research. The decision is yours.";

test.describe("Tip Autopsy Core E2E & Safety Verification (Task 2.14)", () => {
  test("completes full pasted Hinglish tip flow -> Claim Ledger -> SEBI -> 5 checks -> exact-date marker -> Guarded Verdict -> Pause & Plan with zero storage persistence", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Think Before You Trust.");

    // Verify Hero is strictly single-page with ZERO vertical or horizontal overflow
    const heroOverflow = await page.evaluate(() => ({
      x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    }));
    expect(heroOverflow.x).toBeLessThanOrEqual(2);
    expect(heroOverflow.y).toBeLessThanOrEqual(2);

    // Navigate into single-window dashboard shell
    await page.getByRole("button", { name: /Analyze a Tip/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(/(Real · Live Feed|Dated Market Snapshots) · NSE \/ BSE/)).toBeVisible();

    // Verify Dashboard shell fits in a single window (outer document has zero vertical overflow; inner pane scrolls)
    const dashOverflow = await page.evaluate(() => ({
      x: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      y: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    }));
    expect(dashOverflow.x).toBeLessThanOrEqual(2);
    expect(dashOverflow.y).toBeLessThanOrEqual(2);

    // Open New Analysis
    await page.goto("/analyze");
    await page
      .getByLabel(/Tip text or transcript/i)
      .fill(
        "Guaranteed 2x in 10 days, last chance! Borosil Renewables Ltd Buy above 615 Target 740. SL PAID."
      );
    await page.getByLabel(/Influencer name, handle, or SEBI reg/i).fill("Rakesh Bansal");
    await page.getByLabel(/Stock or instrument name/i).fill("Borosil Renewables Ltd");
    await page.getByRole("button", { name: /Run Tip Autopsy/i }).click();

    // Step 2 — Claim Ledger & Hype
    await expect(page.getByText("Step 2 — Structured Claim Ledger")).toBeVisible();
    await expect(page.getByText("Not stated (Gated)", { exact: true })).toBeVisible();
    await expect(page.getByText("Creator's claim", { exact: true })).toBeVisible();

    // Step 3 — SEBI & 5 Checks
    await page.getByRole("button", { name: /Inspect SEBI & Market Checks/i }).click();
    await expect(page.getByText("SEBI Register Snapshot Lookup")).toBeVisible();
    await expect(page.getByText(/INH100008984/)).toBeVisible();
    await expect(page.getByText("Not enough tips to judge", { exact: true })).toBeVisible();

    // Step 4 — Tip Time Machine exact-date marker & Guarded Verdict
    await page.getByRole("button", { name: /Open Time Machine & Information Verdict/i }).click();
    await expect(page.getByText("Tip Time Machine")).toBeVisible();
    await page.getByRole("button", { name: /2026-11-10/i }).click();
    await expect(page.getByText("Exact-Date Tips for 2026-11-10")).toBeVisible();
    await expect(page.getByText("Output Guard: Passed")).toBeVisible();
    await expect(page.getByText(MANDATORY_DISCLAIMER).first()).toBeVisible();

    // Step 5 — Pause & Plan 3-question gate
    await page.getByRole("button", { name: /Proceed to Pause & Plan/i }).click();
    const actBtn = page.getByRole("button", { name: /I'd act on this/i });
    await expect(actBtn).toBeDisabled();
    await page.getByLabel(/How much can I afford to lose/i).fill("₹3,000");
    await page.getByLabel(/At what price do I exit/i).fill("₹590");
    await page.getByLabel(/What would prove this tip wrong/i).fill("Closes below 20-day low");
    await expect(actBtn).toBeEnabled();
    await actBtn.click();
    await expect(page.getByText(/Personal pre-commitment review completed/i)).toBeVisible();

    // Verify ZERO localStorage / sessionStorage persistence
    const storageCounts = await page.evaluate(() => ({
      local: window.localStorage.length,
      session: window.sessionStorage.length,
    }));
    expect(storageCounts.local).toBe(0);
    expect(storageCounts.session).toBe(0);
  });

  test("continues cleanly on Not-found SEBI creator and shows Could not verify for curated derivative photo sample", async ({
    page,
  }) => {
    await page.goto("/analyze");

    // Pick curated derivative photo sample (Ashish Kyal -> Sensex 82900 CE -> Not found in SEBI)
    await page.getByRole("button", { name: /Sensex 82900 CE/i }).click();
    await page.getByRole("button", { name: /Run Tip Autopsy/i }).click();

    await expect(page.getByText("Not stated (Gated)", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: /Inspect SEBI & Market Checks/i }).click();

    await expect(page.getByText("Not found in SEBI register", { exact: true })).toBeVisible();
    await expect(page.getByText("Could not verify", { exact: true }).first()).toBeVisible();

    // Confirm Not-found SEBI never blocks Step 4 Information Verdict
    await page.getByRole("button", { name: /Open Time Machine & Information Verdict/i }).click();
    await expect(page.getByText("Output Guard: Passed")).toBeVisible();
    await expect(page.getByText(MANDATORY_DISCLAIMER).first()).toBeVisible();
  });

  test("supports transient photo file upload + direct structured influencer/stock fallback with no mobile overflow", async ({
    page,
  }) => {
    await page.goto("/analyze");
    await page.getByRole("tab", { name: "Photo" }).click();

    const samplePhoto = path.resolve(
      process.cwd(),
      "public/media/photos/Ashish_Kyal__Sensex_82900_CE__Not_Registered.jpeg"
    );
    await page.locator("#media-file-upload").setInputFiles(samplePhoto);
    await page.getByLabel(/Influencer name, handle, or SEBI reg/i).fill("Vivek Rana");
    await page.getByLabel(/Stock or instrument name/i).fill("Wipro Limited");
    await page.getByRole("button", { name: /Run Tip Autopsy/i }).click();

    await expect(page.getByText(/Media verified in memory and discarded immediately/i)).toBeVisible();
    await page.getByRole("button", { name: /Inspect SEBI & Market Checks/i }).click();
    await expect(page.getByText("Within normal range", { exact: true }).first()).toBeVisible();

    // Check no horizontal overflow on current viewport (covers both desktop & Pixel 5 mobile)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(2);
  });
});
