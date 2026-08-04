import { test, expect } from "@playwright/test";

test.describe("Forgot password", () => {
  test("renders email form and blocks invalid email", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(page.getByText("Email is required")).toBeVisible();

    await page.getByLabel("Your email").fill("not-an-email");
    await page.getByRole("button", { name: /send reset link/i }).click();
    await expect(page.getByText("Please enter a valid email address")).toBeVisible();
  });

  test("valid email shows confirmation screen with resend cooldown", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Your email").fill("smoke@example.com");
    await page.getByRole("button", { name: /send reset link/i }).click();

    await expect(page.getByText(/check your inbox/i)).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/resend email in \d+s/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("link", { name: /back to sign in/i })).toBeVisible();
  });

  test("back to sign in navigates to sign-in", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByRole("link", { name: /back to sign in/i }).click();
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
