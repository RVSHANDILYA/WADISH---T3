import { expect, test } from '@playwright/test';

test('grid rates use each saved cell and keep total selections intact', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('carepath-tour', 'done');
    sessionStorage.setItem('carepath-demo-session', JSON.stringify({ name: 'Reviewer', roleId: 'ed' }));
  });
  await page.goto('/');
  const data = await page.request.get('/data/summary.json').then(r => r.json());
  const cell = data.exploration[0];
  const format = (v: number) => v.toLocaleString('en-AU', { maximumFractionDigits: 2 });
  await page.locator('.evidence-heatmap button').first().click();
  const totals = await page.locator('.evidence-readout').innerText();
  await page.getByRole('button', { name: 'Per-person rates', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Typical days per person', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.evidence-heatmap button').first().locator('span')).toHaveText(format(cell.median_bed_days_per_person));
  await expect(page.locator('.evidence-heatmap button').first().locator('small')).toHaveText(`Mean ${format(cell.mean_bed_days_per_person)}`);
  await expect(page.getByText('Median is used because a small number of very long stays would otherwise pull the average up for everyone in this group.')).toBeVisible();
  await page.getByRole('button', { name: 'ED visits per person (mean)', exact: true }).click();
  await expect(page.locator('.evidence-heatmap button').first().locator('span')).toHaveText(format(cell.ed_presentations_per_person));
  await page.getByRole('button', { name: 'Admissions per 100 presentations', exact: true }).click();
  await expect(page.locator('.evidence-heatmap button').first().locator('span')).toHaveText(format(cell.admissions_per_100_presentations));
  await page.getByRole('button', { name: 'Totals', exact: true }).click();
  await expect(page.locator('.evidence-readout')).toHaveText(totals, { useInnerText: true });
  await expect(page.locator('.evidence-heatmap button').first()).toHaveAttribute('aria-pressed', 'true');
});
