import { test, expect } from "@playwright/test";

test.describe("Forgot password", () => {
  test("renders email form and blocks invalid email", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByRole("button", { name: /send verification code/i }).click();
    await expect(page.getByText("Email is required")).toBeVisible();

    await page.getByLabel("Your email").fill("not-an-email");
    await page.getByRole("button", { name: /send verification code/i }).click();
    await expect(page.getByText("Please enter a valid email address")).toBeVisible();
  });

  test("valid email shows confirmation screen with resend cooldown and continue button", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Your email").fill("smoke@example.com");
    await page.getByRole("button", { name: /send verification code/i }).click();

    await expect(page.getByText(/check your inbox/i)).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/enter this code on the next screen/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /continue/i })).toBeVisible();
    await expect(page.getByText(/resend email in \d+s/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("link", { name: /back to sign in/i })).toBeVisible();
  });

  test("continue navigates to reset-password-code", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Your email").fill("smoke@example.com");
    await page.getByRole("button", { name: /send verification code/i }).click();
    await expect(page.getByText(/check your inbox/i)).toBeVisible({ timeout: 20000 });
    await page.getByRole("button", { name: /continue/i }).click();
    await expect(page).toHaveURL(/\/reset-password-code/);
  });

  test("back to sign in navigates to sign-in", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByRole("link", { name: /back to sign in/i }).click();
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
