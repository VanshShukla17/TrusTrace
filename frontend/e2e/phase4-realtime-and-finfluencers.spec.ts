import { expect, test } from "@playwright/test";

const MANDATORY_DISCLAIMER =
  "This report describes historical facts and risk factors around a tip. It is not investment advice or SEBI-registered research. The decision is yours.";

test.describe("Phase 4 — Real-Time Stocks & Finfluencer YouTube -> WhatsApp E2E", () => {
  test("loads Real-Time Stocks (/stocks) with live/snapshot provenance and hands off to /analyze", async ({
    page,
  }) => {
    await page.goto("/stocks");

    await expect(page.getByRole("heading", { name: "Real-Time Stocks" })).toBeVisible();
    await expect(page.getByText("NIFTY 50")).toBeVisible();
    await expect(page.getByText("SENSEX")).toBeVisible();
    await expect(page.getByText("BANKNIFTY")).toBeVisible();
    await expect(page.getByText(MANDATORY_DISCLAIMER)).toBeVisible();

    // Wait for watchlist quotes to populate (either Live Feed or Snapshot fallback)
    await expect(page.getByText("WIPRO").first()).toBeVisible({ timeout: 20_000 });

    // Confirm zero prohibited buy/sell recommendation labels
    await expect(page.getByText(/\bSTRONG BUY\b/i)).toHaveCount(0);
    await expect(page.getByText(/\bConfidence Score\b/i)).toHaveCount(0);

    // One-click handoff to /analyze
    const autopsyBtn = page.getByRole("button", { name: /Run 5-Check Tip Autopsy on/i });
    await expect(autopsyBtn).toBeVisible({ timeout: 15_000 });
    await autopsyBtn.click();

    await expect(page).toHaveURL(/\/analyze/);
  });

  test("loads Finfluencers (/finfluencers), syncs real-time YouTube RSS, and runs guarded WhatsApp subscribe -> test preview -> unsubscribe", async ({
    page,
  }) => {
    await page.goto("/finfluencers");

    await expect(
      page.getByRole("heading", { name: /Finfluencers & Real-Time YouTube Alerts/i })
    ).toBeVisible();
    await expect(page.getByText("Rakesh Bansal")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Official YouTube RSS Active").first()).toBeVisible();

    // Open WhatsApp Subscribe modal on Rakesh Bansal
    const firstSubscribeBtn = page
      .getByRole("button", { name: /Subscribe WhatsApp Alerts/i })
      .first();
    await firstSubscribeBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Select zero-setup Dry-Run Preview mode + valid number + explicit opt-in consent
    await dialog.getByLabel(/Instant Preview \/ Dry-Run Mode/i).click();
    await dialog.getByLabel(/WhatsApp Number/i).fill("+919876543210");

    const confirmBtn = dialog.getByRole("button", { name: /Confirm Opt-In Subscription/i });
    await expect(confirmBtn).toBeDisabled();

    await dialog.getByRole("checkbox").check();
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // Masked phone confirms encrypted storage without leaking full phone number
    await expect(dialog.getByText(/Subscription Active \(\+91\*\*\*\*\*\*3210\)/i)).toBeVisible({
      timeout: 15_000,
    });

    // Trigger guarded WhatsApp test alert preview
    await dialog.getByRole("button", { name: /Send Test Alert Now/i }).click();
    await expect(dialog.getByText(/Status: DRY_RUN_PREVIEW/i)).toBeVisible({ timeout: 25_000 });
    await expect(dialog.getByText(MANDATORY_DISCLAIMER)).toBeVisible();

    // One-click unsubscribe
    await dialog.getByRole("button", { name: /One-Click Unsubscribe/i }).click();
    await expect(dialog.getByText(/Unsubscribed \+91\*\*\*\*\*\*3210/i)).toBeVisible({
      timeout: 10_000,
    });
  });
});
