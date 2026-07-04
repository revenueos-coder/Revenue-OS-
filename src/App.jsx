import React, { useState, useMemo, useEffect } from "react";
import {
  ShieldCheck, ShieldAlert, ShieldX, Power, X, Send, MessageSquare,
  CheckCircle2, Clock, Users, Ban, RefreshCw, FileText,
  BookOpen, Plug, Plus, Trash2, Check, AlertTriangle, History,
  Rocket, DollarSign, FlaskConical, Info, Menu, Layers,
  TrendingUp, Zap, Activity, Target, ChevronRight, Sparkles
} from "lucide-react";

// ============ DESIGN TOKENS ============
const C = {
  bg: "#14181D", panel: "#1B2129", panelAlt: "#20272F",
  border: "#2A323C", borderLight: "#333C48",
  text: "#EDEFF2", textMuted: "#8B94A3", textFaint: "#5B6472",
  amber: "#F2A93B", amberBg: "rgba(242,169,59,0.12)",
  teal: "#35B9A0", tealBg: "rgba(53,185,160,0.12)",
  coral: "#E8654F", coralBg: "rgba(232,101,79,0.12)",
  violet: "#9D8CF2", violetBg: "rgba(157,140,242,0.14)",
  gold: "#F5C842", goldBg: "rgba(245,200,66,0.10)",
};

// ============ SEED DATA ============
const REPS = { "Jordan": { active: true }, "Casey": { active: true }, "Priya (left company)": { active: false } };
const SEED_LEADS = [
  { id: "L-1042", name: "M. Alvarez", city: "Phoenix, AZ", utility: "APS", monthsCold: 4, systemKw: 7.2, lastStage: "Quote Sent", consent: { hasRecord: true, verbatim: true, channel: ["text","call"], timestamp: "2025-11-02", optOut: false }, coldReason: "price_objection", territory: "Phoenix-North", originalRep: "Jordan", recentOtherChannel: false, dataVerified: true },
  { id: "L-1043", name: "D. Chen", city: "Austin, TX", utility: "Austin Energy", monthsCold: 19, systemKw: 5.4, lastStage: "Initial Inquiry", consent: { hasRecord: true, verbatim: false, channel: ["email"], timestamp: "2024-08-14", optOut: false }, coldReason: "unknown", territory: "Austin-East", originalRep: "Priya (left company)", recentOtherChannel: false, dataVerified: false },
  { id: "L-1044", name: "R. Okafor", city: "Phoenix, AZ", utility: "APS", monthsCold: 8, systemKw: 9.1, lastStage: "Site Survey", consent: { hasRecord: true, verbatim: true, channel: ["text"], timestamp: "2025-06-20", optOut: false }, coldReason: "financing_fell_through", territory: "Phoenix-North", originalRep: "Jordan", recentOtherChannel: false, dataVerified: true },
  { id: "L-1045", name: "S. Patel", city: "San Diego, CA", utility: "SDG&E", monthsCold: 2, systemKw: 6.0, lastStage: "Quote Sent", consent: { hasRecord: false, verbatim: false, channel: [], timestamp: null, optOut: false }, coldReason: "went_dark", territory: "San Diego-Coastal", originalRep: "Casey", recentOtherChannel: false, dataVerified: true },
  { id: "L-1046", name: "J. Whitfield", city: "Austin, TX", utility: "Austin Energy", monthsCold: 13, systemKw: 8.0, lastStage: "Initial Inquiry", consent: { hasRecord: true, verbatim: true, channel: ["call"], timestamp: "2025-01-05", optOut: true }, coldReason: "competitor_chosen", territory: "Austin-East", originalRep: "Casey", recentOtherChannel: false, dataVerified: false },
  { id: "L-1047", name: "T. Nakamura", city: "San Diego, CA", utility: "SDG&E", monthsCold: 6, systemKw: 10.4, lastStage: "Site Survey", consent: { hasRecord: true, verbatim: true, channel: ["text","email"], timestamp: "2025-09-11", optOut: false }, coldReason: "price_objection", territory: "San Diego-Coastal", originalRep: "Jordan", recentOtherChannel: true, dataVerified: true },
  { id: "L-1048", name: "K. Ibrahim", city: "Phoenix, AZ", utility: "SRP", monthsCold: 22, systemKw: 4.8, lastStage: "Initial Inquiry", consent: { hasRecord: true, verbatim: false, channel: ["text"], timestamp: "2024-05-03", optOut: false }, coldReason: "unknown", territory: "Phoenix-South", originalRep: "Priya (left company)", recentOtherChannel: false, dataVerified: false },
  { id: "L-1049", name: "L. Fournier", city: "Austin, TX", utility: "Austin Energy", monthsCold: 3, systemKw: 7.8, lastStage: "Quote Sent", consent: { hasRecord: true, verbatim: true, channel: ["text"], timestamp: "2026-03-18", optOut: false }, coldReason: "financing_fell_through", territory: "Austin-West", originalRep: "Casey", recentOtherChannel: false, dataVerified: true },
];
const CAPACITY_SEED = { "Phoenix-North": 2, "Phoenix-South": 0, "Austin-East": 1, "Austin-West": 3, "San Diego-Coastal": 1 };
const CONFIG_SEED = { federalCredit: "30%", promo: "Battery rebate $1,000 through Aug 2026", panelModel: "REC Alpha Pure 410W", revenuePerKw: 3500 };
const POLICY_SEED = { freshnessMonths: 18, dormancyResetMonths: 6 };

// ============ DNC REGISTRY (simulated) ============
const DNC_LIST = ["L-1046", "L-1048"];

// ============ STATE COMPLIANCE OVERLAYS ============
const STATE_RULES = {
  AZ: { name: "Arizona", freshnessCap: 24, riskLevel: "low", notes: "Standard TCPA. No state overlay." },
  TX: { name: "Texas", freshnessCap: 24, riskLevel: "medium", notes: "TX Business & Commerce Code §305 adds state DNC. Opt-outs must be honored within 30 days." },
  CA: { name: "California", freshnessCap: 12, riskLevel: "high", notes: "CCPA applies. Verbal consent insufficient. Consent record must include IP, timestamp, exact opt-in language." },
  FL: { name: "Florida", freshnessCap: 18, riskLevel: "high", notes: "FTSA requires express written consent even for existing customers. FL is the most-litigated TCPA state." },
};
const RISK_COLOR = { low: C.teal, medium: C.amber, high: C.coral };
function getState(city) {
  if (city.includes("AZ")) return "AZ";
  if (city.includes("TX")) return "TX";
  if (city.includes("CA")) return "CA";
  if (city.includes("FL")) return "FL";
  return "AZ";
}

// ============ COLD REASON LABELS & TEMPLATES ============
const COLD_REASON_LABEL = { price_objection: "Price objection", financing_fell_through: "Financing fell through", went_dark: "Went dark", competitor_chosen: "Chose competitor", unknown: "No reason on record" };
const OPENERS = {
  price_objection: (n) => `Hi ${n}, following up on the quote from a while back — some things have shifted since then and it might be worth another look. Got 10 minutes this week?\n\nReply STOP to opt out.`,
  financing_fell_through: (n) => `Hi ${n}, wanted to check back in — financing options have changed since we last talked. Open to revisiting?\n\nReply STOP to opt out.`,
  went_dark: (n) => `Hi ${n}, haven't heard from you in a bit — still exploring solar for the property, or has the timing changed?\n\nReply STOP to opt out.`,
  competitor_chosen: (n) => `Hi ${n}, just checking in to see how things are going with the system you looked into — happy to help if anything's still open.\n\nReply STOP to opt out.`,
  unknown: (n) => `Hi ${n}, reaching back out about solar for your home — still something you're weighing?\n\nReply STOP to opt out.`,
};
const FOLLOWUPS = {
  price_objection: (n) => `Hey ${n}, no pressure at all — just didn't want you to miss out if pricing has changed enough to make the numbers work.\n\nReply STOP to opt out.`,
  financing_fell_through: (n) => `Hi ${n}, following up once more — we have a couple financing partners now that weren't available before.\n\nReply STOP to opt out.`,
  went_dark: (n) => `Hi ${n}, last check-in from me — if solar's off the table for now that's totally fine, just let me know.\n\nReply STOP to opt out.`,
  competitor_chosen: (n) => `Hi ${n}, no worries if you're set with someone else — if you ever want a second opinion, we're here.\n\nReply STOP to opt out.`,
  unknown: (n) => `Hi ${n}, one more note in case the first got buried — happy to answer any questions, no pressure.\n\nReply STOP to opt out.`,
};

// ============ OBJECTION SCRIPTS ============
const DEFAULT_OBJECTIONS = [
  { trigger: "expensive|price|cost|afford|too much", response: "I completely understand. The upfront cost has come down significantly, and with the federal tax credit and current utility rates, most customers see payback in 6-8 years. I can send you an updated breakdown with no obligation — would that be helpful?\n\nReply STOP to opt out." },
  { trigger: "shaded|shade|tree|roof", response: "Good thing to flag. Modern panels handle shade much better than systems from even 3-4 years ago. I'd want to do a quick shadow analysis on your roof before saying anything definitive — takes about 20 minutes and it's free. Would that work?\n\nReply STOP to opt out." },
  { trigger: "renting|rent|landlord", response: "That's a tough one — you'd need the property owner's sign-off. If you're thinking about buying or own another property, definitely worth keeping in mind. Happy to set a reminder for when your situation changes.\n\nReply STOP to opt out." },
  { trigger: "scam|fraud|ripoff|dishonest|trust", response: "I hear that concern a lot, and honestly the solar industry has earned some of that skepticism. We're a licensed contractor with verifiable reviews, and you're welcome to speak to past customers before making any decision. No pressure from us.\n\nReply STOP to opt out." },
];

