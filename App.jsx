import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ShieldCheck, ShieldAlert, ShieldX, Power, X, Send, MessageSquare,
  CheckCircle2, Users, Ban, RefreshCw, Plus, Trash2, AlertTriangle,
  LogOut, Sliders, MapPin, Loader2, ChevronRight, Activity, TrendingUp,
  Layers, History, Building2, Lock,
} from "lucide-react";

// ============================================================
// CONFIG — Supabase project (anon key, safe for client use; RLS enforces isolation)
// ============================================================
const SUPABASE_URL = "https://xquwjwohteuckzbjfpuy.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxdXdqd29odGV1Y2t6YmpmcHV5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MTk2ODcsImV4cCI6MjA5ODk5NTY4N30.eXJnvg9FZNL4wuL0SE7wpNn3f-V2GO6NuhCaMLkER-o";

// ============================================================
// DESIGN TOKENS
// ============================================================
const C = {
  bg: "#14181D", panel: "#1B2129", panelAlt: "#20272F",
  border: "#2A323C", borderLight: "#333C48",
  text: "#EDEFF2", textMuted: "#8B94A3", textFaint: "#5B6472",
  amber: "#F2A93B", amberBg: "rgba(242,169,59,0.12)",
  teal: "#35B9A0", tealBg: "rgba(53,185,160,0.12)",
  coral: "#E8654F", coralBg: "rgba(232,101,79,0.12)",
  violet: "#9D8CF2", violetBg: "rgba(157,140,242,0.14)",
};

const STAGE_ORDER = ["not_contacted", "contacted", "followed_up", "replied", "qualified", "booked", "opted_out"];
const STAGE_LABEL = { not_contacted: "Not Contacted", contacted: "Contacted", followed_up: "Followed Up", replied: "Replied", qualified: "Qualified", booked: "Booked", opted_out: "Opted Out" };
const STATUS_CONFIG = {
  cleared: { label: "Cleared", color: C.teal, bg: C.tealBg, icon: ShieldCheck },
  review: { label: "Manual Review", color: C.amber, bg: C.amberBg, icon: ShieldAlert },
  suppressed: { label: "Suppressed", color: C.coral, bg: C.coralBg, icon: ShieldX },
  pending: { label: "Not Evaluated", color: C.textFaint, bg: "rgba(139,148,163,0.1)", icon: ShieldAlert },
};
const REVIEW_ACTIONS = {
  no_record: { label: "Request consent capture", hint: "Routes to re-consent queue — needs a fresh opt-in, not a sign-off." },
  not_verbatim: { label: "Verify consent language", hint: "Pulls archived form copy for the source this lead came from." },
  stale: { label: "Send to legal for sign-off", hint: "Routes to legal review — consent age exceeds the regional freshness cap." },
};
const DEFAULT_OBJECTIONS = [
  { trigger: "expensive|price|cost|afford|too much", response: "Totally understand — pricing is often the biggest factor. I can send an updated breakdown with current numbers, no obligation. Want me to put that together?\n\nReply STOP to opt out." },
  { trigger: "scam|fraud|trust|sketchy|legit", response: "Fair thing to ask — we're a licensed, reviewed business and happy to share references before you decide anything. No pressure either way.\n\nReply STOP to opt out." },
  { trigger: "busy|later|not right now|bad time", response: "No problem at all. Want me to check back in a few weeks instead?\n\nReply STOP to opt out." },
  { trigger: "already|competitor|someone else|went with", response: "Totally understand — if you ever want a second opinion down the line, happy to help.\n\nReply STOP to opt out." },
];
const REPLY_OPTIONS = [
  { key: "interested", label: "\u201cYeah, still interested — what's next?\u201d", text: "Yeah, still interested — what's next?", tier: "A", intent: true },
  { key: "price", label: "\u201cWhat's this going to cost?\u201d", text: "What's this going to cost, roughly?", tier: "B_config", intent: false },
  { key: "financing", label: "\u201cDo you offer payment plans?\u201d", text: "Do you offer any financing or payment plans?", tier: "B_human", intent: false },
  { key: "obj_trust", label: "\u201cI've heard mixed things about companies like this.\u201d", text: "Honestly I've heard mixed things about companies like this.", tier: "objection", intent: false },
  { key: "obj_timing", label: "\u201cNow's not really a good time.\u201d", text: "Now's not really a good time.", tier: "objection", intent: false },
  { key: "book", label: "\u201cLet's schedule a call.\u201d", text: "Sure, let's schedule a call this week.", tier: "A", intent: true },
  { key: "stop", label: "\u201cSTOP — please don't contact me.\u201d", text: "STOP", tier: null, intent: false, isStop: true },
];

// ============================================================
// SUPABASE HELPERS (raw REST — supabase-js isn't available in this sandbox)
// ============================================================
async function supaAuth(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Sign in failed. Check email and password.");
  return data;
}

async function supaRest(path, { method = "GET", token, body, prefer } = {}) {
  const headers = { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  if (prefer) headers["Prefer"] = prefer;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { const j = await res.json(); msg = j.message || j.hint || msg; } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function callClaude(userPrompt, systemPrompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 600, system: systemPrompt, messages: [{ role: "user", content: userPrompt }] }),
  });
  const data = await res.json();
  return data.content?.[0]?.text?.trim() || "";
}

// ============================================================
// COMPLIANCE + SCORING (industry-agnostic — reads tenant + regional rules)
// ============================================================
function computeCompliance(lead, rules, tenant) {
  if (lead.consent_opt_out) return { status: "suppressed", reason: "Opt out on record — permanently suppressed.", subReason: "opt_out" };
  if (!lead.consent_has_record) return { status: "review", reason: "No consent record on file. Cannot contact without verification.", subReason: "no_record" };
  if (!lead.consent_verbatim) return { status: "review", reason: "Consent exists but the exact wording wasn't archived.", subReason: "not_verbatim" };
  const rule = rules.find((r) => r.active && (r.region_code || "").toLowerCase() === (lead.state_country || "").toLowerCase());
  const globalCap = tenant?.consent_freshness_months ?? 18;
  const cap = rule?.freshness_cap_months != null ? Math.min(globalCap, rule.freshness_cap_months) : globalCap;
  if ((lead.months_cold || 0) > cap) {
    return { status: "review", reason: `Consent is ${lead.months_cold}mo old — exceeds the ${rule ? rule.region_name || rule.region_code : "default"} cap of ${cap}mo. Needs sign-off.`, subReason: "stale" };
  }
  if (rule?.requires_dnc_check) {
    return { status: "cleared", reason: `Cleared. ${rule.region_name || rule.region_code} requires a Do Not Call registry check — confirm via your dialer/compliance provider before calling.`, subReason: null, dncReminder: true };
  }
  return { status: "cleared", reason: "Consent on file, verbatim, within the freshness window.", subReason: null };
}

