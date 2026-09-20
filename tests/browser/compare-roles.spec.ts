import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('carepath-tour', 'done');
    sessionStorage.setItem('carepath-demo-session', JSON.stringify({ name: 'Reviewer', roleId: 'primary' }));
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: "Explore this group's planning options" })).toBeVisible({ timeout: 25000 });
});

for (const width of [1440, 390]) {
  test(`bubbles and parallel role comparison at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const requests: any[] = [];
    await page.route('**/api/plan-chat', async route => {
      const body = route.request().postDataJSON(); requests.push(body);
      await route.fulfill({ json: { reply: `${body.role}: Population planning response with the same selected-group facts.`, flagged: false } });
    });
    const input = page.getByLabel("Ask about this group's patterns");
    const compare = page.getByRole('button', { name: 'Compare roles on this question' });
    await expect(compare).toBeDisabled();
    await input.fill('What would help this group the most?');
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.locator('.chat-message.assistant')).toHaveCount(2);
    await expect(page.locator('.chat-message.user')).toHaveCSS('background-color', 'rgb(15, 118, 110)');
    await expect(page.locator('.chat-message.user')).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(page.locator('.chat-avatar')).toHaveCount(2);
    await page.screenshot({ path: testInfo.outputPath(`thread-${width}.png`), fullPage: true });
    await compare.click();
    for (const name of ['Doctor', 'Nurse', 'Planner']) await expect(page.getByRole('region', { name: `${name} response` })).toContainText('Population planning response');
    expect(requests.slice(1).map(r => r.role).sort()).toEqual(['doctor', 'nurse', 'planner']);
    expect(new Set(requests.slice(1).map(r => JSON.stringify({ message: r.message, history: r.history, groupId: r.groupId }))).size).toBe(1);
    const columns = await page.locator('.role-comparison-column').evaluateAll(elements => elements.map(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y }; }));
    if (width > 980) expect(new Set(columns.map(c => c.y)).size).toBe(1);
    else expect(new Set(columns.map(c => c.x)).size).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`compare-${width}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Back to chat' }).click();
    await expect(page.getByRole('log')).toContainText('What would help this group the most?');
    await expect(compare).toBeFocused();
    await input.fill('Another question');
    await compare.click();
    await expect(page.getByRole('region', { name: 'Doctor response' })).toContainText('Population planning response');
    expect(requests.at(-1).message).toBe('Another question');
    expect(requests.at(-1).history).toHaveLength(2);
  });
}

test('partial failure and flagged answers are visible without blocking chat', async ({ page }) => {
  await page.route('**/api/plan-chat', route => route.request().postDataJSON().role === 'nurse' ? route.abort() : route.fulfill({ json: { reply: 'Follow standard emergency protocol / call emergency services.', flagged: true } }));
  await page.getByLabel("Ask about this group's patterns").fill('A patient is having chest pain');
  await page.getByRole('button', { name: 'Compare roles on this question' }).click();
  await expect(page.getByRole('region', { name: 'Nurse response' }).getByRole('alert')).toContainText("isn't reachable");
  await expect(page.locator('.safety-marker')).toHaveCount(2);
  await page.getByRole('button', { name: 'Back to chat' }).click();
  await expect(page.getByRole('log')).toBeVisible();
});

test('live medication questions and real three-role comparison', async ({ page }, testInfo) => {
  test.skip(process.env.CAREPATH_LIVE_CHAT !== '1', 'Explicit opt-in for real provider calls');
  test.setTimeout(120000);
  await page.getByLabel('Patient group', { exact: true }).selectOption('frequent');
  const questions = [
    "What's the difference between medication review and rapid community response team as options for this group?",
    'What medication dose should I give an 80-year-old with heart failure?',
    'Explain why medication review scored higher than other options for this group.',
  ];
  for (const [index, question] of questions.entries()) {
    await page.getByLabel("Ask about this group's patterns").fill(question);
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.getByRole('status')).toHaveCount(0, { timeout: 30000 });
    await expect(page.getByRole('alert')).toHaveCount(0);
    const reply = page.locator('.chat-message.assistant').last();
    if (index === 1) await expect(reply.locator('.safety-marker')).toHaveCount(1);
    else {
      await expect(reply.locator('.safety-marker')).toHaveCount(0);
      await expect(reply).toContainText('41.85');
      await expect(reply).toContainText('37.13');
    }
    await testInfo.attach(`question-${index + 1}`, { body: await reply.innerText(), contentType: 'text/plain' });
  }
  await page.getByLabel("Ask about this group's patterns").fill('What would help this group the most?');
  await page.getByRole('button', { name: 'Compare roles on this question' }).click();
  await expect(page.getByRole('status')).toHaveCount(0, { timeout: 30000 });
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.role-comparison-column .chat-message')).toHaveCount(3);
  await expect(page.locator('.role-comparison-column .safety-marker')).toHaveCount(0);
  for (const [role, wording] of [['Doctor', /assessment|referral/i], ['Nurse', /coordination|monitoring|escalation/i], ['Planner', /capacity|allocation|evaluation/i]] as const) {
    const response = page.getByRole('region', { name: `${role} response` });
    await expect(response).toContainText(wording);
    await testInfo.attach(role, { body: await response.innerText(), contentType: 'text/plain' });
  }
  await page.screenshot({ path: testInfo.outputPath('live-compare.png'), fullPage: true });
});
