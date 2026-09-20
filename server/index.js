import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
import express from 'express';
import cors from 'cors';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { boundary, filterReply, systemPrompt, fallback } from './planning.js';

export function createApp({ fetchImpl = fetch, apiKey = process.env.GEMINI_API_KEY, model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite' } = {}) {
  const app = express();
  const logFailure = (error) => {
    const redact = value => apiKey ? String(value).split(apiKey).join('[REDACTED]') : String(value);
    console.error('[CarePath plan-chat]', redact(error?.stack || error));
    if (error?.upstreamBody) console.error('[Gemini raw error]', redact(error.upstreamBody));
  };
  const failure = (message, status, code, upstreamBody) => Object.assign(new Error(message), { status, code, upstreamBody });
  app.use(cors({ origin: /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/ }));
  app.use(express.json({ limit: '32kb' }));
  app.get('/api/health', (req, res) => res.json({ status: 'ready' }));
  app.post('/api/plan-chat', async (req, res) => {
    let providerStarted = false;
    try {
    const { groupId, role, message, history = [] } = req.body ?? {};
    if (!['doctor', 'nurse', 'planner'].includes(role) || typeof message !== 'string' || !message.trim() || message.length > 2000 || !Array.isArray(history) || history.length > 20 || history.some(h => !h || !['user', 'assistant'].includes(h.role) || typeof h.content !== 'string' || h.content.length > 4000)) return res.status(400).json({ error: 'Invalid chat request.' });
      const data = JSON.parse(await readFile(new URL('../public/data/summary.json', import.meta.url), 'utf8'));
      const group = data.cohorts.find(g => g.id === groupId);
      if (!group) return res.status(400).json({ error: 'Unknown patient group.' });
      const guarded = boundary(message, group, data.cohorts);
      if (guarded) return res.json(guarded);
      if (!apiKey?.trim() || /^(placeholder|your_)/i.test(apiKey)) throw failure('GEMINI_API_KEY is missing or a placeholder', 503, 'KEY_NOT_CONFIGURED');
      // Drop unsafe history before sending any conversation to the provider.
      const safeHistory = history.filter(h => !boundary(h.content, group, data.cohorts));
      providerStarted = true;
      const response = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, signal: AbortSignal.timeout(12000),
        body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt(group, data, role) }] }, contents: [...safeHistory.map(h => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] })), { role: 'user', parts: [{ text: message }] }], generationConfig: { temperature: 0, maxOutputTokens: 4096 } }),
      });
      if (!response.ok) {
        const raw = await response.text();
        throw failure(`Gemini ${model} returned HTTP ${response.status}`, response.status === 429 ? 429 : response.status === 401 || response.status === 403 || response.status === 404 ? 503 : 502, response.status === 429 ? 'PROVIDER_QUOTA' : 'PROVIDER_ERROR', raw);
      }
      const result = await response.json();
      const candidate = result.candidates?.[0];
      const reply = candidate?.content?.parts?.map(p => p.text || '').join('').trim();
      if (result.promptFeedback?.blockReason || ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST'].includes(candidate?.finishReason)) return res.json({ reply: fallback, flagged: true });
      if (!reply || candidate?.finishReason !== 'STOP') throw failure(`Gemini returned an incomplete response (${candidate?.finishReason || 'no candidate'})`, 502, 'INCOMPLETE_RESPONSE');
      return res.json(filterReply(reply));
    } catch (error) {
      logFailure(error);
      const timedOut = ['TimeoutError', 'AbortError'].includes(error?.name);
      return res.status(timedOut ? 504 : error?.status || (providerStarted ? 502 : 500)).json({ error: 'Guided assistant unavailable.', code: timedOut ? 'PROVIDER_TIMEOUT' : error?.code || 'INTERNAL_ERROR' });
    }
  });
  app.use((error, req, res, next) => {
    logFailure(error);
    res.status(error?.status === 413 ? 413 : 400).json({ error: 'Invalid chat request.', code: 'INVALID_REQUEST' });
  });
  return app;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT) || 3001;
  console.log(`[CarePath startup] GEMINI_API_KEY loaded: ${Boolean(process.env.GEMINI_API_KEY?.trim())}; model: ${process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'}; port: ${port}`);
  createApp().listen(port, '127.0.0.1', () => console.log(`CarePath planning server ready at http://127.0.0.1:${port}`)).on('error', error => { console.error('[CarePath startup]', error.stack); process.exitCode = 1; });
}
