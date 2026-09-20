import { expect, test } from "@playwright/test";

for (const viewport of [{ width: 1536, height: 728 }, { width: 1280, height: 680 }]) {
  test(`task panels fit the laptop viewport ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => localStorage.setItem("carepath-tour", "done"));
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Open CarePath" })).toBeVisible({ timeout: 15000 });
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(viewport.height + 1);
    await page.screenshot({ path: testInfo.outputPath("login-fit.png") });
    await page.getByRole("radio", { name: /Community planning/ }).check();
    await page.getByRole("button", { name: "Open CarePath" }).click();
    await page.getByRole("button", { name: "Manual planning", exact: true }).click();
    await expect(page.locator(".scenario-layout")).toBeVisible();
    await page.locator(".scenario-layout").scrollIntoViewIfNeeded();
    const scenario = await page.locator(".scenario-layout").boundingBox();
    expect(scenario!.y).toBeGreaterThanOrEqual(-1);
    expect(scenario!.y + scenario!.height).toBeLessThanOrEqual(viewport.height + 1);
    await expect(page.getByRole("slider")).toHaveCount(3);
    await page.screenshot({ path: testInfo.outputPath("plan-fit.png") });
    await page.getByRole("navigation").getByRole("button", { name: "Explore", exact: true }).click();
    await page.locator(".evidence-layout").scrollIntoViewIfNeeded();
    const grid = await page.locator(".evidence-layout").boundingBox();
    expect(grid!.y).toBeGreaterThanOrEqual(-1);
    expect(grid!.y + grid!.height).toBeLessThanOrEqual(viewport.height + 1);
    await page.screenshot({ path: testInfo.outputPath("grid-fit.png") });
    await page.getByRole("button", { name: "Compare charts", exact: true }).click();
    await page.locator(".evidence-layout").scrollIntoViewIfNeeded();
    const charts = await page.locator(".evidence-layout").boundingBox();
    expect(charts!.y).toBeGreaterThanOrEqual(-1);
    expect(charts!.y + charts!.height).toBeLessThanOrEqual(viewport.height + 1);
    await page.screenshot({ path: testInfo.outputPath("charts-fit.png") });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  });
}

test("large text keeps every task control reachable", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 680 });
  await page.addInitScript(() => localStorage.setItem("carepath-tour", "done"));
  await page.goto("/");
  await page.getByRole("button", { name: "Accessibility settings", exact: true }).click();
  await page.getByRole("checkbox", { name: /Larger text/ }).check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("radio", { name: /Community planning/ }).check();
  await page.getByRole("button", { name: "Open CarePath" }).click();
  await page.getByRole("button", { name: "Manual planning", exact: true }).click();
  await page.getByRole("slider", { name: "Hospital days saved per person" }).fill("2");
  await expect(page.getByRole("slider", { name: "Hospital days saved per person" })).toHaveValue("2");
  await page.getByText("About hospital days and these assumptions", { exact: true }).click();
  await expect(page.getByText(/independent Beta distributions/)).toBeVisible();
});