function scoreLead(lead) {
  const recency = Math.max(100 - (lead.months_cold || 0) * 4, 0);
  const stageIdx = STAGE_ORDER.indexOf(lead.pipeline_stage);
  const stage = stageIdx >= 0 ? (stageIdx / (STAGE_ORDER.length - 2)) * 100 : 25;
  const confidence = lead.data_verified ? 100 : 65;
  const weights = { recency: 0.4, stage: 0.35, confidence: 0.25 };
  const total = Math.round(recency * weights.recency + Math.min(stage, 100) * weights.stage + confidence * weights.confidence);
  return { recency, stage: Math.min(stage, 100), confidence, weights, total: Math.max(0, Math.min(total, 100)) };
}

function buildSystemPrompt(tenant) {
  const company = tenant.company_name || "the company";
  const industry = tenant.industry || "service";
  const objections = (tenant.objection_scripts?.length ? tenant.objection_scripts : DEFAULT_OBJECTIONS)
    .map((o, i) => `Objection ${i + 1} — triggers on [${o.trigger}]: "${o.response}"`).join("\n\n");
  const doNotSay = (tenant.do_not_say?.length ? tenant.do_not_say : ["guaranteed savings", "free money", "no cost to you"]).join(", ");
  const programLines = [
    tenant.federal_credit && `- Federal/incentive credit: ${tenant.federal_credit}`,
    tenant.active_promo && `- Active promo: ${tenant.active_promo}`,
    tenant.panel_model && `- Product/model referenced: ${tenant.panel_model}`,
  ].filter(Boolean).join("\n");
  return `You are an AI re-engagement agent for ${company}, a ${industry} business. You communicate on behalf of ${tenant.owner_name || "the team"}.

VOICE: ${tenant.voice_profile ? `Tone: ${tenant.voice_profile.tone}, Formality: ${tenant.voice_profile.formality}.` : tenant.voice_sample ? `Mirror this style: "${tenant.voice_sample.slice(0, 250)}"` : "Warm, honest, straightforward. Never pushy or salesy."}

OBJECTION SCRIPTS — use EXACT responses when triggered:
${objections}
${programLines ? `\nPROGRAM / PRICING DETAILS (never deviate from these, never invent numbers):\n${programLines}` : "\nNo pricing/program details are configured — do not invent numbers. Offer to have someone follow up with exact figures instead."}

NEVER SAY: ${doNotSay}

Keep every message short (2-3 sentences max) and always end with "Reply STOP to opt out." unless told otherwise.`;
}

