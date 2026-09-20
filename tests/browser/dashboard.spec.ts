import { expect, test } from "@playwright/test";

test("all pages, groups, simulated plans and accessible controls work", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welcome to CarePath." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Open CarePath" })).toBeDisabled();
  await page.getByRole("radio", { name: /Aged & complex care/ }).check();
  await page.getByRole("button", { name: "Open CarePath" }).click();
  await expect(page.getByRole("dialog", { name: "guided tour", exact: true })).toBeVisible();
  for (let step = 0; step < 3; step++) await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Start exploring" }).click();
  await expect(page.getByRole("heading", { name: /Find the care pathways/ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("overview.png"), fullPage: true });
  await page.getByRole("navigation").getByRole("button", { name: "Groups", exact: true }).click();
  for (const name of ["Occasional visitors", "Rare but serious", "Frequent but stable", "Frequent and high-need"]) {
    await page.getByRole("group", { name: "Choose a patient group" }).getByRole("button", { name, exact: true }).click();
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    await expect(page.locator(".interventions li")).toHaveCount(2);
    await expect(page.locator(".factor-list li")).toHaveCount(5);
  }
  await page.screenshot({ path: testInfo.outputPath("groups.png"), fullPage: true });
  await page.getByRole("button", { name: "Try a plan for this group" }).click();
  await expect(page.getByLabel("Patient group", { exact: true })).toHaveValue("recurrent");
  await page.getByRole("button", { name: "Manual planning", exact: true }).click();
  const result = page.getByTestId("simulation-result");
  const before = await result.textContent() ?? "";
  await page.getByRole("slider", { name: "Checked for extra support" }).fill("0");
  await expect(result.locator(".simulation-main strong")).toHaveText("0");
  await page.getByRole("slider", { name: "Checked for extra support" }).fill("40");
  await expect(result).not.toHaveText(before);
  await page.getByRole("button", { name: "Reset assumptions" }).click();
  await expect(result).toHaveText(before);
  for (const group of ["occasional", "acute", "frequent", "recurrent"]) {
    await page.getByLabel("Patient group", { exact: true }).selectOption(group);
    await expect(result).not.toContainText("NaN");
  }
  await page.screenshot({ path: testInfo.outputPath("plan.png"), fullPage: true });
  await page.getByRole("navigation").getByRole("button", { name: "How this works" }).click();
  await expect(page.getByRole("heading", { name: "Do the four groups fit the data?" })).toBeVisible();
  await expect(page.locator(".avoidable-grid > div")).toHaveCount(4);
  await page.getByRole("button", { name: "Accessibility settings", exact: true }).click();
  await page.getByRole("checkbox", { name: /Larger text/ }).check();
  await page.getByRole("checkbox", { name: /High contrast/ }).check();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/large-text/);
  await expect(page.locator("html")).toHaveClass(/high-contrast/);
  await expect(page.locator("body")).not.toContainText(/cohort|Scenario Lab|Trust Centre|inpatient bed-days/i);
  await page.getByRole("button", { name: "Guide me" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("small screens, keyboard navigation and reduced motion", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.setItem("carepath-tour", "done");
    sessionStorage.setItem("carepath-demo-session", JSON.stringify({ name: "Test reviewer", roleId: "aged" }));
  });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  for (const name of ["Overview", "Groups", "Explore", "Try a plan", "How this works"]) {
    await page.getByRole("navigation").getByRole("button", { name, exact: true }).click();
    await expect(page.locator("#main-content > div")).toHaveCSS("opacity", "1");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, name + " must not scroll horizontally").toBe(false);
  }
  await page.getByRole("navigation").getByRole("button", { name: "Overview", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("mobile.png"), fullPage: true });
  await page.getByRole("button", { name: "Accessibility settings", exact: true }).click();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Done", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Close accessibility settings" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Accessibility settings", exact: true })).toBeFocused();
});

test("browser simulation agrees with Python defaults and respects boundaries", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("carepath-tour", "done"));
  await page.goto("/");
  // Load through Vite so the actual TypeScript function runs in the browser.
  const results = await page.evaluate(async () => {
    const modulePath = "/src/lib/simulation.ts";
    const { simulateScenario } = await import(/* @vite-ignore */ modulePath);
    const data = await fetch("/data/summary.json").then(r => r.json());
    return {
      comparisons: data.cohorts.map((group: { patients: number; inpatientBedDays: number; default_simulation: Record<string, number> }) => ({
        browser: simulateScenario(group, 20, 60, 1.5), python: group.default_simulation,
      })),
      zero: simulateScenario({ patients: 1000, inpatientBedDays: 10000 }, 0, 60, 1.5),
      capped: simulateScenario({ patients: 1000, inpatientBedDays: 10 }, 100, 100, 5),
    };
  });
  for (const result of results.comparisons) {
    for (const key of ["p10", "p50", "p90", "mean"]) {
      expect(Math.abs(result.browser[key] - result.python[key]) / Math.max(1, result.python[key])).toBeLessThan(.08);
    }
    expect(result.browser.p10).toBeLessThan(result.browser.p50);
    expect(result.browser.p50).toBeLessThan(result.browser.p90);
  }
  expect(results.zero).toEqual({ p10: 0, p50: 0, p90: 0, mean: 0 });
  expect(results.capped.p90).toBeLessThanOrEqual(10);
});