function detectObjection(text, objections) {
  const lower = text.toLowerCase();
  for (const obj of objections) {
    const triggers = obj.trigger.split("|");
    if (triggers.some((t) => lower.includes(t.trim()))) return obj.response;
  }
  return null;
}

// ============ REPLY OPTIONS ============
const REPLY_OPTIONS = [
  { key: "tierA_interested", label: "\u201cYeah, still interested \u2014 what\u2019s next?\u201d", text: "Yeah, still interested — what's next?", tier: "A", intent: true },
  { key: "tierB_price", label: "\u201cWhat\u2019s the price / incentive now?\u201d", text: "What's the tax credit at now, and roughly what would this cost?", tier: "B_config", intent: false },
  { key: "tierB_financing", label: "\u201cWhat financing do you offer?\u201d", text: "What financing options do you have these days?", tier: "B_human", intent: false },
  { key: "obj_shade", label: "\u201cMy roof has too much shade.\u201d", text: "My roof has a lot of shade from trees, so I don't think solar would work.", tier: "objection", intent: false },
  { key: "obj_trust", label: "\u201cI\u2019ve heard solar companies are scammy.\u201d", text: "Honestly I've heard a lot of bad things about solar companies lately.", tier: "objection", intent: false },
  { key: "tierA_book", label: "\u201cLet\u2019s schedule a call.\u201d", text: "Sure, let's schedule a call this week.", tier: "A", intent: true },
  { key: "stop", label: "\u201cSTOP \u2014 please don\u2019t contact me.\u201d", text: "STOP", tier: null, intent: false, isStop: true },
  { key: "no_reply", label: "(No reply)", text: null, tier: null, intent: false },
];

const STATUS_CONFIG = {
  cleared: { label: "Cleared", color: C.teal, bg: C.tealBg, icon: ShieldCheck },
  review: { label: "Manual Review", color: C.amber, bg: C.amberBg, icon: ShieldAlert },
  suppressed: { label: "Suppressed", color: C.coral, bg: C.coralBg, icon: ShieldX },
};
const STAGE_ORDER = ["not_contacted","contacted","followed_up","replied","qualified","booked","opted_out"];
const STAGE_LABEL = { not_contacted: "Not Contacted", contacted: "Contacted", followed_up: "Followed Up", replied: "Replied", qualified: "Qualified", booked: "Booked", opted_out: "Opted Out" };
const STORAGE_KEY = "revenue-os-final-v3";

// ============ NAV ============
const NAV_GROUPS = [
  { group: "Revenue", items: [{ id: "dashboard", label: "Dashboard", icon: TrendingUp }] },
  { group: "Pipeline", items: [{ id: "pipeline", label: "Pipeline", icon: Layers }, { id: "execution", label: "Execution", icon: Activity }, { id: "ledger", label: "Ownership", icon: Users }] },
  { group: "Insights", items: [{ id: "report", label: "Revenue Report", icon: DollarSign }, { id: "audit", label: "Audit Timeline", icon: History }] },
  { group: "Admin", items: [{ id: "config", label: "Policy & Config", icon: ShieldCheck }, { id: "training", label: "Voice Training", icon: BookOpen }, { id: "integrations", label: "Integrations", icon: Plug }, { id: "deploy", label: "Deploy", icon: Rocket }] },
];

// ============ DECISION ENGINE ============
function runComplianceCheck(lead, policy) {
  if (lead.consent.optOut) return { status: "suppressed", reason: "Opt-out on record — permanently suppressed.", subReason: "opt_out" };
  if (DNC_LIST.includes(lead.id)) return { status: "suppressed", reason: "Lead appears on national DNC registry — cannot contact.", subReason: "dnc" };
  if (!lead.consent.hasRecord) return { status: "review", reason: "No consent record found. Cannot contact without verification.", subReason: "no_record" };
  if (!lead.consent.verbatim) return { status: "review", reason: "Consent exists but verbatim language wasn't archived.", subReason: "not_verbatim" };
  const stateCode = getState(lead.city);
  const stateCap = STATE_RULES[stateCode]?.freshnessCap ?? policy.freshnessMonths;
  const effectiveCap = Math.min(policy.freshnessMonths, stateCap);
  if (lead.monthsCold > effectiveCap) return { status: "review", reason: `Consent is ${lead.monthsCold}mo old — exceeds ${stateCode} cap of ${effectiveCap}mo. Needs legal sign-off.`, subReason: "stale" };
  return { status: "cleared", reason: "Verbatim consent on file, within freshness window, not on DNC.", subReason: null };
}

const REVIEW_ACTIONS = {
  no_record: { label: "Request consent capture", hint: "Routes to re-consent queue — needs a fresh opt-in, not a sign-off." },
  not_verbatim: { label: "Verify consent language", hint: "Pulls archived form copy for the campaign this lead originated from." },
  stale: { label: "Send to legal for sign-off", hint: "Routes to legal review queue — consent age exceeds state freshness threshold." },
  dnc: { label: "Cannot override — DNC registry", hint: "This lead is on the national DNC registry. Legal clearance required before any outreach." },
};

function dataConfidence(lead) { let s = 100; if (!lead.dataVerified) s -= 30; if (lead.monthsCold > 12) s -= 10; return Math.max(s, 10); }
function leadScoreBreakdown(lead) {
  const recencyScore = Math.max(100 - lead.monthsCold * 4, 0);
  const sizeScore = Math.min((lead.systemKw / 12) * 100, 100);
  const stageWeights = { "Initial Inquiry": 20, "Quote Sent": 55, "Site Survey": 85 };
  const stageScore = stageWeights[lead.lastStage] || 30;
  const confidence = dataConfidence(lead);
  const weights = { recency: 0.3, size: 0.2, stage: 0.3, confidence: 0.2 };
  const total = Math.round(recencyScore * weights.recency + sizeScore * weights.size + stageScore * weights.stage + confidence * weights.confidence);
  return { recencyScore, sizeScore, stageScore, confidence, weights, total };
}
function ownershipDecision(lead, policy) {
  const rep = REPS[lead.originalRep];
  if (!rep) return { owner: "House Pool", rationale: "No rep on record." };
  if (!rep.active) return { owner: "House Pool (split w/ manager)", rationale: `${lead.originalRep} no longer with company.` };
  if (lead.monthsCold >= policy.dormancyResetMonths) return { owner: `First responder pool (orig: ${lead.originalRep})`, rationale: `Dormant ${lead.monthsCold}mo ≥ ${policy.dormancyResetMonths}mo — ownership resets.` };
  return { owner: lead.originalRep, rationale: `Active rep, <${policy.dormancyResetMonths}mo dormant.` };
}
function simulateOrchestration(toolName) {
  const retry = Math.random() < 0.3;
  return retry
    ? { steps: [`${toolName}: attempt 1 failed (timeout)`, `${toolName}: retry succeeded`], status: "success_after_retry" }
    : { steps: [`${toolName}: succeeded`], status: "success" };
}

