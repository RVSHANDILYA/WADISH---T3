import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, HeartPulse, Stethoscope, ClipboardList, Users, Info } from 'lucide-react';
import type { Cohort } from '../types';

export type ChatMessage = { role: 'user' | 'assistant'; content: string; flagged?: boolean };
const chatRoles = [{ id: 'doctor', name: 'Doctor', icon: Stethoscope }, { id: 'nurse', name: 'Nurse', icon: HeartPulse }, { id: 'planner', name: 'Planner', icon: ClipboardList }] as const;
type RoleResult = { role: string; reply?: string; flagged?: boolean; error?: string };
const unavailable = "The guided assistant isn't reachable right now — you can switch to Manual planning above.";
function MessageBubble({ message }: { message: ChatMessage }) {
  return <div className={`chat-row ${message.role}`}>{message.role === 'assistant' && <span className="chat-avatar" aria-hidden="true"><HeartPulse size={19} /></span>}<div className={`chat-message ${message.role} ${message.flagged ? 'flagged' : ''}`}><strong>{message.role === 'user' ? 'You' : 'CarePath'}</strong>{message.flagged && <span className="safety-marker"><ShieldCheck size={16} />Planning boundary</span>}<p>{message.content}</p></div></div>;
}
const nf = new Intl.NumberFormat('en-AU', { maximumFractionDigits: 0 });
export function opening(group: Cohort): ChatMessage {
  return { role: 'assistant', content: `${group.name}: ${nf.format(group.patients)} people used ${nf.format(group.inpatientBedDays)} hospital days in 2022 (${group.inpatientBedDays} before display rounding), with ${nf.format(group.edPresentations)} ED visits. The top planning options are ${group.recommended_interventions.slice(0, 2).map(i => `${i.name} (${i.score.toFixed(1)}/100)`).join(' and ')}. These are historical yearly group patterns, not individual clinical advice.` };
}
export function PlanningChat({ group, messages, onMessages }: { group: Cohort; messages: ChatMessage[]; onMessages: (messages: ChatMessage[]) => void }) {
  const [role, setRole] = useState('planner');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [comparison, setComparison] = useState<{ question: string; results: RoleResult[] } | null>(null);
  const [comparing, setComparing] = useState(false);
  const compareRequest = useRef<AbortController>();
  const compareButton = useRef<HTMLButtonElement>(null);
  const compareHeading = useRef<HTMLHeadingElement>(null);
  const lastQuestion = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';
  const pendingSend = useRef(false);
  const failedQuestion = useRef<string | null>(null);
  const request = useRef<AbortController>();
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => () => { request.current?.abort(); compareRequest.current?.abort(); }, []);
  useEffect(() => { if (comparison) compareHeading.current?.focus(); }, [comparison?.question]);
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [messages, busy, comparison]);
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!input.trim() || busy || comparing || pendingSend.current) return;
    pendingSend.current = true;
    setComparison(null);
    const message = input.trim();
    // A retry reuses the original user turn; notices never enter conversation state.
    const retry = failedQuestion.current === message && messages.at(-1)?.role === 'user' && messages.at(-1)?.content === message;
    const context = retry ? messages.slice(0, -1) : messages;
    const next: ChatMessage[] = retry ? messages : [...messages, { role: 'user', content: message }];
    onMessages(next); setInput(''); setBusy(true); setError('');
    const controller = new AbortController(); request.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('/api/plan-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ groupId: group.id, role, message, history: context.slice(1).slice(-20).map(({ role, content }) => ({ role, content })) }) });
      if (!response.ok) throw new Error('Unavailable');
      const result = await response.json();
      if (typeof result.reply !== 'string' || typeof result.flagged !== 'boolean') throw new Error('Invalid response');
      failedQuestion.current = null;
      onMessages([...next, { role: 'assistant', content: result.reply, flagged: result.flagged }]);
    } catch { failedQuestion.current = message; setError(unavailable); }
    finally { window.clearTimeout(timeout); pendingSend.current = false; setBusy(false); }
  }
  async function compare() {
    const question = input.trim() || lastQuestion;
    if (!question || busy || comparing) return;
    const controller = new AbortController(); compareRequest.current = controller;
    setComparing(true); setComparison({ question, results: [] });
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    // When reusing the last question, exclude that question and its reply from context.
    const lastIndex = messages.map(m => m.role).lastIndexOf('user');
    const context = input.trim() ? messages : messages.slice(0, lastIndex);
    const history = context.slice(1).slice(-20).map(({ role, content }) => ({ role, content }));
    try {
      const results = await Promise.all(chatRoles.map(async ({ id }): Promise<RoleResult> => {
        try {
          const response = await fetch('/api/plan-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ groupId: group.id, role: id, message: question, history }) });
          if (!response.ok) throw new Error('Unavailable');
          const result = await response.json();
          if (typeof result.reply !== 'string' || typeof result.flagged !== 'boolean') throw new Error('Invalid response');
          return { role: id, reply: result.reply, flagged: result.flagged };
        } catch { return { role: id, error: unavailable }; }
      }));
      if (compareRequest.current === controller) setComparison({ question, results });
    } finally {
      window.clearTimeout(timeout);
      if (compareRequest.current === controller) setComparing(false);
    }
  }
  function backToChat() {
    compareRequest.current?.abort(); compareRequest.current = undefined;
    setComparison(null); setComparing(false);
    requestAnimationFrame(() => compareButton.current?.focus());
  }
  return <section className="panel chat-panel border border-slate-100 shadow-sm rounded-xl" aria-label="Guided planning assistant">
    <h2>Explore this group's planning options</h2>
    <div className="soft-note role-demo-note"><Info size={19} aria-hidden="true" /><p>Doctor / Nurse / Planner here is a demo placeholder to show how the same data can be framed differently for different roles. In a real deployment this would be driven by secure hospital login and role permissions, not a manual toggle.</p></div>
    <p id="demo-role-label">Demo role selector</p>
    <div className="explore-view-switch" role="group" aria-labelledby="demo-role-label">{['doctor', 'nurse', 'planner'].map(r => <button key={r} aria-pressed={r === role} onClick={() => setRole(r)}>{r[0].toUpperCase() + r.slice(1)}</button>)}</div>
    {comparison ? <section className="role-comparison" aria-label="Role comparison">
      <div className="comparison-heading"><h3 ref={compareHeading} tabIndex={-1}>Same question, three perspectives</h3><button type="button" className="secondary" onClick={backToChat}>Back to chat</button></div>
      <p className="comparison-question">{comparison.question}</p>
      {comparing && <p role="status">Comparing the same group data across three roles...</p>}
      <div className="role-comparison-grid">{chatRoles.map(({ id, name, icon: Icon }) => {
        const result = comparison.results.find(r => r.role === id);
        return <section className="role-comparison-column" key={id} aria-label={`${name} response`}><h4><Icon size={19} aria-hidden="true" />{name}</h4>{result?.error ? <p className="soft-note" role="alert">{result.error}</p> : result?.reply ? <MessageBubble message={{ role: 'assistant', content: result.reply, flagged: result.flagged }} /> : <p>Waiting for response...</p>}</section>;
      })}</div>
    </section> : <div className="chat-messages" ref={log} role="log" aria-label="Planning conversation" tabIndex={0}>{messages.map((m, i) => <MessageBubble message={m} key={i} />)}{busy && <p role="status">Preparing a grounded reply...</p>}</div>}
    {error && <p role="alert" className="soft-note">{error}</p>}
    <form onSubmit={send} className="chat-form"><label htmlFor="plan-question">Ask about this group's patterns</label><div><input id="plan-question" value={input} maxLength={2000} onChange={e => setInput(e.target.value)} placeholder="What planning options does the data support?" /><button className="primary" disabled={busy || comparing || !input.trim()}>Send</button><button ref={compareButton} type="button" className="secondary compare-roles-button" disabled={busy || comparing || !(input.trim() || lastQuestion)} onClick={() => void compare()}><Users size={18} aria-hidden="true" />Compare roles on this question</button></div></form>
    <p className="caption">This assistant only discusses the selected group's patterns. It does not give advice about any individual person, and it does not replace clinical judgement or emergency procedures.</p>
  </section>;
}