// ============================================================
// SMALL UI PRIMITIVES
// ============================================================
function Banner({ color, bg, icon, text }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 16px", background: bg, borderBottom: `1px solid ${color}33`, color, fontSize: 12.5, fontWeight: 600 }}>{icon}{text}</div>;
}
function Field({ label, value }) {
  return <div><div style={{ fontSize: 11, color: C.textFaint, fontWeight: 500, marginBottom: 2 }}>{label}</div><div style={{ fontSize: 13, fontWeight: 500 }}>{value ?? "—"}</div></div>;
}
function ScoreBar({ label, value, weight }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.textMuted, marginBottom: 2 }}>
        <span>{label} <span className="mono">({Math.round(weight * 100)}%)</span></span><span className="mono">{Math.round(value)}</span>
      </div>
      <div style={{ height: 5, background: C.border, borderRadius: 999, overflow: "hidden" }}><div style={{ height: "100%", width: `${value}%`, background: C.amber }} /></div>
    </div>
  );
}
function Btn({ children, onClick, variant = "default", disabled, style, type = "button" }) {
  const variants = {
    default: { background: C.panelAlt, color: C.text, border: `1px solid ${C.border}` },
    primary: { background: C.teal, color: C.bg, border: "none", fontWeight: 700 },
    danger: { background: C.coralBg, color: C.coral, border: `1px solid ${C.coral}55` },
    ghost: { background: "transparent", color: C.textMuted, border: `1px solid ${C.border}` },
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className="cp"
      style={{ padding: "9px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.55 : 1, display: "inline-flex", alignItems: "center", gap: 6, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}
function Input({ label, ...props }) {
  return (
    <label style={{ display: "block", marginBottom: 10 }}>
      {label && <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4, fontWeight: 600 }}>{label}</div>}
      <input {...props} style={{ width: "100%", padding: "9px 11px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.panelAlt, color: C.text, fontSize: 13, fontFamily: "inherit", ...(props.style || {}) }} />
    </label>
  );
}
function Select({ label, children, ...props }) {
  return (
    <label style={{ display: "block", marginBottom: 10 }}>
      {label && <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4, fontWeight: 600 }}>{label}</div>}
      <select {...props} style={{ width: "100%", padding: "9px 11px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.panelAlt, color: C.text, fontSize: 13, fontFamily: "inherit" }}>{children}</select>
    </label>
  );
}
function Toggle({ checked, onChange, label }) {
  return (
    <div onClick={() => onChange(!checked)} style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", userSelect: "none" }}>
      <div style={{ width: 34, height: 19, borderRadius: 999, background: checked ? C.teal : C.border, position: "relative", transition: "background 0.15s", flexShrink: 0 }}>
        <div style={{ width: 15, height: 15, borderRadius: "50%", background: C.text, position: "absolute", top: 2, left: checked ? 17 : 2, transition: "left 0.15s" }} />
      </div>
      {label && <span style={{ fontSize: 12.5, color: C.textMuted }}>{label}</span>}
    </div>
  );
}

// ============================================================
// LOGIN SCREEN
// ============================================================
function LoginScreen({ onSignedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const auth = await supaAuth(email.trim(), password);
      onSignedIn(auth);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter', sans-serif", color: C.text }}>
      <style>{`* { box-sizing: border-box; } .cp { font-family: 'Chakra Petch', sans-serif; }`}</style>
      <form onSubmit={handleSubmit} style={{ width: 340, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <ShieldCheck size={20} color={C.teal} />
          <span className="cp" style={{ fontSize: 17, fontWeight: 700 }}>Revenue OS</span>
        </div>
        <div style={{ fontSize: 12.5, color: C.textMuted, marginBottom: 22 }}>Sign in to your workspace</div>
        <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
        <Input label="Password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
        {error && <div style={{ fontSize: 12, color: C.coral, marginBottom: 12, display: "flex", gap: 6, alignItems: "flex-start" }}><AlertTriangle size={13} style={{ marginTop: 1, flexShrink: 0 }} />{error}</div>}
        <Btn type="submit" variant="primary" disabled={loading} style={{ width: "100%", justifyContent: "center", padding: "11px" }}>
          {loading ? <Loader2 size={14} className="spin" /> : <Lock size={13} />} {loading ? "Signing in…" : "Sign in"}
        </Btn>
        <div style={{ fontSize: 11, color: C.textFaint, marginTop: 16, lineHeight: 1.5 }}>Accounts are provisioned directly in Supabase — there's no self-serve signup yet.</div>
      </form>
      <style>{`.spin { animation: spin 0.8s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ============================================================
// LEAD DETAIL PANEL
// ============================================================
function LeadDetailPanel({ lead, tenant, rules, capacity, messages, aiLoading, onClose, onAction }) {
  if (!lead) return null;
  const compliance = computeCompliance(lead, rules, tenant);
  const score = scoreLead(lead);
  const cfg = STATUS_CONFIG[compliance.status];
  const Icon = cfg.icon;
  const reviewAction = REVIEW_ACTIONS[compliance.subReason];
  const canSend = compliance.status === "cleared" && lead.pipeline_stage === "not_contacted";
  const canFollowUp = compliance.status === "cleared" && lead.pipeline_stage === "contacted";
  const canReply = compliance.status === "cleared" && ["contacted", "followed_up"].includes(lead.pipeline_stage);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", justifyContent: "flex-end", zIndex: 50 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 420, maxWidth: "92vw", height: "100%", background: C.panel, borderLeft: `1px solid ${C.border}`, padding: 22, overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <div>
            <div className="cp" style={{ fontSize: 17, fontWeight: 700 }}>{lead.name}</div>
            <div style={{ fontSize: 12, color: C.textMuted }}>{lead.city}{lead.city && lead.state_country ? ", " : ""}{lead.state_country}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.textMuted, cursor: "pointer" }}><X size={18} /></button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 16, padding: "9px 12px", borderRadius: 8, background: cfg.bg, border: `1px solid ${cfg.color}33` }}>
          <Icon size={16} color={cfg.color} /><span style={{ fontWeight: 700, fontSize: 13, color: cfg.color }}>{cfg.label.toUpperCase()}</span>
        </div>
        <div style={{ fontSize: 13, color: C.textMuted, marginTop: 8, lineHeight: 1.5 }}>{compliance.reason}</div>

        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Pipeline stage" value={STAGE_LABEL[lead.pipeline_stage]} />
          <Field label="Cold reason" value={lead.cold_reason} />
          <Field label="Last stage" value={lead.last_stage} />
          <Field label="Deal size / notes" value={lead.system_size} />
        </div>

        <div style={{ marginTop: 14, background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>LEAD SCORE: {score.total}/100</div>
          <ScoreBar label="Recency" value={score.recency} weight={score.weights.recency} />
          <ScoreBar label="Funnel depth" value={score.stage} weight={score.weights.stage} />
          <ScoreBar label="Data confidence" value={score.confidence} weight={score.weights.confidence} />
        </div>

        {!lead.data_verified && compliance.status !== "suppressed" && (
          <Btn onClick={() => onAction("verify", lead)} style={{ width: "100%", justifyContent: "center", marginTop: 12 }}><RefreshCw size={13} /> RE-VERIFY DATA</Btn>
        )}
        {compliance.status === "review" && reviewAction && (
          <Btn onClick={() => onAction("review", lead, compliance)} variant="primary" style={{ width: "100%", justifyContent: "center", marginTop: 12, background: C.amber }}>{reviewAction.label.toUpperCase()}</Btn>
        )}
        {compliance.status === "suppressed" && (
          <div style={{ marginTop: 12, fontSize: 12, color: C.coral, fontStyle: "italic", display: "flex", alignItems: "center", gap: 6 }}><Ban size={13} /> Opt-out is permanent.</div>
        )}

        {compliance.status === "cleared" && (
          <>
            <div className="cp" style={{ fontSize: 13, fontWeight: 700, marginTop: 20, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><MessageSquare size={14} /> CONVERSATION</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12, maxHeight: 260, overflowY: "auto" }}>
              {messages.length === 0 && <div style={{ fontSize: 12, color: C.textFaint }}>No messages sent yet.</div>}
              {messages.map((m) => (
                <div key={m.id} style={{ alignSelf: m.from_role === "lead" ? "flex-end" : "flex-start", maxWidth: "88%", padding: "9px 12px", borderRadius: 10, background: m.from_role === "lead" ? C.amber : m.from_role === "system" ? C.coralBg : C.panelAlt, color: m.from_role === "lead" ? C.bg : m.from_role === "system" ? C.coral : C.text, fontSize: 13, border: m.from_role !== "lead" ? `1px solid ${C.border}` : "none", whiteSpace: "pre-wrap" }}>
                  {m.content}
                </div>
              ))}
              {aiLoading && <div style={{ fontSize: 12, color: C.textFaint, fontStyle: "italic" }}>AI generating response…</div>}
            </div>
            {canSend && <Btn onClick={() => onAction("send", lead)} disabled={aiLoading} variant="primary" style={{ width: "100%", justifyContent: "center" }}><Send size={14} /> SEND INITIAL OUTREACH</Btn>}
            {canFollowUp && <Btn onClick={() => onAction("followup", lead)} disabled={aiLoading} style={{ width: "100%", justifyContent: "center", marginTop: 8 }}>SEND FOLLOW-UP</Btn>}
            {canReply && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>Simulate the lead's reply:</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {REPLY_OPTIONS.map((opt) => (
                    <button key={opt.key} onClick={() => onAction("reply", lead, opt)} disabled={aiLoading} style={{ textAlign: "left", padding: "9px 12px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.panelAlt, color: C.text, fontSize: 12.5, cursor: "pointer", opacity: aiLoading ? 0.5 : 1 }}>{opt.label}</button>
                  ))}
                </div>
              </div>
            )}
            {lead.pipeline_stage === "booked" && <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6, color: C.teal, fontSize: 13, fontWeight: 700 }}><CheckCircle2 size={15} /> Consultation booked</div>}
            {lead.pipeline_stage === "opted_out" && <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6, color: C.coral, fontSize: 13, fontWeight: 700 }}><Ban size={15} /> Opted out — suppressed</div>}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// ADD LEAD MODAL
// ============================================================
function AddLeadModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: "", email: "", phone: "", city: "", state_country: "", cold_reason: "", territory: "", last_stage: "", system_size: "", months_cold: 0, consent_has_record: false, consent_verbatim: false });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 420, maxWidth: "92vw", maxHeight: "88vh", overflowY: "auto", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 12, padding: 22 }}>
        <div className="cp" style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Add lead</div>
        <Input label="Name" required value={form.name} onChange={set("name")} />
        <Input label="Email" value={form.email} onChange={set("email")} />
        <Input label="Phone" value={form.phone} onChange={set("phone")} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Input label="City" value={form.city} onChange={set("city")} />
          <Input label="State / region code" value={form.state_country} onChange={set("state_country")} placeholder="e.g. CA" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Input label="Cold reason" value={form.cold_reason} onChange={set("cold_reason")} placeholder="e.g. price objection" />
          <Input label="Months cold" type="number" value={form.months_cold} onChange={set("months_cold")} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Input label="Territory" value={form.territory} onChange={set("territory")} />
          <Input label="Last stage" value={form.last_stage} onChange={set("last_stage")} placeholder="e.g. Quote Sent" />
        </div>
        <Input label="Deal size / notes" value={form.system_size} onChange={set("system_size")} />
        <div style={{ display: "flex", gap: 16, margin: "10px 0 16px" }}>
          <Toggle checked={form.consent_has_record} onChange={(v) => setForm((f) => ({ ...f, consent_has_record: v }))} label="Has consent record" />
          <Toggle checked={form.consent_verbatim} onChange={(v) => setForm((f) => ({ ...f, consent_verbatim: v }))} label="Verbatim archived" />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Btn onClick={onClose} variant="ghost">Cancel</Btn>
          <Btn onClick={() => form.name && onCreate(form)} variant="primary">Add lead</Btn>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// LEADS VIEW
// ============================================================
function LeadsView({ leads, tenant, rules, capacity, selectedId, setSelectedId, onAddLead }) {
  const [showAdd, setShowAdd] = useState(false);
  const withCompliance = useMemo(() => leads.map((l) => ({ ...l, _compliance: computeCompliance(l, rules, tenant), _score: scoreLead(l).total })), [leads, rules, tenant]);
  const counts = useMemo(() => { const c = { cleared: 0, review: 0, suppressed: 0 }; withCompliance.forEach((l) => c[l._compliance.status]++); return c; }, [withCompliance]);

  return (
    <div style={{ padding: "20px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <div className="cp" style={{ fontSize: 18, fontWeight: 700 }}>Leads</div>
          <div style={{ fontSize: 12.5, color: C.textMuted }}>{leads.length} total · {counts.cleared} cleared · {counts.review} in review · {counts.suppressed} suppressed</div>
        </div>
        <Btn variant="primary" onClick={() => setShowAdd(true)}><Plus size={13} /> Add lead</Btn>
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
        {withCompliance.length === 0 && <div style={{ padding: 24, textAlign: "center", color: C.textFaint, fontSize: 13 }}>No leads yet. Add one, or import from your CRM.</div>}
        {withCompliance.map((lead, i) => {
          const cfg = STATUS_CONFIG[lead._compliance.status]; const Icon = cfg.icon;
          return (
            <div key={lead.id} onClick={() => setSelectedId(lead.id)} className="card"
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", borderBottom: i < withCompliance.length - 1 ? `1px solid ${C.border}` : "none", cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Icon size={15} color={cfg.color} />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>{lead.name}</div>
                  <div style={{ fontSize: 11.5, color: C.textFaint }}>{lead.city}{lead.city && lead.state_country ? ", " : ""}{lead.state_country} · {STAGE_LABEL[lead.pipeline_stage]}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 999, background: cfg.bg, color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
                <span className="mono" style={{ fontSize: 12, color: C.textMuted, width: 30, textAlign: "right" }}>{lead._score}</span>
                <ChevronRight size={14} color={C.textFaint} />
              </div>
            </div>
          );
        })}
      </div>
      {showAdd && <AddLeadModal onClose={() => setShowAdd(false)} onCreate={(f) => { onAddLead(f); setShowAdd(false); }} />}
    </div>
  );
}

// ============================================================
// COMPLIANCE GATE VIEW
// ============================================================
function ComplianceGateView({ tenant, rules, onUpdateTenant, onAddRule, onUpdateRule, onDeleteRule, onTogglePause }) {
  const [policyDraft, setPolicyDraft] = useState({ consent_freshness_months: tenant.consent_freshness_months, dormancy_reset_months: tenant.dormancy_reset_months });
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState({ region_code: "", region_name: "", freshness_cap_months: 18, risk_level: "medium", requires_dnc_check: true, requires_written_consent: false, notes: "" });

  useEffect(() => { setPolicyDraft({ consent_freshness_months: tenant.consent_freshness_months, dormancy_reset_months: tenant.dormancy_reset_months }); }, [tenant.id]);

  const policyChanged = policyDraft.consent_freshness_months != tenant.consent_freshness_months || policyDraft.dormancy_reset_months != tenant.dormancy_reset_months;

  return (
    <div style={{ padding: "20px 24px", maxWidth: 900 }}>
      <div className="cp" style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Compliance Gate</div>
      <div style={{ fontSize: 12.5, color: C.textMuted, marginBottom: 20 }}>Global policy and regional rules that decide whether a lead can be contacted.</div>

      {/* Kill switch */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}><Power size={14} color={tenant.active ? C.teal : C.coral} /> Outreach status</div>
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>{tenant.active ? "Live — cleared leads can be contacted." : "Paused — no outreach will send until resumed."}</div>
        </div>
        <Btn onClick={onTogglePause} style={{ borderColor: tenant.active ? `${C.teal}66` : `${C.coral}66`, color: tenant.active ? C.teal : C.coral, background: tenant.active ? C.tealBg : C.coralBg }}>
          {tenant.active ? "PAUSE OUTREACH" : "RESUME OUTREACH"}
        </Btn>
      </div>

      {/* Global policy */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18, marginBottom: 18 }}>
        <div className="cp" style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}><Sliders size={14} /> GLOBAL POLICY</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Input label="Default consent freshness cap (months)" type="number" value={policyDraft.consent_freshness_months}
            onChange={(e) => setPolicyDraft((p) => ({ ...p, consent_freshness_months: e.target.value }))} />
          <Input label="Dormancy reset threshold (months)" type="number" value={policyDraft.dormancy_reset_months}
            onChange={(e) => setPolicyDraft((p) => ({ ...p, dormancy_reset_months: e.target.value }))} />
        </div>
        <div style={{ fontSize: 11.5, color: C.textFaint, marginTop: 2, marginBottom: 12, lineHeight: 1.5 }}>
          A regional rule below can tighten this cap further (the stricter of the two always wins) but can't loosen it.
        </div>
        <Btn variant="primary" disabled={!policyChanged || savingPolicy} onClick={async () => {
          setSavingPolicy(true);
          await onUpdateTenant({ consent_freshness_months: Number(policyDraft.consent_freshness_months), dormancy_reset_months: Number(policyDraft.dormancy_reset_months) });
          setSavingPolicy(false);
        }}>{savingPolicy ? "Saving…" : "Save policy"}</Btn>
      </div>

      {/* Regional rules */}
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div className="cp" style={{ fontSize: 13.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><MapPin size={14} /> REGIONAL RULES</div>
          <Btn onClick={() => setShowAddRule((s) => !s)}><Plus size={13} /> Add region</Btn>
        </div>

        {showAddRule && (
          <div style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, marginBottom: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Input label="Region code" placeholder="e.g. CA" value={newRule.region_code} onChange={(e) => setNewRule((r) => ({ ...r, region_code: e.target.value }))} />
              <Input label="Region name" placeholder="e.g. California" value={newRule.region_name} onChange={(e) => setNewRule((r) => ({ ...r, region_name: e.target.value }))} />
              <Input label="Freshness cap (months)" type="number" value={newRule.freshness_cap_months} onChange={(e) => setNewRule((r) => ({ ...r, freshness_cap_months: e.target.value }))} />
              <Select label="Risk level" value={newRule.risk_level} onChange={(e) => setNewRule((r) => ({ ...r, risk_level: e.target.value }))}>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
              </Select>
            </div>
            <div style={{ display: "flex", gap: 18, margin: "4px 0 10px" }}>
              <Toggle checked={newRule.requires_dnc_check} onChange={(v) => setNewRule((r) => ({ ...r, requires_dnc_check: v }))} label="Requires DNC check" />
              <Toggle checked={newRule.requires_written_consent} onChange={(v) => setNewRule((r) => ({ ...r, requires_written_consent: v }))} label="Requires written consent" />
            </div>
            <Input label="Notes" value={newRule.notes} onChange={(e) => setNewRule((r) => ({ ...r, notes: e.target.value }))} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <Btn variant="ghost" onClick={() => setShowAddRule(false)}>Cancel</Btn>
              <Btn variant="primary" disabled={!newRule.region_code} onClick={async () => {
                await onAddRule({ ...newRule, freshness_cap_months: Number(newRule.freshness_cap_months) });
                setNewRule({ region_code: "", region_name: "", freshness_cap_months: 18, risk_level: "medium", requires_dnc_check: true, requires_written_consent: false, notes: "" });
                setShowAddRule(false);
              }}>Add rule</Btn>
            </div>
          </div>
        )}

        {rules.length === 0 && <div style={{ fontSize: 12.5, color: C.textFaint, padding: "8px 0" }}>No regional rules yet — leads fall back to the global policy above.</div>}
        {rules.map((rule) => (
          <RuleRow key={rule.id} rule={rule} onUpdate={(patch) => onUpdateRule(rule.id, patch)} onDelete={() => onDeleteRule(rule.id)} />
        ))}
      </div>
    </div>
  );
}

function RuleRow({ rule, onUpdate, onDelete }) {
  const riskColor = { low: C.teal, medium: C.amber, high: C.coral }[rule.risk_level] || C.textMuted;
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, marginBottom: 10, background: C.panelAlt }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="cp" style={{ fontWeight: 700, fontSize: 13 }}>{rule.region_name || rule.region_code}</span>
          <span className="mono" style={{ fontSize: 10.5, color: C.textFaint }}>{rule.region_code}</span>
          <span style={{ fontSize: 10.5, padding: "2px 8px", borderRadius: 999, background: `${riskColor}22`, color: riskColor, fontWeight: 600 }}>{rule.risk_level?.toUpperCase()} RISK</span>
          {!rule.active && <span style={{ fontSize: 10.5, padding: "2px 8px", borderRadius: 999, background: C.border, color: C.textFaint }}>INACTIVE</span>}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <Toggle checked={rule.active} onChange={(v) => onUpdate({ active: v })} />
          <button onClick={onDelete} style={{ background: "none", border: "none", color: C.textFaint, cursor: "pointer" }}><Trash2 size={14} /></button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
        <Input label="Freshness cap (months)" type="number" defaultValue={rule.freshness_cap_months} onBlur={(e) => onUpdate({ freshness_cap_months: Number(e.target.value) })} />
        <Select label="Risk level" defaultValue={rule.risk_level} onChange={(e) => onUpdate({ risk_level: e.target.value })}>
          <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
        </Select>
      </div>
      <div style={{ display: "flex", gap: 18, marginBottom: 8 }}>
        <Toggle checked={rule.requires_dnc_check} onChange={(v) => onUpdate({ requires_dnc_check: v })} label="Requires DNC check" />
        <Toggle checked={rule.requires_written_consent} onChange={(v) => onUpdate({ requires_written_consent: v })} label="Requires written consent" />
      </div>
      {rule.notes && <div style={{ fontSize: 11.5, color: C.textMuted, fontStyle: "italic" }}>{rule.notes}</div>}
    </div>
  );
}

// ============================================================
// ACTIVITY VIEW
// ============================================================
function ActivityView({ log }) {
  return (
    <div style={{ padding: "20px 24px" }}>
      <div className="cp" style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Activity</div>
      <div style={{ fontSize: 12.5, color: C.textMuted, marginBottom: 18 }}>Every compliance decision and outreach action, logged.</div>
      <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
        {log.length === 0 && <div style={{ padding: 24, textAlign: "center", color: C.textFaint, fontSize: 13 }}>No activity yet.</div>}
        {log.map((entry, i) => (
          <div key={entry.id} style={{ padding: "12px 16px", borderBottom: i < log.length - 1 ? `1px solid ${C.border}` : "none", display: "flex", justifyContent: "space-between" }}>
            <div>
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{entry.actor}</span>
              <span style={{ fontSize: 12.5, color: C.textMuted }}> — {entry.action}</span>
              {entry.detail && <div style={{ fontSize: 11.5, color: C.textFaint, marginTop: 2 }}>{entry.detail}</div>}
            </div>
            <span className="mono" style={{ fontSize: 10.5, color: C.textFaint, whiteSpace: "nowrap" }}>{new Date(entry.created_at).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// MAIN APP
// ============================================================
// Loads webfonts via <link> (non-blocking) instead of @import (render-blocking).
// Runs once, outside React's render cycle, so it doesn't delay first paint.
function useWebFonts() {
  useEffect(() => {
    try {
      if (document.getElementById("rev-os-fonts")) return;
      const preconnect1 = document.createElement("link");
      preconnect1.rel = "preconnect";
      preconnect1.href = "https://fonts.googleapis.com";
      const preconnect2 = document.createElement("link");
      preconnect2.rel = "preconnect";
      preconnect2.href = "https://fonts.gstatic.com";
      preconnect2.crossOrigin = "anonymous";
      const link = document.createElement("link");
      link.id = "rev-os-fonts";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap";
      document.head.appendChild(preconnect1);
      document.head.appendChild(preconnect2);
      document.head.appendChild(link);
    } catch {
      // Font loading blocked (e.g. sandboxed preview) — falls back to system fonts, doesn't break the app.
    }
  }, []);
}

export default function App() {
  useWebFonts();
  const [session, setSession] = useState(null); // { access_token, user }
  const [currentUser, setCurrentUser] = useState(null); // users table row
  const [tenant, setTenant] = useState(null);
  const [leads, setLeads] = useState([]);
  const [rules, setRules] = useState([]);
  const [capacity, setCapacity] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [messages, setMessages] = useState({}); // leadId -> [messages]
  const [view, setView] = useState("leads");
  const [selectedId, setSelectedId] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [bootError, setBootError] = useState("");
  const [booting, setBooting] = useState(false);

  const token = session?.access_token;

  const logAudit = useCallback(async (actor, action, detail, leadId) => {
    if (!token || !tenant) return;
    try {
      const [row] = await supaRest("audit_log", { method: "POST", token, prefer: "return=representation", body: { tenant_id: tenant.id, lead_id: leadId || null, actor, action, detail } });
      setAuditLog((l) => [row, ...l]);
    } catch {}
  }, [token, tenant]);

  async function handleSignedIn(auth) {
    setSession(auth);
    setBooting(true);
    setBootError("");
    try {
      const t = auth.access_token;
      const [userRow] = await supaRest(`users?id=eq.${auth.user.id}&select=*`, { token: t });
      if (!userRow) throw new Error("Your login worked, but no account is linked to a tenant yet. Ask an admin to add you.");
      setCurrentUser(userRow);
      const [tenantRow] = await supaRest(`tenants?id=eq.${userRow.tenant_id}&select=*`, { token: t });
      setTenant(tenantRow);
      const [leadRows, ruleRows, capRows, logRows] = await Promise.all([
        supaRest(`leads?tenant_id=eq.${userRow.tenant_id}&select=*&order=created_at.desc`, { token: t }),
        supaRest(`compliance_rules?tenant_id=eq.${userRow.tenant_id}&select=*&order=region_code.asc`, { token: t }),
        supaRest(`capacity?tenant_id=eq.${userRow.tenant_id}&select=*`, { token: t }),
        supaRest(`audit_log?tenant_id=eq.${userRow.tenant_id}&select=*&order=created_at.desc&limit=100`, { token: t }),
      ]);
      setLeads(leadRows || []);
      setRules(ruleRows || []);
      setCapacity(capRows || []);
      setAuditLog(logRows || []);
    } catch (err) {
      setBootError(err.message);
      setSession(null);
    } finally {
      setBooting(false);
    }
  }

  function signOut() {
    setSession(null); setCurrentUser(null); setTenant(null); setLeads([]); setRules([]); setCapacity([]); setAuditLog([]); setMessages({}); setSelectedId(null);
  }

  async function loadMessages(leadId) {
    if (!token || messages[leadId]) return;
    const rows = await supaRest(`messages?lead_id=eq.${leadId}&select=*&order=created_at.asc`, { token });
    setMessages((m) => ({ ...m, [leadId]: rows || [] }));
  }

  // ---- AUTO SIGN-IN (skips LoginScreen) ----
  // Fill in real credentials for an account that already exists in Supabase Auth
  // and has a matching row in the `users` table (with tenant_id set).
  const AUTO_LOGIN_EMAIL = "you@example.com";
  const AUTO_LOGIN_PASSWORD = "REPLACE_ME";
  useEffect(() => {
    if (session || AUTO_LOGIN_EMAIL === "you@example.com") return; // placeholder not filled in yet
    (async () => {
      try {
        const auth = await supaAuth(AUTO_LOGIN_EMAIL, AUTO_LOGIN_PASSWORD);
        await handleSignedIn(auth);
      } catch (err) {
        setBootError(err.message);
      }
    })();
  }, []);

  useEffect(() => { if (selectedId) loadMessages(selectedId); }, [selectedId]);

  async function patchLead(id, patch) {
    const [row] = await supaRest(`leads?id=eq.${id}`, { method: "PATCH", token, prefer: "return=representation", body: patch });
    setLeads((ls) => ls.map((l) => (l.id === id ? row : l)));
    return row;
  }
  async function pushMessage(leadId, msg) {
    const [row] = await supaRest("messages", { method: "POST", token, prefer: "return=representation", body: { tenant_id: tenant.id, lead_id: leadId, ...msg } });
    setMessages((m) => ({ ...m, [leadId]: [...(m[leadId] || []), row] }));
    return row;
  }
  async function addLead(form) {
    const [row] = await supaRest("leads", { method: "POST", token, prefer: "return=representation", body: { tenant_id: tenant.id, ...form } });
    setLeads((ls) => [row, ...ls]);
    logAudit(currentUser.full_name || "User", "Lead added", `${row.name}`, row.id);
  }
  async function updateTenant(patch) {
    const [row] = await supaRest(`tenants?id=eq.${tenant.id}`, { method: "PATCH", token, prefer: "return=representation", body: patch });
    setTenant(row);
    logAudit(currentUser.full_name || "User", "Policy updated", Object.keys(patch).join(", "));
  }
  async function togglePause() {
    await updateTenant({ active: !tenant.active });
    logAudit(currentUser.full_name || "User", tenant.active ? "Outreach paused" : "Outreach resumed", "");
  }
  async function addRule(rule) {
    const [row] = await supaRest("compliance_rules", { method: "POST", token, prefer: "return=representation", body: { tenant_id: tenant.id, active: true, ...rule } });
    setRules((r) => [...r, row]);
    logAudit(currentUser.full_name || "User", "Compliance rule added", `${row.region_name || row.region_code}`);
  }
  async function updateRule(id, patch) {
    const [row] = await supaRest(`compliance_rules?id=eq.${id}`, { method: "PATCH", token, prefer: "return=representation", body: patch });
    setRules((rs) => rs.map((r) => (r.id === id ? row : r)));
    logAudit(currentUser.full_name || "User", "Compliance rule updated", `${row.region_name || row.region_code}: ${Object.keys(patch).join(", ")}`);
  }
  async function deleteRule(id) {
    await supaRest(`compliance_rules?id=eq.${id}`, { method: "DELETE", token });
    setRules((rs) => rs.filter((r) => r.id !== id));
    logAudit(currentUser.full_name || "User", "Compliance rule deleted", id);
  }

  async function handleLeadAction(action, lead, extra) {
    const compliance = computeCompliance(lead, rules, tenant);
    if (action === "verify") {
      await patchLead(lead.id, { data_verified: true });
      await pushMessage(lead.id, { from_role: "system", content: "Data re-verified." });
      logAudit(currentUser.full_name || "User", "Data re-verified", lead.name, lead.id);
      return;
    }
    if (action === "review") {
      if (extra.subReason === "stale") { await patchLead(lead.id, { compliance_overridden: true }); logAudit(currentUser.full_name || "User", "Manual override", `${lead.name}: sign-off recorded`, lead.id); }
      else { await pushMessage(lead.id, { from_role: "system", content: REVIEW_ACTIONS[extra.subReason]?.hint || "Routed for review." }); logAudit(currentUser.full_name || "User", "Review action", `${lead.name}: ${REVIEW_ACTIONS[extra.subReason]?.label}`, lead.id); }
      return;
    }
    if (!tenant.active || compliance.status !== "cleared") return;

    if (action === "send") {
      setAiLoading(true);
      try {
        const sys = buildSystemPrompt(tenant);
        const first = lead.name.split(" ")[0];
        const msg = await callClaude(`Write a short, personal re-engagement message (3 sentences max) to ${first} who went cold ${lead.months_cold} months ago after "${lead.last_stage || "initial contact"}". Cold reason: ${lead.cold_reason || "not specified"}. Always end with "Reply STOP to opt out."`, sys);
        await pushMessage(lead.id, { from_role: "agent", content: msg || `Hi ${first}, reaching back out — still worth revisiting? Reply STOP to opt out.`, tier: "A", source: "AI" });
        await patchLead(lead.id, { pipeline_stage: "contacted" });
        logAudit(currentUser.full_name || "User", "Outreach sent", lead.name, lead.id);
      } finally { setAiLoading(false); }
      return;
    }
    if (action === "followup") {
      setAiLoading(true);
      try {
        const sys = buildSystemPrompt(tenant);
        const first = lead.name.split(" ")[0];
        const msg = await callClaude(`Write a short Day 4 follow-up (2 sentences max) to ${first} who didn't reply. Different angle than the first message. End with "Reply STOP to opt out."`, sys);
        await pushMessage(lead.id, { from_role: "agent", content: msg, tier: "A", source: "AI" });
        await patchLead(lead.id, { pipeline_stage: "followed_up" });
        logAudit(currentUser.full_name || "User", "Follow-up sent", lead.name, lead.id);
      } finally { setAiLoading(false); }
      return;
    }
    if (action === "reply") {
      const opt = extra;
      if (opt.key === "no_reply") return;
      await pushMessage(lead.id, { from_role: "lead", content: opt.text });
      if (opt.isStop) {
        await patchLead(lead.id, { pipeline_stage: "opted_out", consent_opt_out: true });
        await pushMessage(lead.id, { from_role: "system", content: "STOP received — lead suppressed from all future contact." });
        logAudit(currentUser.full_name || "User", "Opt-out", lead.name, lead.id);
        return;
      }
      await patchLead(lead.id, { pipeline_stage: "replied" });
      const objections = tenant.objection_scripts?.length ? tenant.objection_scripts : DEFAULT_OBJECTIONS;
      const lower = opt.text.toLowerCase();
      const scripted = objections.find((o) => o.trigger.split("|").some((t) => lower.includes(t.trim())));
      if (scripted || opt.tier === "objection") {
        await pushMessage(lead.id, { from_role: "agent", content: scripted?.response || "Totally understand that concern — happy to address it directly. Would a quick call help?\n\nReply STOP to opt out.", tier: "A", source: "scripted" });
        return;
      }
      if (opt.tier === "B_config") {
        const details = [tenant.federal_credit && `credit: ${tenant.federal_credit}`, tenant.active_promo].filter(Boolean).join(", ") || "current pricing";
        await pushMessage(lead.id, { from_role: "agent", content: `Here's what's available right now: ${details}. Want me to put together exact numbers for your situation?\n\nReply STOP to opt out.`, tier: "B", source: "config" });
        await patchLead(lead.id, { pipeline_stage: "qualified" });
        return;
      }
      if (opt.tier === "B_human") {
        await pushMessage(lead.id, { from_role: "agent", content: "Good question — financing varies by situation, so I'm looping in someone from our team to walk through the numbers with you.\n\nReply STOP to opt out.", tier: "B", source: "human handoff" });
        await patchLead(lead.id, { pipeline_stage: "qualified" });
        return;
      }
      if (opt.intent) {
        const cap = capacity.find((c) => c.territory === lead.territory);
        setAiLoading(true);
        try {
          if (cap && cap.available_slots > 0) {
            const msg = await callClaude(`The lead wants to book a call. Write a warm, short confirmation (2 sentences) that a slot is available this week.`, buildSystemPrompt(tenant));
            await pushMessage(lead.id, { from_role: "agent", content: (msg || "Great — I've got a slot open this week, booking you in now.") + "\n\nReply STOP to opt out.", tier: "A", source: "AI" });
            await supaRest(`capacity?id=eq.${cap.id}`, { method: "PATCH", token, body: { available_slots: cap.available_slots - 1 } });
            setCapacity((cs) => cs.map((c) => (c.id === cap.id ? { ...c, available_slots: c.available_slots - 1 } : c)));
            await patchLead(lead.id, { pipeline_stage: "booked" });
            logAudit(currentUser.full_name || "User", "Booked", lead.name, lead.id);
          } else {
            await pushMessage(lead.id, { from_role: "agent", content: "Team's fully booked in your area right now — you're first in line for the next opening.\n\nReply STOP to opt out.", tier: "A" });
            await patchLead(lead.id, { pipeline_stage: "qualified" });
          }
        } finally { setAiLoading(false); }
        return;
      }
      await pushMessage(lead.id, { from_role: "agent", content: "Good to hear — I'll follow up shortly.\n\nReply STOP to opt out.", tier: "A" });
    }
  }

  if (!session) {
    return (
      <div>
        <LoginScreen onSignedIn={handleSignedIn} />
        {(booting || bootError) && (
          <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: C.panel, border: `1px solid ${bootError ? C.coral : C.border}`, borderRadius: 8, padding: "10px 16px", color: bootError ? C.coral : C.textMuted, fontSize: 12.5, maxWidth: 380, textAlign: "center" }}>
            {booting ? "Loading your workspace…" : bootError}
          </div>
        )}
      </div>
    );
  }

  const selectedLead = leads.find((l) => l.id === selectedId);
  const NAV = [
    { id: "leads", label: "Leads", icon: Layers },
    { id: "compliance", label: "Compliance Gate", icon: ShieldCheck },
    { id: "activity", label: "Activity", icon: History },
  ];

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: C.bg, minHeight: "100vh", color: C.text, display: "flex" }}>
      <style>{`
        * { box-sizing: border-box; }
        .cp { font-family: 'Chakra Petch', sans-serif; }
        .mono { font-family: 'IBM Plex Mono', monospace; }
        button { font-family: inherit; }
        .card { transition: background 0.12s; }
        .card:hover { background: ${C.panelAlt}; }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={{ width: 220, background: C.panel, borderRight: `1px solid ${C.border}`, padding: "20px 14px", flexShrink: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 6px 18px" }}>
          <Building2 size={17} color={C.teal} />
          <div>
            <div className="cp" style={{ fontSize: 13.5, fontWeight: 700 }}>{tenant?.company_name}</div>
            <div style={{ fontSize: 10.5, color: C.textFaint, textTransform: "capitalize" }}>{tenant?.industry}</div>
          </div>
        </div>
        {NAV.map((n) => {
          const Icon = n.icon; const active = view === n.id;
          return (
            <div key={n.id} onClick={() => setView(n.id)} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 10px", borderRadius: 7, cursor: "pointer", marginBottom: 2, background: active ? C.panelAlt : "transparent", color: active ? C.text : C.textMuted }}>
              <Icon size={15} /><span style={{ fontSize: 13, fontWeight: 500 }}>{n.label}</span>
            </div>
          );
        })}
        <div style={{ marginTop: "auto", paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 11.5, color: C.textMuted, padding: "0 10px 8px" }}>{currentUser?.full_name} · <span style={{ textTransform: "capitalize" }}>{currentUser?.role}</span></div>
          <div onClick={signOut} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 7, cursor: "pointer", color: C.textMuted, fontSize: 12.5 }}><LogOut size={13} /> Sign out</div>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {!tenant?.active && <Banner color={C.coral} bg={C.coralBg} icon={<Power size={13} />} text="Outreach is paused for this workspace — resume it from Compliance Gate to send messages." />}
        {view === "leads" && <LeadsView leads={leads} tenant={tenant} rules={rules} capacity={capacity} selectedId={selectedId} setSelectedId={setSelectedId} onAddLead={addLead} />}
        {view === "compliance" && <ComplianceGateView tenant={tenant} rules={rules} onUpdateTenant={updateTenant} onAddRule={addRule} onUpdateRule={updateRule} onDeleteRule={deleteRule} onTogglePause={togglePause} />}
        {view === "activity" && <ActivityView log={auditLog} />}
      </div>

      {selectedLead && (
        <LeadDetailPanel lead={selectedLead} tenant={tenant} rules={rules} capacity={capacity} messages={messages[selectedLead.id] || []} aiLoading={aiLoading}
          onClose={() => setSelectedId(null)} onAction={handleLeadAction} />
      )}
    </div>
  );
}
