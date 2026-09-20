import { expect, test } from "@playwright/test";

test("demo sign-in remembers the tab, selects the role view and signs out", async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem("carepath-tour", "done"));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Welcome to CarePath." })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("login.png"), fullPage: true });
  await page.getByLabel("Your name", { exact: false }).fill("Alex");
  await page.getByRole("radio", { name: /Emergency care/ }).check();
  await page.getByRole("button", { name: "Open CarePath" }).click();
  await expect(page.getByRole("heading", { name: /A closer look/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: /A closer look/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out", exact: true })).toHaveAttribute("title", /Alex/);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome to CarePath." })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("carepath-demo-session"))).toBeNull();
  await page.getByRole("radio", { name: /Community planning/ }).check();
  await page.getByRole("button", { name: "Open CarePath" }).click();
  await expect(page.getByRole("heading", { name: "Small changes. A range of possibilities." })).toBeVisible();
  await expect(page.getByLabel("Patient group", { exact: true })).toHaveValue("recurrent");
});

test("explorer selections update totals and both charts from the actual summary", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem("carepath-tour", "done");
    sessionStorage.setItem("carepath-demo-session", JSON.stringify({ name: "Test", roleId: "ed" }));
  });
  await page.goto("/");
  const data = await page.request.get("/data/summary.json").then(r => r.json());
  const format = (v: number) => new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 }).format(v);
  const readout = page.locator(".evidence-readout");
  await expect(readout).toContainText(format(data.metrics.patients));
  await expect(page.locator(".evidence-heatmap button")).toHaveCount(18);
  const first = data.exploration[0], second = data.exploration[1];
  await page.locator(".evidence-heatmap button").nth(0).click();
  await expect(readout.locator(".selection-stat strong").nth(0)).toHaveText(format(first.patients));
  await expect(readout.locator(".selection-stat strong").nth(2)).toHaveText(format(first.inpatientBedDays));
  await page.locator(".evidence-heatmap button").nth(1).click();
  await expect(readout.locator(".selection-stat strong").nth(0)).toHaveText(format(first.patients + second.patients));
  await page.getByRole("group", { name: "Shade the grid by" }).getByRole("button", { name: "Hospital days" }).click();
  await expect(page.locator(".evidence-heatmap button").nth(0)).toContainText(format(first.inpatientBedDays));
  await expect(page.locator(".evidence-heatmap button[aria-pressed=true]")).toHaveCount(2);
  await page.getByRole("button", { name: "Compare charts", exact: true }).click();
  await expect(page.locator(".evidence-page .two-column .recharts-surface")).toHaveCount(2);
  await page.screenshot({ path: testInfo.outputPath("explore.png"), fullPage: true });
  await page.getByRole("button", { name: "Select groups", exact: true }).click();
  await page.getByRole("button", { name: "Clear selection" }).click();
  await expect(readout.locator(".selection-stat strong").nth(0)).toHaveText(format(data.metrics.patients));
  await expect(page.getByRole("button", { name: "Clear selection" })).toBeDisabled();
  expect(errors).toEqual([]);
});
