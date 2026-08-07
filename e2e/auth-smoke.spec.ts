import { test, expect } from "@playwright/test";

test.describe("Auth smoke tests", () => {
  test("sign-in page renders email + password + forgot link", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.getByRole("link", { name: /forgot/i })).toHaveAttribute("href", "/forgot-password");
    await expect(page.getByRole("button", { name: /get started/i })).toBeVisible();
  });

  test("sign-in redirect param is honored after successful submit", async ({ page }) => {
    await page.goto("/sign-in?redirect=/dashboard/briefing");
    await page.locator("#email").fill("smoke@example.com");
    await page.locator("#password").fill("wrong-password");
    await page.getByRole("button", { name: /get started/i }).click();
    // Wrong credentials must show an error and stay on sign-in (no crash / 500).
    const errorBanner = page.locator('[class*="error-bg"]');
    await expect(errorBanner).toBeVisible({ timeout: 20000 });
  });

  test("sign-up page renders fields", async ({ page }) => {
    await page.goto("/sign-up");
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.getByRole("button", { name: /create.*account|get started/i })).toBeVisible();
  });

  test("unauthenticated dashboard redirects to sign-in with the full return URL", async ({ page }) => {
    await page.goto("/dashboard/briefing?tab=history&limit=10");
    await expect(page).toHaveURL((url) =>
      url.pathname === "/sign-in" &&
      url.searchParams.get("redirect") === "/dashboard/briefing?tab=history&limit=10"
    );
  });

  test("forgot-password page renders email form", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByLabel("Your email")).toBeVisible();
    await expect(page.getByRole("button", { name: /send verification code/i })).toBeVisible();
  });
});