// ============ MAIN APP ============
export default function RevenueOS() {
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [killSwitch, setKillSwitch] = useState(false);
  const [dryRun, setDryRun] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [leads, setLeads] = useState(SEED_LEADS.map((l) => ({ ...l, pipelineStage: "not_contacted", messages: [], overridden: false })));
  const [capacity, setCapacity] = useState(CAPACITY_SEED);
  const [config, setConfig] = useState(CONFIG_SEED);
  const [policy, setPolicy] = useState(POLICY_SEED);
  const [view, setView] = useState("dashboard");
  const [summary, setSummary] = useState(null);
  const [training, setTraining] = useState({ companyName: "", ownerName: "", voiceSample: "", voiceProfile: null, trained: false, objections: DEFAULT_OBJECTIONS, doNotSay: ["guaranteed savings", "free money", "no cost to you"] });
  const BLANK_TRAINING = { companyName: "", ownerName: "", voiceSample: "", voiceProfile: null, trained: false, objections: DEFAULT_OBJECTIONS, doNotSay: ["guaranteed savings", "free money", "no cost to you"] };
  const [integrations, setIntegrations] = useState([
    { id: "crm", label: "CRM", options: ["Salesforce","HubSpot","Enerflo","SolarNexus"], selected: "HubSpot", connected: false, apiKey: "" },
    { id: "sms", label: "SMS / Voice", options: ["Twilio"], selected: "Twilio", connected: false, apiKey: "" },
    { id: "calendar", label: "Booking Calendar", options: ["Calendly","Acuity","Google Calendar"], selected: "Calendly", connected: false, apiKey: "" },
    { id: "permits", label: "Permitting Feed", options: ["Manual entry","SolarAPP+","Utility portal API"], selected: "Manual entry", connected: false, apiKey: "" },
  ]);
  const [auditLog, setAuditLog] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [executionLog, setExecutionLog] = useState([]);
  const [newDoNotSay, setNewDoNotSay] = useState("");
  const [trainingVoice, setTrainingVoice] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await window.storage.get(STORAGE_KEY, false);
        if (!cancelled && result?.value) {
          const saved = JSON.parse(result.value);
          if (saved.leads) setLeads(saved.leads);
          if (saved.capacity) setCapacity(saved.capacity);
          if (saved.config) setConfig(saved.config);
          if (saved.policy) setPolicy(saved.policy);
          if (saved.training) setTraining({ ...saved.training, companyName: saved.training.companyName || "", ownerName: saved.training.ownerName || "" });
          if (saved.integrations) setIntegrations(saved.integrations);
          if (saved.auditLog) setAuditLog(saved.auditLog);
          if (saved.executionLog) setExecutionLog(saved.executionLog);
        }
      } catch (e) { if (!cancelled) setLoadError(null); }
      finally { if (!cancelled) setLoaded(true); }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    async function save() {
      try { await window.storage.set(STORAGE_KEY, JSON.stringify({ leads, capacity, config, policy, training, integrations, auditLog, executionLog }), false); }
      catch (e) { setLoadError("Couldn't save state."); }
    }
    save();
  }, [leads, capacity, config, policy, training, integrations, auditLog, executionLog, loaded]);

  function logAudit(actor, action, detail) { setAuditLog((p) => [...p, { id: p.length + 1, ts: Date.now(), actor, action, detail }]); }
  function logExecution(leadId, leadName, step, status, note) { setExecutionLog((p) => [...p, { id: p.length + 1, ts: Date.now(), leadId, leadName, step, status, note }]); }

  async function resetAll() {
    try { await window.storage.delete(STORAGE_KEY, false); } catch (e) {}
    setLeads(SEED_LEADS.map((l) => ({ ...l, pipelineStage: "not_contacted", messages: [], overridden: false })));
    setCapacity(CAPACITY_SEED); setConfig(CONFIG_SEED); setPolicy(POLICY_SEED);
    setTraining({ companyName: "", ownerName: "", voiceSample: "", voiceProfile: null, trained: false, objections: DEFAULT_OBJECTIONS, doNotSay: ["guaranteed savings","free money","no cost to you"] });
    setIntegrations((p) => p.map((i) => ({ ...i, connected: false, apiKey: "" })));
    setAuditLog([]); setExecutionLog([]);
  }

  const withDerived = useMemo(() => leads.map((l) => {
    const compliance = l.overridden
      ? { status: "cleared", reason: "Manually approved (simulated legal sign-off).", subReason: null }
      : runComplianceCheck(l, policy);
    const scoreInfo = leadScoreBreakdown(l);
    return { ...l, compliance, confidence: dataConfidence(l), score: scoreInfo.total, scoreBreakdown: scoreInfo, ownership: ownershipDecision(l, policy), stateRule: STATE_RULES[getState(l.city)] };
  }), [leads, policy]);

  const selected = withDerived.find((l) => l.id === selectedId) || null;
  const counts = useMemo(() => { const c = { cleared: 0, review: 0, suppressed: 0 }; withDerived.forEach((l) => c[l.compliance.status]++); return c; }, [withDerived]);
  const stageCounts = useMemo(() => { const c = {}; STAGE_ORDER.forEach((s) => (c[s] = 0)); withDerived.forEach((l) => c[l.pipelineStage]++); return c; }, [withDerived]);
  const revenueStats = useMemo(() => {
    const booked = withDerived.filter((l) => l.pipelineStage === "booked");
    const pipeline = withDerived.filter((l) => ["qualified","booked"].includes(l.pipelineStage));
    return {
      recovered: booked.reduce((s, l) => s + l.systemKw, 0) * config.revenuePerKw,
      pipelineValue: pipeline.reduce((s, l) => s + l.systemKw, 0) * config.revenuePerKw,
      bookedCount: booked.length, pipelineCount: pipeline.length,
    };
  }, [withDerived, config.revenuePerKw]);

  function updateLead(id, patch) { setLeads((p) => p.map((l) => (l.id === id ? { ...l, ...patch } : l))); }
  function pushMessage(id, msg) { setLeads((p) => p.map((l) => (l.id === id ? { ...l, messages: [...l.messages, msg] } : l))); }

  function buildOpener(lead) {
    const base = OPENERS[lead.coldReason](lead.name.split(" ")[0]);
    const closers = { casual: "No pressure either way — just say the word.", consultative: "Happy to walk through what's changed, whenever works.", direct: "Let me know a good time and I'll get you booked." };
    const trained = training.trained && (training.voiceSample || training.voiceProfile);
    const text = trained ? `${base} ${closers.casual}` : base;
    const flagged = (training.doNotSay || []).filter((p) => text.toLowerCase().includes(p.toLowerCase()));
    return { text, trained, flagged };
  }

  async function sendOutreach(lead) {
    if (killSwitch || lead.compliance.status !== "cleared") return;
    if (lead.recentOtherChannel && lead.pipelineStage === "not_contacted") {
      pushMessage(lead.id, { from: "system", text: "Dedup hold — contacted on another channel within 72h. Send blocked." });
      logAudit("System", "Dedup block", `${lead.id}: blocked`);
      logExecution(lead.id, lead.name, "Dedup check", "BLOCKED", "Other channel within 72h");
      return;
    }
    if (dryRun) {
      const { text, flagged } = buildOpener(lead);
      if (flagged.length > 0) { pushMessage(lead.id, { from: "system", text: `Blocked: do-not-say phrase detected ("${flagged[0]}").` }); return; }
      pushMessage(lead.id, { from: "agent", text, tier: "A", note: "[DRY RUN — not sent]" });
      logAudit("Agent", "Dry run preview", `${lead.id}: outreach previewed`);
      logExecution(lead.id, lead.name, "Outreach preview", "DRY RUN", "Pipeline not advanced");
      return;
    }
    setAiLoading(true);
    logExecution(lead.id, lead.name, "Evaluating compliance", "OK", `Consent score passed · ${getState(lead.city)} rules applied`);
    const { text, flagged } = buildOpener(lead);
    if (flagged.length > 0) {
      pushMessage(lead.id, { from: "system", text: `Blocked: do-not-say phrase detected ("${flagged[0]}").` });
      setAiLoading(false);
      return;
    }
    pushMessage(lead.id, { from: "agent", text, tier: "A", source: training.trained ? `Template · ${training.companyName} voice` : "Template · default voice" });
    logExecution(lead.id, lead.name, "Message generated", "OK", `Template · ${lead.coldReason}`);
    const orch = simulateOrchestration("SMS send (Twilio)");
    orch.steps.forEach((s) => logExecution(lead.id, lead.name, "Tool execution", orch.status === "success_after_retry" ? "RETRY" : "OK", s));
    updateLead(lead.id, { pipelineStage: "contacted" });
    logAudit("Agent", "Outreach sent", `${lead.id}: initial outreach`);
    logExecution(lead.id, lead.name, "Pipeline updated", "OK", "contacted");
    setAiLoading(false);
  }

  async function sendFollowUp(lead) {
    if (killSwitch) return;
    if (dryRun) {
      pushMessage(lead.id, { from: "agent", text: FOLLOWUPS[lead.coldReason](lead.name.split(" ")[0]), tier: "A", note: "[DRY RUN]" });
      logExecution(lead.id, lead.name, "Follow-up preview", "DRY RUN", "Not sent");
      return;
    }
    setAiLoading(true);
    logExecution(lead.id, lead.name, "Day 4 follow-up", "RUNNING", "Generating message");
    pushMessage(lead.id, { from: "agent", text: FOLLOWUPS[lead.coldReason](lead.name.split(" ")[0]), tier: "A", source: "Template · Day 4 sequence" });
    const orch = simulateOrchestration("SMS send (Twilio)");
    orch.steps.forEach((s) => logExecution(lead.id, lead.name, "Tool execution", orch.status === "success_after_retry" ? "RETRY" : "OK", s));
    updateLead(lead.id, { pipelineStage: "followed_up" });
    logAudit("Agent", "Follow-up sent", `${lead.id}: second touch`);
    logExecution(lead.id, lead.name, "Pipeline updated", "OK", "followed_up");
    setAiLoading(false);
  }

  function verifyData(lead) {
    const orch = simulateOrchestration("CRM data sync");
    orch.steps.forEach((s) => logAudit("Orchestration", "Tool execution", `${lead.id}: ${s}`));
    updateLead(lead.id, { dataVerified: true });
    pushMessage(lead.id, { from: "system", text: "Data re-verified against current utility territory and rate records." });
    logAudit("System", "Data re-verified", `${lead.id}: confidence updated`);
  }

  function handleReviewAction(lead) {
    if (lead.compliance.subReason === "dnc") return;
    if (lead.compliance.subReason === "stale") { updateLead(lead.id, { overridden: true }); logAudit("User", "Manual override", `${lead.id}: legal sign-off simulated`); }
    else { pushMessage(lead.id, { from: "system", text: REVIEW_ACTIONS[lead.compliance.subReason]?.hint || "Routed for review." }); logAudit("User", "Review action", `${lead.id}: ${REVIEW_ACTIONS[lead.compliance.subReason]?.label}`); }
  }

  async function simulateReply(lead, option) {
    if (option.key === "no_reply") return;
    if (option.isStop) {
      pushMessage(lead.id, { from: "lead", text: option.text });
      updateLead(lead.id, { pipelineStage: "opted_out", consent: { ...lead.consent, optOut: true } });
      pushMessage(lead.id, { from: "system", text: "STOP received — lead suppressed from all future contact." });
      logAudit("System", "Opt-out", `${lead.id}: suppressed permanently`);
      logExecution(lead.id, lead.name, "STOP received", "SUPPRESSED", "Permanent suppression applied");
      return;
    }
    pushMessage(lead.id, { from: "lead", text: option.text });
    updateLead(lead.id, { pipelineStage: "replied" });
    logAudit("Lead", "Reply received", `${lead.id}: "${option.text.slice(0, 60)}"`);
    logExecution(lead.id, lead.name, "Reply received", "OK", option.tier || "standard");

    // Objection detection — scripted response takes priority
    const scripted = detectObjection(option.text, training.objections || DEFAULT_OBJECTIONS);
    if (scripted || option.tier === "objection") {
      const response = scripted || "I completely understand that concern. Happy to address it directly — would a quick call help?";
      pushMessage(lead.id, { from: "agent", text: response, tier: "A", source: "scripted objection response" });
      logAudit("Agent", "Objection handled", `${lead.id}: matched trigger → exact script`);
      logExecution(lead.id, lead.name, "Objection detected", "SCRIPTED", "Exact response used");
      return;
    }

    if (option.tier === "B_config") {
      const reply = `Right now the federal credit sits at ${config.federalCredit}, and there's a promo running: ${config.promo}. Panels we're installing are the ${config.panelModel}. Want me to put together numbers for your place?\n\nReply STOP to opt out.`;
      pushMessage(lead.id, { from: "agent", text: reply, tier: "B", source: "source-of-truth config" });
      updateLead(lead.id, { pipelineStage: "qualified" });
      logAudit("Agent", "Tier B reply (config)", `${lead.id}: answered from config`);
      logExecution(lead.id, lead.name, "Pricing query", "CONFIG", "No AI hallucination");
      return;
    }
    if (option.tier === "B_human") {
      pushMessage(lead.id, { from: "system", text: "Financing query — escalating to human rep." });
      pushMessage(lead.id, { from: "agent", text: `Good question — financing varies by situation so I'm looping in someone from our team to walk through the real numbers with you.\n\nReply STOP to opt out.`, tier: "B", source: "human handoff" });
      updateLead(lead.id, { pipelineStage: "qualified" });
      logAudit("Agent", "Tier B escalation", `${lead.id}: handed to ${lead.ownership.owner}`);
      logExecution(lead.id, lead.name, "Human handoff", "ESCALATED", `Financing → ${lead.ownership.owner}`);
      return;
    }
    if (option.intent) {
      const slots = capacity[lead.territory] || 0;
      setAiLoading(true);
      if (slots > 0) {
        pushMessage(lead.id, { from: "agent", text: `Great — I've got a slot open this week, booking you in now.\n\nReply STOP to opt out.`, tier: "A", source: "Template · booking confirmation" });
        const orch = simulateOrchestration("Calendar booking (Calendly)");
        orch.steps.forEach((s) => logExecution(lead.id, lead.name, "Tool execution", orch.status === "success_after_retry" ? "RETRY" : "OK", s));
        setCapacity((c) => ({ ...c, [lead.territory]: c[lead.territory] - 1 }));
        updateLead(lead.id, { pipelineStage: "booked" });
        logAudit("Agent", "Booked", `${lead.id}: consultation confirmed`);
        logExecution(lead.id, lead.name, "CRM updated", "OK", "Stage → booked");
      } else {
        pushMessage(lead.id, { from: "agent", text: `Great — team's fully booked in your area right now, you're first in line for the next opening.\n\nReply STOP to opt out.`, tier: "A" });
        updateLead(lead.id, { pipelineStage: "qualified" });
        logAudit("System", "Capacity hold", `${lead.id}: 0 slots in ${lead.territory}`);
        logExecution(lead.id, lead.name, "Booking attempt", "WAITLISTED", `No capacity in ${lead.territory}`);
      }
      setAiLoading(false);
      return;
    }
    pushMessage(lead.id, { from: "agent", text: "Good to hear — I'll follow up shortly.\n\nReply STOP to opt out.", tier: "A" });
  }

  function generateSummary() {
    const total = withDerived.length;
    const contacted = withDerived.filter((l) => l.pipelineStage !== "not_contacted" && l.compliance.status === "cleared").length;
    const replied = withDerived.filter((l) => ["replied","qualified","booked"].includes(l.pipelineStage)).length;
    const booked = withDerived.filter((l) => l.pipelineStage === "booked").length;
    const optedOut = withDerived.filter((l) => l.pipelineStage === "opted_out").length;
    const avgKw = booked > 0 ? withDerived.filter((l) => l.pipelineStage === "booked").reduce((s, l) => s + l.systemKw, 0) / booked : 0;
    setSummary(`Of ${total} dormant leads loaded, ${contacted} were cleared and contacted. ${replied} replied, ${booked} booked a consultation, and ${optedOut} opted out and were suppressed.${booked > 0 ? ` Booked leads average ${avgKw.toFixed(1)} kW in estimated system size — representing $${revenueStats.recovered.toLocaleString()} in recovered revenue.` : ""} ${counts.review} leads remain in manual review pending consent verification or legal sign-off.`);
    logAudit("User", "Report generated", "Campaign summary");
  }

  function trainVoice() {
    if (!training.voiceSample) return;
    setTrainingVoice(true);
    // Voice analysis (tone/formality detection from writing samples) needs an
    // LLM call, which requires a backend to hold the API key safely. Using a
    // sensible default profile until that's wired up.
    setTraining((t) => ({ ...t, voiceProfile: { tone: "personal", formality: "mixed", signature_phrases: ["locally owned", "honest assessments", "no pressure"] }, trained: true }));
    logAudit("User", "Voice profile trained", `${training.companyName}: default profile applied`);
    setTrainingVoice(false);
  }

  function navDotColor(id) {
    if (id === "pipeline") return counts.review > 0 ? C.amber : C.teal;
    if (id === "dashboard") return revenueStats.bookedCount > 0 ? C.teal : C.amber;
    if (id === "audit") return auditLog.length > 0 ? C.violet : C.textFaint;
    if (id === "execution") return executionLog.length > 0 ? C.teal : C.textFaint;
    if (id === "integrations") return integrations.some((i) => i.connected) ? C.teal : C.textFaint;
    if (id === "deploy") return killSwitch ? C.coral : C.teal;
    if (id === "report") return revenueStats.bookedCount > 0 ? C.teal : C.textFaint;
    if (id === "training") return training.trained ? C.teal : C.amber;
    return C.textFaint;
  }

  if (!loaded) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, color: C.textMuted, fontFamily: "Inter, sans-serif" }}>Loading saved state…</div>
  );

  const activeLabel = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.id === view)?.label || "Dashboard";

  return (
    <div style={{ fontFamily: "'Inter', sans-serif", background: C.bg, minHeight: "100vh", color: C.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        .cp { font-family: 'Chakra Petch', sans-serif; }
        .mono { font-family: 'IBM Plex Mono', monospace; }
        button { font-family: inherit; }
        .card { transition: border-color 0.15s, transform 0.15s; }
        .card:hover { transform: translateY(-1px); border-color: ${C.borderLight} !important; }
        .sidebar { position: fixed; top: 0; left: 0; bottom: 0; width: 60px; background: ${C.panel}; border-right: 1px solid ${C.border}; transition: width 0.18s; z-index: 40; overflow: hidden; }
        .sidebar.open { width: 226px; }
        .main-wrap { margin-left: 60px; transition: margin-left 0.18s; min-height: 100vh; }
        .main-wrap.shifted { margin-left: 226px; }
        .sidebar-backdrop { display: none; }
        .lanes { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; padding: 0 24px 24px; }
        .dash-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; }
        .wow-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 1px; }
        .decision-feed { display: flex; flex-direction: column; gap: 10px; }
        input, select, textarea { background: ${C.panelAlt}; color: ${C.text}; }
        input::placeholder, textarea::placeholder { color: ${C.textFaint}; }
        @media (max-width: 800px) {
          .sidebar { width: 0; border: none; }
          .sidebar.open { width: 250px; border-right: 1px solid ${C.border}; }
          .main-wrap, .main-wrap.shifted { margin-left: 0; }
          .sidebar-backdrop.show { display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 35; }
          .lanes { grid-template-columns: 1fr; padding: 0 14px 20px; }
          .dash-grid { grid-template-columns: 1fr 1fr; }
          .wow-grid { grid-template-columns: 1fr 1fr; }
          .modal-box { width: 100% !important; border-radius: 14px 14px 0 0 !important; position: fixed; bottom: 0; left: 0; max-height: 92vh !important; }
        }
      `}</style>

      <div className={`sidebar-backdrop ${sidebarOpen ? "show" : ""}`} onClick={() => setSidebarOpen(false)} />

      {/* SIDEBAR */}
      <div className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div style={{ padding: "16px 0 8px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px", height: 40 }}>
            <Zap size={16} color={C.amber} style={{ flexShrink: 0 }} />
            {sidebarOpen && <span className="cp" style={{ fontSize: 14, fontWeight: 700, color: C.text, whiteSpace: "nowrap" }}>REVENUE OS</span>}
          </div>
        </div>
        <div style={{ padding: "8px 0", overflowY: "auto", height: "calc(100% - 60px)" }}>
          {NAV_GROUPS.map((group) => (
            <div key={group.group} style={{ marginBottom: 4 }}>
              {sidebarOpen && <div style={{ fontSize: 9, color: C.textFaint, fontWeight: 700, letterSpacing: "0.1em", padding: "10px 16px 4px", textTransform: "uppercase" }}>{group.group}</div>}
              {group.items.map((item) => {
                const Icon = item.icon;
                const dotColor = navDotColor(item.id);
                const active = view === item.id;
                return (
                  <button key={item.id} onClick={() => { setView(item.id); setSidebarOpen(false); }}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", background: active ? C.panelAlt : "none", border: "none", cursor: "pointer", color: active ? C.text : C.textMuted, textAlign: "left", borderLeft: `2px solid ${active ? C.amber : "transparent"}`, transition: "all 0.12s" }}>
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <Icon size={16} />
                      <div style={{ position: "absolute", top: -2, right: -2, width: 6, height: 6, borderRadius: "50%", background: dotColor }} />
                    </div>
                    {sidebarOpen && <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, whiteSpace: "nowrap" }}>{item.label}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* MAIN */}
      <div className={`main-wrap ${sidebarOpen ? "shifted" : ""}`}>
        {/* TOP BAR */}
        <div style={{ padding: "12px 20px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: C.panel, flexWrap: "wrap", gap: 10, position: "sticky", top: 0, zIndex: 30 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setSidebarOpen((s) => !s)} style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 8, width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.text, flexShrink: 0 }}>
              <Menu size={16} />
            </button>
            <div>
              <div className="cp" style={{ fontSize: 14, fontWeight: 600, letterSpacing: "0.02em" }}>REVENUE OS <span style={{ color: C.textFaint }}>/ {activeLabel}</span></div>
              <div style={{ display: "flex", gap: 12, marginTop: 3 }}>
                <StatusPill color={C.teal} label="System Healthy" />
                <StatusPill color={C.teal} label="Monitoring" />
                <StatusPill color={killSwitch ? C.coral : C.teal} label={killSwitch ? "Paused" : "Executing"} />
                <StatusPill color={dryRun ? C.violet : C.amber} label={dryRun ? "Mode: Dry Run" : "Mode: Live"} />
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button onClick={() => setDryRun((d) => !d)} className="cp"
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 7, border: `1px solid ${dryRun ? C.violet : C.border}`, background: dryRun ? C.violetBg : C.panelAlt, color: dryRun ? C.violet : C.textMuted, fontWeight: 600, fontSize: 11.5, cursor: "pointer" }}>
              <FlaskConical size={12} /> {dryRun ? "DRY RUN" : "LIVE"}
            </button>
            <button onClick={() => setKillSwitch((k) => !k)} className="cp"
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 7, border: `1.5px solid ${killSwitch ? C.coral : C.teal}`, background: killSwitch ? C.coralBg : C.tealBg, color: killSwitch ? C.coral : C.teal, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
              <Power size={13} /> {killSwitch ? "PAUSED" : "ACTIVE"}
            </button>
          </div>
        </div>

        {dryRun && <Banner color={C.violet} bg={C.violetBg} icon={<FlaskConical size={13} />} text="Dry Run mode — outreach previews but doesn't advance pipeline or touch capacity." />}
        {killSwitch && <Banner color={C.coral} bg={C.coralBg} icon={<Power size={13} />} text="All outbound outreach is paused. No new messages will send until resumed." />}
        {loadError && <Banner color={C.amber} bg={C.amberBg} icon={<AlertTriangle size={13} />} text={loadError} />}

        {/* ── DASHBOARD ── */}
        {view === "dashboard" && (
          <div style={{ padding: "20px 24px" }}>
            <div className="cp" style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Revenue Dashboard</div>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 20 }}>Last 30 days · {withDerived.length} leads evaluated</div>

            {/* WOW strip */}
            <div className="wow-grid" style={{ background: C.border, borderRadius: 12, overflow: "hidden", marginBottom: 20 }}>
              {[
                { label: "Leads Evaluated", value: withDerived.length, icon: Target, color: C.textMuted },
                { label: "Contacted", value: stageCounts.contacted + stageCounts.followed_up + stageCounts.replied + stageCounts.qualified + stageCounts.booked, icon: Send, color: C.amber },
                { label: "Meetings Booked", value: stageCounts.booked, icon: CheckCircle2, color: C.teal },
                { label: "Revenue Activated", value: `$${revenueStats.recovered.toLocaleString()}`, icon: DollarSign, color: C.gold },
              ].map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={i} style={{ background: C.panel, padding: "20px 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <Icon size={14} color={s.color} />
                      <span style={{ fontSize: 11, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</span>
                    </div>
                    <div className="cp" style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
                  </div>
                );
              })}
            </div>

            {/* Decision Feed */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div className="cp" style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <Activity size={14} color={C.amber} /> DECISION FEED
                </div>
                <div className="decision-feed">
                  {withDerived.slice(0, 5).map((lead) => {
                    const cfg = STATUS_CONFIG[lead.compliance.status]; const Icon = cfg.icon;
                    const confidence = lead.score;
                    const outcome = lead.compliance.status === "cleared"
                      ? lead.pipelineStage === "not_contacted" ? "Ready to contact" : STAGE_LABEL[lead.pipelineStage]
                      : lead.compliance.reason.slice(0, 45) + "…";
                    return (
                      <div key={lead.id} onClick={() => { setSelectedId(lead.id); setView("pipeline"); }} className="card"
                        style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 9, padding: "12px 14px", cursor: "pointer" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <Icon size={13} color={cfg.color} />
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{lead.name}</span>
                          </div>
                          <span className="mono" style={{ fontSize: 10, color: C.textFaint }}>{lead.id}</span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                          <DecisionField label="Action" value={lead.compliance.status === "cleared" ? "Send outreach" : "Manual review"} />
                          <DecisionField label="Confidence" value={`${confidence}/100`} color={confidence >= 70 ? C.teal : confidence >= 45 ? C.amber : C.coral} />
                          <DecisionField label="Reason" value={COLD_REASON_LABEL[lead.coldReason]} />
                          <DecisionField label="Expected outcome" value={outcome} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="cp" style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                  <Activity size={14} color={C.teal} /> PIPELINE HEALTH
                </div>
                <div style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 9, overflow: "hidden", marginBottom: 12 }}>
                  {STAGE_ORDER.map((s, i) => (
                    <div key={s} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: i < STAGE_ORDER.length - 1 ? `1px solid ${C.border}` : "none" }}>
                      <span style={{ fontSize: 12, color: C.textMuted }}>{STAGE_LABEL[s]}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 60, height: 4, background: C.border, borderRadius: 2 }}>
                          <div style={{ height: "100%", width: `${Math.min((stageCounts[s] / withDerived.length) * 100, 100)}%`, background: s === "booked" ? C.teal : s === "opted_out" ? C.coral : C.amber, borderRadius: 2 }} />
                        </div>
                        <span className="mono" style={{ fontSize: 11, fontWeight: 600, minWidth: 16, textAlign: "right" }}>{stageCounts[s]}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 9, padding: "14px" }}>
                  <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 8 }}>Compliance gate summary</div>
                  {["cleared","review","suppressed"].map((s) => {
                    const cfg = STATUS_CONFIG[s]; const Icon = cfg.icon;
                    return (
                      <div key={s} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon size={12} color={cfg.color} /><span style={{ fontSize: 12 }}>{cfg.label}</span></div>
                        <span className="cp" style={{ fontSize: 14, fontWeight: 700, color: cfg.color }}>{counts[s]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── PIPELINE ── */}
        {view === "pipeline" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 1, background: C.border, margin: "20px 24px 12px", borderRadius: 10, overflow: "hidden" }}>
              {["cleared","review","suppressed"].map((s) => { const cfg = STATUS_CONFIG[s]; const Icon = cfg.icon; return (
                <div key={s} style={{ background: C.panel, padding: "14px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}><Icon size={14} color={cfg.color} /><span style={{ fontSize: 11, color: C.textMuted }}>{cfg.label.toUpperCase()}</span></div>
                  <div className="cp" style={{ fontSize: 26, fontWeight: 700, color: cfg.color }}>{counts[s]}</div>
                </div>
              ); })}
            </div>
            <div style={{ display: "flex", gap: 7, margin: "0 20px 20px", flexWrap: "wrap" }}>
              {STAGE_ORDER.map((s) => (
                <div key={s} className="mono" style={{ fontSize: 10, padding: "4px 9px", borderRadius: 999, background: C.panelAlt, border: `1px solid ${C.border}`, color: C.textMuted }}>
                  {STAGE_LABEL[s].toUpperCase()}: <b style={{ color: C.text }}>{stageCounts[s]}</b>
                </div>
              ))}
            </div>
            <div className="lanes">
              {["cleared","review","suppressed"].map((status) => (
                <Lane key={status} status={status} leads={withDerived.filter((l) => l.compliance.status === status)} onSelect={setSelectedId} />
              ))}
            </div>
          </>
        )}

        {/* ── EXECUTION TIMELINE ── */}
        {view === "execution" && (
          <div style={{ padding: "20px 24px" }}>
            <div className="cp" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Execution Timeline</div>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 20 }}>Every agent action logged — evaluate → send → wait → book → update CRM.</div>
            {executionLog.length === 0 ? (
              <div style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 10, padding: "32px", textAlign: "center", color: C.textFaint, fontSize: 13 }}>No execution events yet. Start interacting with leads in the Pipeline.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {[...executionLog].reverse().map((e) => {
                  const statusColor = e.status === "OK" || e.status === "SCRIPTED" ? C.teal : e.status === "DRY RUN" ? C.violet : e.status === "BLOCKED" || e.status === "SUPPRESSED" ? C.coral : e.status === "RETRY" ? C.amber : C.textMuted;
                  return (
                    <div key={e.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "9px 14px", background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 7, flexWrap: "wrap" }}>
                      <span className="mono" style={{ fontSize: 10, color: C.textFaint, paddingTop: 2, minWidth: 55 }}>{new Date(e.ts).toLocaleTimeString()}</span>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <span style={{ fontWeight: 600, fontSize: 12 }}>{e.leadName}</span>
                        <span className="mono" style={{ fontSize: 10, color: C.textFaint, marginLeft: 6 }}>{e.leadId}</span>
                        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{e.step} · <span style={{ color: C.textFaint }}>{e.note}</span></div>
                      </div>
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: `${statusColor}18`, color: statusColor, fontWeight: 600, whiteSpace: "nowrap" }}>{e.status}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── LEDGER ── */}
        {view === "ledger" && (
          <div style={{ padding: "20px 24px" }}>
            <div className="cp" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Ownership Ledger</div>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 20 }}>Automatic assignment — original rep, departed-rep pooling, {policy.dormancyResetMonths}mo dormancy reset.</div>
            {withDerived.map((l) => (
              <div key={l.id} style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 16px", marginBottom: 8, display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ minWidth: 120 }}><div style={{ fontWeight: 600, fontSize: 13 }}>{l.name}</div><div className="mono" style={{ fontSize: 10, color: C.textFaint }}>{l.id}</div></div>
                <div style={{ flex: 1, minWidth: 160 }}><div style={{ fontSize: 13, fontWeight: 500 }}>{l.ownership.owner}</div><div style={{ fontSize: 11, color: C.textMuted }}>{l.ownership.rationale}</div></div>
              </div>
            ))}
          </div>
        )}

        {/* ── REPORT ── */}
        {view === "report" && (
          <div style={{ padding: "20px 24px", maxWidth: 760 }}>
            <div className="cp" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Revenue Report</div>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 20 }}>Campaign outcomes — plain language, ready to forward.</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, marginBottom: 20 }}>
              {[
                { label: "Revenue Activated", value: `$${revenueStats.recovered.toLocaleString()}`, color: C.teal },
                { label: "Pipeline Value", value: `$${revenueStats.pipelineValue.toLocaleString()}`, color: C.amber },
                { label: "Meetings Booked", value: revenueStats.bookedCount, color: C.teal },
                { label: "Leads in Pipeline", value: revenueStats.pipelineCount, color: C.amber },
              ].map((s, i) => (
                <div key={i} style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 4 }}>{s.label}</div>
                  <div className="cp" style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
            <button onClick={generateSummary} className="cp"
              style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: C.amber, color: C.bg, fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
              <FileText size={14} /> Generate written summary
            </button>
            {summary && <div style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18, fontSize: 14, lineHeight: 1.7, color: C.textMuted }}>{summary}</div>}
          </div>
        )}

        {/* ── AUDIT ── */}
        {view === "audit" && (
          <div style={{ padding: "20px 24px" }}>
            <div className="cp" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Audit Timeline</div>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 20 }}>Every compliance gate decision, outreach action, and system event — logged with actor, action, and detail.</div>
            {auditLog.length === 0 ? (
              <div style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 10, padding: "28px", textAlign: "center", color: C.textFaint, fontSize: 13 }}>No entries yet. Interact with leads to generate a log.</div>
            ) : [...auditLog].reverse().map((e) => (
              <div key={e.id} style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 7, padding: "10px 14px", marginBottom: 7, display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                <span className="mono" style={{ fontSize: 10, color: C.textFaint, paddingTop: 2, minWidth: 55 }}>{new Date(e.ts).toLocaleTimeString()}</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: e.actor === "System" ? C.coral : e.actor === "Lead" ? C.amber : C.teal }}>{e.actor}</span>
                  <span style={{ fontSize: 12, color: C.textMuted, marginLeft: 6 }}>{e.action}</span>
                  <div style={{ fontSize: 11, color: C.textFaint, marginTop: 2 }}>{e.detail}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── CONFIG ── */}
        {view === "config" && (
          <div style={{ padding: "20px 24px", maxWidth: 680 }}>
            <div className="cp" style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Policy & Config</div>
            <Section title="Source-of-Truth Pricing" note="AI pulls only from these fields — never guesses or hallucinates.">
              {[["Federal tax credit", "federalCredit"], ["Active promo", "promo"], ["Current panel model", "panelModel"], ["Revenue per kW ($)", "revenuePerKw"]].map(([label, key]) => (
                <ConfigField key={key} label={label} value={config[key]} onChange={(v) => setConfig((c) => ({ ...c, [key]: key === "revenuePerKw" ? Number(v) : v }))} />
              ))}
            </Section>
            <Section title="Compliance Policy">
              {[["Consent freshness cap (months)", "freshnessMonths"], ["Dormancy ownership reset (months)", "dormancyResetMonths"]].map(([label, key]) => (
                <ConfigField key={key} label={label} value={policy[key]} onChange={(v) => setPolicy((p) => ({ ...p, [key]: Number(v) }))} type="number" />
              ))}
            </Section>
            <Section title="State Compliance Overlays" note="Applied automatically per lead's state — overrides global freshness cap if stricter.">
              {Object.entries(STATE_RULES).map(([code, rule]) => (
                <div key={code} style={{ background: C.panelAlt, border: `1px solid ${RISK_COLOR[rule.riskLevel]}44`, borderRadius: 8, padding: "11px 13px", marginBottom: 8 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                    <span className="cp" style={{ fontWeight: 700, fontSize: 13 }}>{rule.name}</span>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: `${RISK_COLOR[rule.riskLevel]}18`, color: RISK_COLOR[rule.riskLevel], fontWeight: 600 }}>{rule.riskLevel.toUpperCase()} RISK</span>
                    <span className="mono" style={{ fontSize: 10, color: C.textFaint, marginLeft: "auto" }}>Cap: {rule.freshnessCap}mo</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted }}>{rule.notes}</div>
                </div>
              ))}
            </Section>
            <Section title="Install Capacity by Territory">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {Object.entries(capacity).map(([t, slots]) => (
                  <div key={t} style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 7, padding: "9px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12 }}>{t}</span>
                    <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: slots === 0 ? C.coral : C.teal }}>{slots} open</span>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        )}

        {/* ── TRAINING ── */}
        {view === "training" && (
          <div style={{ padding: "20px 24px", maxWidth: 700 }}>
            <div className="cp" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Voice Training</div>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 20 }}>Train the AI on your company's voice, objection scripts, and rules. Every message it generates will sound like you — not a generic robot.</div>
            <Section title="Company Identity">
              <ConfigField label="Company name" value={training.companyName} onChange={(v) => setTraining((t) => ({ ...t, companyName: v }))} placeholder="Revenue OS" />
              <ConfigField label="Owner / agent name (used in sign-offs)" value={training.ownerName} onChange={(v) => setTraining((t) => ({ ...t, ownerName: v }))} placeholder="Kaddy" />
            </Section>
            <Section title="Voice Sample">
              <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>Paste emails, About page copy, review responses — anything that shows how the company naturally talks to customers.</div>
              <textarea value={training.voiceSample} rows={5} onChange={(e) => setTraining((t) => ({ ...t, voiceSample: e.target.value }))}
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, resize: "vertical" }} />
              <button onClick={trainVoice} disabled={trainingVoice || !training.voiceSample} className="cp"
                style={{ marginTop: 10, padding: "9px 16px", borderRadius: 7, border: "none", background: C.amber, color: C.bg, fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, opacity: trainingVoice ? 0.6 : 1 }}>
                <Sparkles size={13} /> {trainingVoice ? "Analysing…" : "Extract Voice Profile"}
              </button>
              {training.trained && training.voiceProfile && (
                <div style={{ marginTop: 12, background: C.tealBg, border: `1px solid ${C.teal}44`, borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.teal, marginBottom: 8 }}>✓ Voice profile extracted</div>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                    <Pill label={`Tone: ${training.voiceProfile.tone}`} color={C.teal} />
                    <Pill label={`Formality: ${training.voiceProfile.formality}`} color={C.teal} />
                    {training.voiceProfile.signature_phrases?.map((p, i) => <Pill key={i} label={`"${p}"`} color={C.textMuted} />)}
                  </div>
                </div>
              )}
            </Section>
            <Section title="Objection Scripts" note="AI uses EXACT responses when trigger keywords are detected — no freeform guessing.">
              {(training.objections || []).map((obj, i) => (
                <div key={i} style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: "12px 14px", marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>Objection {i + 1}</span>
                    <button onClick={() => setTraining((t) => ({ ...t, objections: t.objections.filter((_, j) => j !== i) }))}
                      style={{ background: "none", border: "none", cursor: "pointer", color: C.coral, fontSize: 11 }}>Remove</button>
                  </div>
                  <div style={{ fontSize: 11, color: C.textFaint, marginBottom: 4 }}>Trigger keywords (pipe-separated)</div>
                  <input value={obj.trigger} onChange={(e) => setTraining((t) => ({ ...t, objections: t.objections.map((o, j) => j === i ? { ...o, trigger: e.target.value } : o) }))}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12, marginBottom: 8 }} />
                  <div style={{ fontSize: 11, color: C.textFaint, marginBottom: 4 }}>Exact response</div>
                  <textarea value={obj.response} rows={3} onChange={(e) => setTraining((t) => ({ ...t, objections: t.objections.map((o, j) => j === i ? { ...o, response: e.target.value } : o) }))}
                    style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12, resize: "vertical" }} />
                </div>
              ))}
              <button onClick={() => setTraining((t) => ({ ...t, objections: [...(t.objections || []), { trigger: "", response: "" }] }))}
                style={{ padding: "7px 12px", borderRadius: 6, border: `1px dashed ${C.border}`, background: "transparent", fontSize: 12, cursor: "pointer", color: C.textMuted }}>
                + Add objection
              </button>
            </Section>
            <Section title="Do-Not-Say List" note="If any outgoing message contains these phrases, it is blocked before sending.">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
                {(training.doNotSay || []).map((phrase, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, background: C.coralBg, border: `1px solid ${C.coral}44` }}>
                    <span style={{ fontSize: 12, color: C.coral }}>{phrase}</span>
                    <button onClick={() => setTraining((t) => ({ ...t, doNotSay: t.doNotSay.filter((_, j) => j !== i) }))}
                      style={{ background: "none", border: "none", cursor: "pointer", color: C.coral, padding: 0, display: "flex" }}><X size={11} /></button>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 7 }}>
                <input value={newDoNotSay} onChange={(e) => setNewDoNotSay(e.target.value)} placeholder="Add phrase…"
                  style={{ flex: 1, padding: "7px 10px", borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12 }} />
                <button onClick={() => { if (newDoNotSay.trim()) { setTraining((t) => ({ ...t, doNotSay: [...(t.doNotSay || []), newDoNotSay.trim()] })); setNewDoNotSay(""); } }}
                  style={{ padding: "7px 12px", borderRadius: 6, border: "none", background: C.amber, color: C.bg, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>Add</button>
              </div>
            </Section>
          </div>
        )}

        {/* ── INTEGRATIONS ── */}
        {view === "integrations" && (
          <div style={{ padding: "20px 24px", maxWidth: 680 }}>
            <div className="cp" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Integrations</div>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 20 }}>Connect your CRM, SMS, calendar, and permitting data to make outreach and booking fully automated.</div>
            {integrations.map((intg) => (
              <div key={intg.id} style={{ background: C.panelAlt, border: `1px solid ${intg.connected ? C.teal : C.border}`, borderRadius: 10, padding: "16px 18px", marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Plug size={15} color={intg.connected ? C.teal : C.textMuted} />
                    <span className="cp" style={{ fontSize: 14, fontWeight: 600 }}>{intg.label}</span>
                    {intg.connected && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: C.tealBg, color: C.teal, fontWeight: 600 }}>CONNECTED</span>}
                  </div>
                  <button onClick={() => setIntegrations((p) => p.map((i) => i.id === intg.id ? { ...i, connected: !i.connected } : i))} className="cp"
                    style={{ padding: "6px 12px", borderRadius: 6, border: `1px solid ${intg.connected ? C.coral : C.teal}`, background: "none", color: intg.connected ? C.coral : C.teal, fontWeight: 600, fontSize: 11, cursor: "pointer" }}>
                    {intg.connected ? "Disconnect" : "Connect"}
                  </button>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <select value={intg.selected} onChange={(e) => setIntegrations((p) => p.map((i) => i.id === intg.id ? { ...i, selected: e.target.value } : i))}
                    style={{ flex: 1, padding: "7px 10px", borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12 }}>
                    {intg.options.map((o) => <option key={o}>{o}</option>)}
                  </select>
                  <input value={intg.apiKey} onChange={(e) => setIntegrations((p) => p.map((i) => i.id === intg.id ? { ...i, apiKey: e.target.value } : i))}
                    placeholder="API key…" type="password"
                    style={{ flex: 2, padding: "7px 10px", borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12 }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── DEPLOY ── */}
        {view === "deploy" && (
          <div style={{ padding: "20px 24px", maxWidth: 640 }}>
            <div className="cp" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Deploy</div>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 20 }}>System controls — go live, pause, or reset the campaign.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <ControlCard title="Kill Switch" desc={killSwitch ? "All outreach is currently paused." : "System is actively running."} color={killSwitch ? C.coral : C.teal}>
                <button onClick={() => setKillSwitch((k) => !k)} className="cp"
                  style={{ padding: "9px 18px", borderRadius: 7, border: "none", background: killSwitch ? C.teal : C.coral, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  {killSwitch ? "Resume outreach" : "Pause all outreach"}
                </button>
              </ControlCard>
              <ControlCard title="Dry Run Mode" desc={dryRun ? "Previewing messages only — nothing is actually sent." : "Live mode — messages are sent for real."} color={dryRun ? C.violet : C.amber}>
                <button onClick={() => setDryRun((d) => !d)} className="cp"
                  style={{ padding: "9px 18px", borderRadius: 7, border: "none", background: dryRun ? C.amber : C.violet, color: dryRun ? C.bg : "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  {dryRun ? "Switch to Live" : "Switch to Dry Run"}
                </button>
              </ControlCard>
              <ControlCard title="Reset Campaign" desc="Clears all lead state, messages, audit log, and stored data. Cannot be undone." color={C.coral}>
                <button onClick={resetAll} className="cp"
                  style={{ padding: "9px 18px", borderRadius: 7, border: `1px solid ${C.coral}`, background: "none", color: C.coral, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  Reset everything
                </button>
              </ControlCard>
            </div>
          </div>
        )}
      </div>

      {/* LEAD DETAIL MODAL */}
      {selected && (
        <LeadModal
          lead={selected} onClose={() => setSelectedId(null)} config={config}
          canSend={selected.pipelineStage === "not_contacted"} canFollowUp={selected.pipelineStage === "contacted" && selected.messages.filter((m) => m.from === "lead").length === 0}
          canReply={["contacted","followed_up"].includes(selected.pipelineStage)}
          aiLoading={aiLoading}
          onSend={() => sendOutreach(selected)} onFollowUp={() => sendFollowUp(selected)}
          onReply={(opt) => simulateReply(selected, opt)} onVerify={() => verifyData(selected)}
          onReviewAction={() => handleReviewAction(selected)}
          reviewAction={selected.compliance.subReason && REVIEW_ACTIONS[selected.compliance.subReason] ? REVIEW_ACTIONS[selected.compliance.subReason] : null}
        />
      )}
    </div>
  );
}

// ============ SUB-COMPONENTS ============
function StatusPill({ color, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <div style={{ width: 5, height: 5, borderRadius: "50%", background: color }} />
      <span className="mono" style={{ fontSize: 9.5, color: C.textFaint }}>{label}</span>
    </div>
  );
}
function Banner({ color, bg, icon, text }) {
  return <div style={{ background: bg, borderBottom: `1px solid ${C.border}`, padding: "9px 20px", color, fontSize: 12.5, fontWeight: 500, display: "flex", alignItems: "center", gap: 7 }}>{icon}{text}</div>;
}
function Section({ title, note, children }) {
  return (
    <div style={{ background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 18px", marginBottom: 16 }}>
      <div className="cp" style={{ fontSize: 13, fontWeight: 700, marginBottom: note ? 4 : 14 }}>{title}</div>
      {note && <div style={{ fontSize: 11, color: C.textMuted, marginBottom: 12 }}>{note}</div>}
      {children}
    </div>
  );
}
function ConfigField({ label, value, onChange, type = "text", placeholder = "" }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: C.textFaint, marginBottom: 4 }}>{label}</div>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={{ width: "100%", padding: "8px 11px", borderRadius: 7, border: `1px solid ${C.border}`, fontSize: 13 }} />
    </div>
  );
}
function Pill({ label, color }) {
  return <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 999, background: `${color}18`, color, fontWeight: 500 }}>{label}</span>;
}
function DecisionField({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 9.5, color: C.textFaint, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 11.5, fontWeight: 500, color: color || C.text }}>{value}</div>
    </div>
  );
}
function ControlCard({ title, desc, color, children }) {
  return (
    <div style={{ background: C.panelAlt, border: `1px solid ${color}44`, borderRadius: 10, padding: "16px 18px" }}>
      <div className="cp" style={{ fontSize: 14, fontWeight: 700, color, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 14 }}>{desc}</div>
      {children}
    </div>
  );
}
function Lane({ status, leads, onSelect }) {
  const cfg = STATUS_CONFIG[status]; const Icon = cfg.icon;
  return (
    <div style={{ background: C.panel, borderRadius: 12, border: `1px solid ${C.border}`, overflow: "hidden" }}>
      <div style={{ padding: "11px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8, background: cfg.bg }}>
        <Icon size={14} color={cfg.color} />
        <span className="cp" style={{ fontWeight: 600, fontSize: 12.5, color: cfg.color }}>{cfg.label.toUpperCase()}</span>
        <span className="mono" style={{ marginLeft: "auto", fontSize: 11, color: cfg.color }}>{leads.length}</span>
      </div>
      <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        {leads.length === 0 && <div style={{ fontSize: 12, color: C.textFaint, padding: "12px 6px", textAlign: "center" }}>No leads.</div>}
        {leads.map((lead) => (
          <div key={lead.id} className="card" onClick={() => onSelect(lead.id)}
            style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: "11px 12px", cursor: "pointer", background: C.panelAlt }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div><div style={{ fontWeight: 600, fontSize: 13 }}>{lead.name}</div><div style={{ fontSize: 11, color: C.textMuted }}>{lead.city}</div></div>
              <div style={{ textAlign: "right" }}><div className="mono" style={{ fontSize: 9.5, color: C.textFaint }}>{lead.id}</div><div className="mono" style={{ fontSize: 13, fontWeight: 700, color: lead.score >= 70 ? C.teal : lead.score >= 45 ? C.amber : C.coral }}>{lead.score}</div></div>
            </div>
            <div style={{ marginTop: 8, display: "flex", gap: 5, flexWrap: "wrap" }}>
              <Pill label={STAGE_LABEL[lead.pipelineStage]} color={C.textMuted} />
              {lead.stateRule && <Pill label={lead.stateRule.name} color={RISK_COLOR[lead.stateRule.riskLevel]} />}
              {DNC_LIST.includes(lead.id) && <Pill label="DNC" color={C.coral} />}
              {!lead.dataVerified && <Pill label="Unverified" color={C.amber} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
function LeadModal({ lead, onClose, config, canSend, canFollowUp, canReply, aiLoading, onSend, onFollowUp, onReply, onVerify, onReviewAction, reviewAction }) {
  const cfg = STATUS_CONFIG[lead.compliance.status]; const Icon = cfg.icon;
  const b = lead.scoreBreakdown;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 }} onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ background: C.panel, borderRadius: "14px 14px 0 0", width: 520, maxWidth: "100vw", maxHeight: "90vh", overflowY: "auto", padding: 22, border: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div><div className="cp" style={{ fontSize: 17, fontWeight: 700 }}>{lead.name}</div><div className="mono" style={{ fontSize: 12, color: C.textFaint }}>{lead.id} · {lead.city}</div></div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted }}><X size={18} /></button>
        </div>

        {/* State overlay */}
        {lead.stateRule && (
          <div style={{ marginTop: 12, padding: "9px 12px", borderRadius: 7, background: `${RISK_COLOR[lead.stateRule.riskLevel]}15`, border: `1px solid ${RISK_COLOR[lead.stateRule.riskLevel]}44` }}>
            <div style={{ display: "flex", gap: 7, alignItems: "center", marginBottom: 3 }}>
              <AlertTriangle size={12} color={RISK_COLOR[lead.stateRule.riskLevel]} />
              <span style={{ fontSize: 12, fontWeight: 700, color: RISK_COLOR[lead.stateRule.riskLevel] }}>{lead.stateRule.name} — {lead.stateRule.riskLevel.toUpperCase()} RISK</span>
              <span className="mono" style={{ fontSize: 10, color: C.textFaint, marginLeft: "auto" }}>Cap: {lead.stateRule.freshnessCap}mo</span>
            </div>
            <div style={{ fontSize: 11, color: C.textMuted }}>{lead.stateRule.notes}</div>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, padding: "10px 12px", borderRadius: 8, background: cfg.bg }}>
          <Icon size={16} color={cfg.color} /><span style={{ fontWeight: 700, fontSize: 13, color: cfg.color }}>{cfg.label.toUpperCase()}</span>
          {DNC_LIST.includes(lead.id) && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: C.coralBg, color: C.coral, marginLeft: "auto" }}>DNC REGISTRY</span>}
        </div>
        <div style={{ fontSize: 13, color: C.textMuted, marginTop: 8, lineHeight: 1.5 }}>{lead.compliance.reason}</div>

        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Pipeline stage" value={STAGE_LABEL[lead.pipelineStage]} />
          <Field label="Cold reason" value={COLD_REASON_LABEL[lead.coldReason]} />
          <Field label="Owner" value={lead.ownership.owner} />
          <Field label="System size" value={`${lead.systemKw} kW`} />
        </div>
        <div style={{ marginTop: 14, background: C.panelAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}><Info size={12} color={C.textMuted} /><span className="cp" style={{ fontSize: 12, fontWeight: 700 }}>LEAD SCORE: {lead.score}/100</span></div>
          <ScoreBar label="Recency" value={b.recencyScore} weight={b.weights.recency} />
          <ScoreBar label="System size" value={b.sizeScore} weight={b.weights.size} />
          <ScoreBar label="Funnel depth" value={b.stageScore} weight={b.weights.stage} />
          <ScoreBar label="Data confidence" value={b.confidence} weight={b.weights.confidence} />
        </div>

        {!lead.dataVerified && lead.compliance.status !== "suppressed" && (
          <button onClick={onVerify} className="cp" style={{ marginTop: 12, width: "100%", padding: "9px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.panelAlt, color: C.text, fontWeight: 600, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <RefreshCw size={13} /> RE-VERIFY DATA
          </button>
        )}
        {lead.compliance.status === "review" && reviewAction && !DNC_LIST.includes(lead.id) && (
          <button onClick={onReviewAction} className="cp" style={{ marginTop: 12, width: "100%", padding: "11px", borderRadius: 8, border: "none", background: C.amber, color: C.bg, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{reviewAction.label.toUpperCase()}</button>
        )}
        {lead.compliance.status === "suppressed" && (
          <div style={{ marginTop: 12, fontSize: 12, color: C.coral, fontStyle: "italic", display: "flex", alignItems: "center", gap: 6 }}>
            <Ban size={13} /> {DNC_LIST.includes(lead.id) ? "DNC registry — cannot be overridden." : "Opt-out is permanent."}
          </div>
        )}

        {lead.compliance.status === "cleared" && (
          <>
            <div className="cp" style={{ fontSize: 13, fontWeight: 700, marginTop: 20, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><MessageSquare size={14} /> CONVERSATION</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12, maxHeight: 260, overflowY: "auto" }}>
              {lead.messages.length === 0 && <div style={{ fontSize: 12, color: C.textFaint }}>No messages sent yet.</div>}
              {lead.messages.map((m, i) => (
                <div key={i} style={{ alignSelf: m.from === "lead" ? "flex-end" : "flex-start", maxWidth: "88%", padding: "9px 12px", borderRadius: 10, background: m.from === "lead" ? C.amber : m.from === "system" ? C.coralBg : C.panelAlt, color: m.from === "lead" ? C.bg : m.from === "system" ? C.coral : C.text, fontSize: 13, border: m.from !== "lead" ? `1px solid ${C.border}` : "none", whiteSpace: "pre-wrap" }}>
                  {m.text}
                  {(m.tier || m.source) && <div style={{ fontSize: 10, opacity: 0.7, marginTop: 4 }}>{m.tier ? `Tier ${m.tier}` : ""}{m.source ? ` · ${m.source}` : ""}</div>}
                </div>
              ))}
              {aiLoading && <div style={{ fontSize: 12, color: C.textFaint, fontStyle: "italic" }}>AI generating response…</div>}
            </div>
            {canSend && <button onClick={onSend} disabled={aiLoading} className="cp" style={{ width: "100%", padding: "11px", borderRadius: 8, border: "none", background: C.teal, color: C.bg, fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: aiLoading ? 0.6 : 1 }}><Send size={14} /> SEND INITIAL OUTREACH</button>}
            {lead.recentOtherChannel && lead.pipelineStage === "not_contacted" && <div style={{ fontSize: 12, color: C.amber, marginTop: 6 }}>⚠ Dedup check will block this send.</div>}
            {canFollowUp && <button onClick={onFollowUp} disabled={aiLoading} className="cp" style={{ width: "100%", marginTop: 8, padding: "10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.panelAlt, color: C.text, fontWeight: 600, fontSize: 12, cursor: "pointer", opacity: aiLoading ? 0.6 : 1 }}>SEND FOLLOW-UP (Day 4)</button>}
            {canReply && (
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8 }}>Simulate the lead's reply:</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {REPLY_OPTIONS.map((opt) => (
                    <button key={opt.key} onClick={() => onReply(opt)} disabled={aiLoading} style={{ textAlign: "left", padding: "9px 12px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.panelAlt, color: C.text, fontSize: 12.5, cursor: "pointer", opacity: aiLoading ? 0.5 : 1 }}>{opt.label}</button>
                  ))}
                </div>
              </div>
            )}
            {lead.pipelineStage === "booked" && <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6, color: C.teal, fontSize: 13, fontWeight: 700 }}><CheckCircle2 size={15} /> Consultation booked</div>}
            {lead.pipelineStage === "opted_out" && <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6, color: C.coral, fontSize: 13, fontWeight: 700 }}><Ban size={15} /> Opted out — suppressed</div>}
          </>
        )}
      </div>
    </div>
  );
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
function Field({ label, value }) {
  return <div><div style={{ fontSize: 11, color: C.textFaint, fontWeight: 500, marginBottom: 2 }}>{label}</div><div style={{ fontSize: 13, fontWeight: 500 }}>{value}</div></div>;
}
