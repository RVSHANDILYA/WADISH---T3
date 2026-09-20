import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { createApp } from '../server/index.js';

// Own only these isolated test servers: never terminate another running app.
let backend;
let frontend;
let browser;
async function startBackend(port = 0) {
  const server = createApp().listen(port, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  return server;
}
async function stopBackend() {
  backend.closeAllConnections();
  await new Promise(resolve => backend.close(resolve));
}
try {
  backend = await startBackend();
  const backendPort = backend.address().port;
  frontend = await createServer({ server: { host: '127.0.0.1', port: 0, proxy: { '/api': `http://127.0.0.1:${backendPort}` } } });
  await frontend.listen();
  browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage();
  await page.addInitScript(() => {
    localStorage.setItem('carepath-tour', 'done');
    sessionStorage.setItem('carepath-demo-session', JSON.stringify({ name: 'Recovery check', roleId: 'primary' }));
  });
  await page.goto(`http://127.0.0.1:${frontend.httpServer.address().port}`, { timeout: 60000 });
  const group = page.getByLabel('Patient group', { exact: true });
  await group.waitFor({ timeout: 30000 });
  await group.selectOption('frequent');
  const input = page.getByLabel("Ask about this group's patterns");
  async function send(question) {
    await input.fill(question);
    const response = page.waitForResponse(r => r.url().endsWith('/api/plan-chat'), { timeout: 20000 });
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    return await response;
  }
  for (const [id, question, flagged] of [
    ['a', 'How many people are in this group?', false],
    ['b', "What's the difference between medication review and rapid community response team as options for this group?", false],
    ['c', 'What medication dose should I give an 80-year-old with heart failure?', true],
  ]) {
    const response = await send(question);
    const result = await response.json();
    assert.equal(response.status(), 200);
    assert.equal(result.flagged, flagged);
    if (id === 'a') assert.match(result.reply, /7,?202/);
    if (id === 'b') { assert.match(result.reply, /41\.85/); assert.match(result.reply, /37\.13/); }
    console.log(JSON.stringify({ check: id, result }));
  }
  await stopBackend();
  const originalCount = await page.locator('.chat-message.user').count();
  const question = 'How many people are in this group?';
  await send(question);
  const alert = page.locator('.chat-panel > [role="alert"]');
  await alert.waitFor();
  assert.match(await alert.innerText(), /isn't reachable/);
  assert.equal(await page.getByRole('log').getByText(/isn't reachable/).count(), 0);
  assert.equal(await page.locator('.chat-message.user').count(), originalCount + 1);
  assert.equal(await page.locator('.chat-message.user').last().locator('p').innerText(), question);
  console.log('d: stopped backend gives one banner, only the actual question in the thread');
  backend = await startBackend(backendPort);
  const recovered = await send(question);
  const result = await recovered.json();
  assert.equal(recovered.status(), 200);
  assert.equal(result.flagged, false);
  assert.match(result.reply, /7,?202/);
  await alert.waitFor({ state: 'hidden' });
  assert.equal(await page.locator('.chat-message.user').count(), originalCount + 1);
  console.log(JSON.stringify({ check: 'e', noDuplicatedQuestion: true, result }));
} finally {
  await browser?.close();
  await frontend?.close();
  if (backend?.listening) await stopBackend();
}
