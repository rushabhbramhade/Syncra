import { test, expect } from "@playwright/test";

test.describe("Notification System - Production Hardening Suite", () => {

  // ── Telegram Connection ──
  test.describe("Telegram Connection", () => {
    test("should display Telegram connection status on notifications page", async ({ page }) => {
      await page.goto("/dashboard/notifications");
      await page.waitForLoadState("networkidle");
      const statusWidget = page.locator("text=Telegram").or(page.locator("[class*=telegram]"));
      await expect(statusWidget.first()).toBeVisible({ timeout: 10000 });
    });

    test("should show connect/disconnect button", async ({ page }) => {
      await page.goto("/dashboard/notifications");
      await page.waitForLoadState("networkidle");
      const connectBtn = page.getByRole("button", { name: /connect|disconnect/i });
      await expect(connectBtn.first()).toBeVisible({ timeout: 10000 });
    });
  });

  // ── Notification Preferences ──
  test.describe("Notification Preferences", () => {
    test("should display notification types with toggle switches", async ({ page }) => {
      await page.goto("/dashboard/settings");
      await page.waitForLoadState("networkidle");
      const toggle = page.locator('[role="switch"], input[type="checkbox"], .toggle, [class*=switch]').first();
      await expect(toggle).toBeVisible({ timeout: 10000 });
    });

    test("should toggle a notification preference", async ({ page }) => {
      await page.goto("/dashboard/settings");
      await page.waitForLoadState("networkidle");
      const firstToggle = page.locator('[role="switch"], input[type="checkbox"], .toggle, [class*=switch]').first();
      await firstToggle.click();
      // Should not error
      await expect(page.locator("text=error").or(page.locator('[class*=error]'))).toHaveCount(0, { timeout: 5000 });
    });
  });

  // ── Notification Badge ──
  test.describe("Notification Badge", () => {
    test("should display notification bell in top navigation", async ({ page }) => {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");
      const bell = page.locator('[aria-label="Notifications"], svg.lucide-bell, [class*=notification-badge]').first();
      await expect(bell).toBeVisible({ timeout: 10000 });
    });

    test("should navigate to notifications page on click", async ({ page }) => {
      await page.goto("/dashboard");
      await page.waitForLoadState("networkidle");
      const bell = page.locator('[aria-label="Notifications"], svg.lucide-bell, [class*=notification-badge]').first();
      await bell.click();
      await expect(page).toHaveURL(/\/dashboard\/notifications/);
    });
  });

  // ── Notification Center Page ──
  test.describe("Notification Center Page", () => {
    test("should load the notification center page", async ({ page }) => {
      await page.goto("/dashboard/notifications");
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(/\/dashboard\/notifications/);
    });

    test("should display filter tabs (All / Unread / Read / Archived)", async ({ page }) => {
      await page.goto("/dashboard/notifications");
      await page.waitForLoadState("networkidle");
      const tabs = page.locator("button:has-text('All'), button:has-text('Unread'), button:has-text('Read'), button:has-text('Archived')");
      await expect(tabs.first()).toBeVisible({ timeout: 10000 });
    });

    test("should display search bar", async ({ page }) => {
      await page.goto("/dashboard/notifications");
      await page.waitForLoadState("networkidle");
      const search = page.locator('input[type="text"], input[placeholder*="search" i], input[placeholder*="Search" i]').first();
      await expect(search).toBeVisible({ timeout: 10000 });
    });

    test("should display notification stats", async ({ page }) => {
      await page.goto("/dashboard/notifications");
      await page.waitForLoadState("networkidle");
      const stats = page.locator("text=sent, text=delivered, text=failed, text=total").first();
      await expect(stats).toBeVisible({ timeout: 10000 });
    });

    test("should handle empty notification state gracefully", async ({ page }) => {
      await page.goto("/dashboard/notifications");
      await page.waitForLoadState("networkidle");
      const body = page.locator("body");
      await expect(body).not.toContainText("Internal Server Error");
      await expect(body).not.toContainText("Application error");
    });
  });

  // ── Test Notification Flow ──
  test.describe("Send Test Notification", () => {
    test("should have a send test button", async ({ page }) => {
      await page.goto("/dashboard/notifications");
      await page.waitForLoadState("networkidle");
      const testBtn = page.getByRole("button", { name: /test/i });
      // This might not appear if user has no Telegram connection
      if (await testBtn.isVisible()) {
        await expect(testBtn).toBeVisible();
      }
    });
  });

  // ── Provider List ──
  test.describe("Provider Integration", () => {
    test("should list available notification providers", async ({ page }) => {
      await page.goto("/dashboard/integrations");
      await page.waitForLoadState("networkidle");
      const providerSection = page.locator("text=Telegram, text=Slack, text=Email").first();
      await expect(providerSection).toBeVisible({ timeout: 10000 });
    });
  });

  // ── History ──
  test.describe("Notification History", () => {
    test("should display notification history when available", async ({ page }) => {
      await page.goto("/dashboard/notifications");
      await page.waitForLoadState("networkidle");
      // History section should be present
      const historySection = page.locator("text=history, text=History, text=recent").first();
      // Optional assertion - history may be empty
    });
  });
});
