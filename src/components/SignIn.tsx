import { useState, type FormEvent } from "react";
import { ArrowRight, HeartPulse, ShieldCheck, Check, Accessibility } from "lucide-react";
import { roles, type DemoSession, type RoleId } from "../lib/session";
import type { Summary } from "../types";

export function SignIn({ data, onSignIn, onAccessibility }: {
  data: Summary; onSignIn: (session: DemoSession) => void; onAccessibility: () => void;
}) {
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState<RoleId | "">("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (roleId) onSignIn({ name: name.trim() || "Guest reviewer", roleId });
  };
  return <main id="main-content" tabIndex={-1} className="signin-page">
    <section className="signin-form-side">
      <div className="signin-top"><div className="brand"><span className="brand-mark"><HeartPulse /></span><strong>CarePath</strong></div><button className="icon-button" aria-label="Accessibility settings" onClick={onAccessibility}><Accessibility size={21} /></button></div>
      <div className="signin-content">
        <span className="eyebrow">A clearer view of care</span>
        <h1>Welcome to CarePath.</h1>
        <p>Understand the patterns. Find where support could make a difference.</p>
        <form onSubmit={submit}>
          <label className="signin-name" htmlFor="reviewer-name">Your name <span>(optional)</span></label>
          <input id="reviewer-name" name="name" autoComplete="off" maxLength={60} placeholder="What should we call you?" value={name} onChange={e => setName(e.target.value)} />
          <fieldset className="role-choices"><legend>What brings you here?</legend>{roles.map(role =>
            <label className={roleId === role.id ? "role-choice selected" : "role-choice"} key={role.id}>
              <input type="radio" name="role" value={role.id} checked={roleId === role.id} onChange={() => setRoleId(role.id)} required />
              <span><strong>{role.name}</strong><small>{role.description}</small></span>
              {roleId === role.id && <Check size={18} aria-hidden="true" />}
            </label>
          )}</fieldset>
          <button className="primary full" disabled={!roleId} type="submit">Open CarePath <ArrowRight size={19} /></button>
        </form>
        <p className="signin-demo"><ShieldCheck size={17} /><span>Demo only — no password needed. Your role and name stay in this tab.</span></p>
      </div>
      <p className="signin-footer">WA Health & Care Hackathon 2026</p>
    </section>
    <aside className="signin-story">
      <div className="signin-orbit" aria-hidden="true"><HeartPulse size={56} /></div>
      <div className="signin-story-content"><span className="eyebrow">Behind every visit, a bigger picture.</span><h2>Different patterns.<br />More thoughtful care.</h2><p>Some people visit often. Others visit rarely but stay longer. CarePath brings both into focus.</p><div className="signin-proof"><strong>{Math.round(data.metrics.topTenBedDayShare * 100)}%</strong><span>of hospital days are used by the 10% of people with the most hospital time.</span></div><div className="signin-context"><span>{data.metrics.patients.toLocaleString("en-AU")} people aged 65+</span><span>Synthetic 2022 data</span></div></div>
    </aside>
  </main>;
}
