import { test as setup } from "@playwright/test";

const authFile = "test-results/.auth/user.json";

setup("authenticate as test user", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // If already on dashboard, auth is done
  if (page.url().includes("/dashboard")) {
    await page.context().storageState({ path: authFile });
    return;
  }

  // Click sign-in button and complete OAuth
  await page.getByRole("button", { name: /sign.*in|login|get.*started/i }).first().click();
  await page.waitForURL(/.*insforge\.app\/auth.*/, { timeout: 15000 });
  await page.waitForLoadState("networkidle");

  // Wait for OAuth redirect back
  await page.waitForURL(/.*localhost:3000.*/, { timeout: 30000 });
  await page.waitForLoadState("networkidle");

  await page.context().storageState({ path: authFile });
});
