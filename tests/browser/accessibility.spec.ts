import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
for (const route of ["/", "/dashboard", "/discover", "/profile/edit"])
  test(`WCAG A/AA automated scan ${route}`, async ({ page }) => {
    if (route !== "/") {
      await page.goto("/login");
      await page.getByLabel("Email address").fill("demo-alex@example.test");
      await page
        .getByLabel("Password", { exact: true })
        .fill("Demo-Only-SkillSpring-29");
      await page.getByRole("button", { name: "Log in", exact: true }).click();
      await expect(page).toHaveURL(/dashboard/);
    }
    await page.goto(route);
    await expect(page.locator("main h1")).toBeVisible();
    await page.waitForLoadState("networkidle");
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          reason: n.failureSummary,
        })),
      })),
    ).toEqual([]);
  });
