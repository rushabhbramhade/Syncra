import { test, expect } from "@playwright/test";

test.describe("Reset password", () => {
  test("no token redirects to forgot-password", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page).toHaveURL(/\/forgot-password/, { timeout: 10000 });
  });

  test("token present renders new password form", async ({ page }) => {
    await page.goto("/reset-password?token=dummy-token");
    await expect(page.getByLabel("New password", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Confirm new password", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: /reset password/i })).toBeVisible();
  });

  test("weak password is blocked client-side", async ({ page }) => {
    await page.goto("/reset-password?token=dummy-token");
    await page.getByLabel("New password", { exact: true }).fill("short");
    await page.getByLabel("Confirm new password", { exact: true }).fill("short");
    await page.getByRole("button", { name: /reset password/i }).click();
    await expect(page.getByText("At least 8 characters", { exact: true })).toBeVisible();
  });

  test("mismatched confirmation is blocked", async ({ page }) => {
    await page.goto("/reset-password?token=dummy-token");
    await page.getByLabel("New password", { exact: true }).fill("StrongP@ss1");
    await page.getByLabel("Confirm new password", { exact: true }).fill("StrongP@ss2");
    await page.getByRole("button", { name: /reset password/i }).click();
    await expect(page.getByText(/passwords do not match/i)).toBeVisible();
  });

  test("password strength checklist renders", async ({ page }) => {
    await page.goto("/reset-password?token=dummy-token");
    await page.getByLabel("New password", { exact: true }).fill("a");
    await expect(page.getByText("At least 8 characters")).toBeVisible();
    await expect(page.getByText("An uppercase letter")).toBeVisible();
  });
});
