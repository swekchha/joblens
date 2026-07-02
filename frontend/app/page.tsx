"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

interface UserProfile {
  title: string;
  skills: string;
  years_experience: number;
  education: string;
  notes: string;
}

interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  salary_min: number | null;
  salary_max: number | null;
  description: string;
  url: string;
  created: string;
}

interface MatchAnalysis {
  score: number;
  verdict: "Apply" | "Maybe" | "Skip";
  verdict_reason: string;
  you_have: string[];
  you_lack: string[];
  transferable: string[];
}

interface JobResult {
  job: JobListing;
  analysis: MatchAnalysis;
}

interface SavedJob {
  job_id: string;
  job_title: string;
  company: string;
  location: string;
  url: string;
  score: number;
  verdict: string;
  verdict_reason: string;
  salary_min: number | null;
  salary_max: number | null;
  created_at: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const VERDICT_CONFIG = {
  Apply: { bg: "rgba(220,252,231,0.9)", darkBg: "rgba(20,83,45,0.4)", text: "#15803D", darkText: "#86efac", border: "#BBF7D0", darkBorder: "#166534", ring: "#16A34A", emoji: "🟢" },
  Maybe: { bg: "rgba(254,249,195,0.9)", darkBg: "rgba(113,63,18,0.4)", text: "#A16207", darkText: "#fde68a", border: "#FEF08A", darkBorder: "#92400E", ring: "#CA8A04", emoji: "🟡" },
  Skip:  { bg: "rgba(254,226,226,0.9)", darkBg: "rgba(127,29,29,0.4)", text: "#B91C1C", darkText: "#fca5a5", border: "#FECACA", darkBorder: "#991B1B", ring: "#DC2626", emoji: "🔴" },
};

const LOCATIONS = [
  { label: "United States", value: "us" },
  { label: "United Kingdom", value: "gb" },
  { label: "Canada", value: "ca" },
  { label: "Australia", value: "au" },
  { label: "Germany", value: "de" },
  { label: "France", value: "fr" },
  { label: "India", value: "in" },
  { label: "Singapore", value: "sg" },
];

const LOADING_STEPS = [
  { icon: "🔍", text: "Finding jobs" },
  { icon: "📖", text: "Reading descriptions" },
  { icon: "🧠", text: "Scoring matches" },
  { icon: "✨", text: "Ranking results" },
];

const DEFAULT_PROFILE: UserProfile = { title: "", skills: "", years_experience: 0, education: "", notes: "" };

// ── Helpers ────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }
  return res.json();
}

function formatSalary(min: number | null, max: number | null): string {
  if (!min && !max) return "";
  const fmt = (n: number) => `$${(n / 1000).toFixed(0)}k`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `From ${fmt(min)}`;
  return `Up to ${fmt(max!)}`;
}

function cleanCompanyName(name: string): string {
  return name.replace(/ s /g, "'s ").replace(/ s$/g, "'s");
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
  try {
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  } catch { return ""; }
}

function getCompanyDomain(company: string): string {
  return cleanCompanyName(company)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+(inc|corp|llc|ltd|co|company|group|holdings|solutions|technologies|services|systems)$/g, "")
    .trim().replace(/\s+/g, "");
}

// ── Company Logo ───────────────────────────────────────────────────────────

function CompanyLogo({ company, size = 48, dark }: { company: string; size?: number; dark: boolean }) {
  const [loaded, setLoaded] = useState(false);
  const domain = getCompanyDomain(company);
  const logoUrl = `https://logo.clearbit.com/${domain}.com`;
  const palettes = [["#DBEAFE","#1D4ED8"],["#D1FAE5","#065F46"],["#FEE2E2","#991B1B"],["#FEF3C7","#92400E"],["#EDE9FE","#5B21B6"],["#FCE7F3","#9D174D"]];
  const darkPalettes = [["#1e3a5f","#93c5fd"],["#064e3b","#6ee7b7"],["#7f1d1d","#fca5a5"],["#451a03","#fcd34d"],["#2e1065","#c4b5fd"],["#500724","#f9a8d4"]];
  const idx = company.charCodeAt(0) % palettes.length;
  const [bg, text] = dark ? darkPalettes[idx] : palettes[idx];
  const initials = cleanCompanyName(company).split(" ").filter(w => w.length > 2).slice(0, 2).map(w => w[0].toUpperCase()).join("") || company[0]?.toUpperCase() || "?";

  return (
    <div className="relative shrink-0 rounded-xl overflow-hidden" style={{ width: size, height: size }}>
      <div className="absolute inset-0 flex items-center justify-center text-[13px] font-bold rounded-xl transition-colors duration-300"
        style={{ backgroundColor: bg, color: text }}>
        {initials}
      </div>
      <img src={logoUrl} alt={company}
        className="absolute inset-0 rounded-xl object-contain p-1 transition-opacity duration-500"
        style={{ opacity: loaded ? 1 : 0, backgroundColor: dark ? "#1e293b" : "white", width: size, height: size }}
        onLoad={() => setLoaded(true)} onError={() => {}} />
    </div>
  );
}

// ── Score Ring ─────────────────────────────────────────────────────────────

function ScoreRing({ score, verdict, dark }: { score: number; verdict: "Apply" | "Maybe" | "Skip"; dark: boolean }) {
  const [anim, setAnim] = useState(0);
  const config = VERDICT_CONFIG[verdict];
  const r = 22; const circ = 2 * Math.PI * r;

  useEffect(() => {
    const t = setTimeout(() => setAnim(score), 150);
    return () => clearTimeout(t);
  }, [score]);

  return (
    <div className="flex flex-col items-center gap-1 shrink-0 w-16">
      <div className="relative w-14 h-14">
        <svg viewBox="0 0 52 52" className="w-full h-full -rotate-90">
          <circle cx="26" cy="26" r={r} fill="none" stroke={dark ? "#334155" : "#F1F5F9"} strokeWidth="5" />
          <circle cx="26" cy="26" r={r} fill="none" stroke={config.ring} strokeWidth="5"
            strokeDasharray={circ} strokeDashoffset={circ - (anim / 100) * circ}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)" }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-[16px] font-black ${dark ? "text-white" : "text-[#0F172A]"}`}>{anim}</span>
        </div>
      </div>
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors duration-300"
        style={dark
          ? { backgroundColor: config.darkBg, color: config.darkText, borderColor: config.darkBorder }
          : { backgroundColor: config.bg, color: config.text, borderColor: config.border }}>
        {config.emoji} {verdict}
      </span>
    </div>
  );
}

// ── Loading Screen ─────────────────────────────────────────────────────────

function LoadingScreen({ dark }: { dark: boolean }) {
  const [step, setStep] = useState(0);
  const [dots, setDots] = useState("");

  useEffect(() => {
    const s = setInterval(() => setStep(p => Math.min(p + 1, LOADING_STEPS.length - 1)), 6000);
    const d = setInterval(() => setDots(p => p.length >= 3 ? "" : p + "."), 400);
    return () => { clearInterval(s); clearInterval(d); };
  }, []);

  return (
    <div className={`rounded-2xl border overflow-hidden transition-colors duration-300 ${dark ? "bg-[#1e293b] border-[#334155]" : "bg-white border-[#E2E8F0]"}`}>
      <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #2563EB, #7C3AED, #2563EB)", backgroundSize: "200%", animation: "shimmer 2s linear infinite" }} />
      <div className="p-10 text-center">
        <div className="text-[52px] mb-4 leading-none select-none" style={{ animation: "float 2s ease-in-out infinite alternate" }}>
          {LOADING_STEPS[step].icon}
        </div>
        <p className={`text-[17px] font-bold mb-1 transition-colors ${dark ? "text-white" : "text-[#0F172A]"}`}>
          {LOADING_STEPS[step].text}{dots}
        </p>
        <p className={`text-[13px] transition-colors ${dark ? "text-[#64748B]" : "text-[#94A3B8]"}`}>
          Scoring every job against your profile
        </p>

        <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
          {LOADING_STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all duration-500 ${
                i < step ? "bg-[#DCFCE7] text-[#15803D]"
                : i === step ? `${dark ? "bg-[#1e3a5f] text-[#93c5fd]" : "bg-[#EFF6FF] text-[#2563EB]"} shadow-sm scale-105`
                : dark ? "bg-[#0f172a] text-[#334155]" : "bg-[#F8FAFC] text-[#CBD5E1]"
              }`}>
                <span>{s.icon}</span>
                <span className="hidden sm:inline">{s.text}</span>
                {i < step && <span className="text-[10px]">✓</span>}
              </div>
              {i < LOADING_STEPS.length - 1 && (
                <div className={`w-4 h-px transition-colors duration-500 ${i < step ? "bg-[#16A34A]" : dark ? "bg-[#334155]" : "bg-[#E2E8F0]"}`} />
              )}
            </div>
          ))}
        </div>

        <div className={`mt-5 mx-auto max-w-xs h-1.5 rounded-full overflow-hidden ${dark ? "bg-[#334155]" : "bg-[#F1F5F9]"}`}>
          <div className="h-full rounded-full transition-all duration-[6000ms] ease-out"
            style={{ width: `${((step + 1) / LOADING_STEPS.length) * 88}%`, background: "linear-gradient(90deg, #2563EB, #7C3AED)" }} />
        </div>
      </div>
      <style>{`
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes float { from { transform: translateY(0px) rotate(-3deg); } to { transform: translateY(-10px) rotate(3deg); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes popIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .slide-up { animation: slideUp 0.4s ease forwards; }
        .pop-in { animation: popIn 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards; }
      `}</style>
    </div>
  );
}

// ── Job Card ───────────────────────────────────────────────────────────────

function JobCard({ result, onSave, isSaved, rank, visible, dark }: {
  result: JobResult; onSave: (r: JobResult) => void;
  isSaved: boolean; rank: number; visible: boolean; dark: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [hovered, setHovered] = useState(false);
  const { job, analysis } = result;
  const config = VERDICT_CONFIG[analysis.verdict];
  const salary = formatSalary(job.salary_min, job.salary_max);
  const posted = timeAgo(job.created);

  function handleSave() {
    if (isSaved) return;
    onSave(result);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  }

  const cardBg = dark ? "#1e293b" : "white";
  const cardBorder = hovered ? (dark ? "#475569" : "#CBD5E1") : (dark ? "#334155" : "#E2E8F0");
  const cardShadow = hovered ? (dark ? "0 4px 20px rgba(0,0,0,0.4)" : "0 4px 20px rgba(0,0,0,0.08)") : "0 1px 3px rgba(0,0,0,0.04)";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(16px)",
        transition: `opacity 0.4s ease ${rank * 0.07}s, transform 0.4s ease ${rank * 0.07}s`,
        backgroundColor: cardBg,
        borderColor: cardBorder,
        boxShadow: cardShadow,
        borderWidth: 1,
        borderStyle: "solid",
        borderRadius: 16,
        overflow: "hidden",
      }}
    >
      <div className="p-5">
        <div className="flex gap-4">
          <CompanyLogo company={job.company} size={52} dark={dark} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className={`text-[15px] font-semibold leading-tight transition-colors ${dark ? "text-white" : "text-[#0F172A]"}`}>
                  {job.title}
                </h3>
                <p className={`text-[13px] mt-0.5 transition-colors ${dark ? "text-[#94a3b8]" : "text-[#64748B]"}`}>
                  {cleanCompanyName(job.company)}
                </p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className={`text-[12px] transition-colors ${dark ? "text-[#64748b]" : "text-[#94A3B8]"}`}>{job.location}</span>
                  {salary && <><span className={dark ? "text-[#334155]" : "text-[#E2E8F0]"}>·</span><span className={`text-[12px] font-semibold ${dark ? "text-[#cbd5e1]" : "text-[#475569]"}`}>{salary}</span></>}
                  {posted && <><span className={dark ? "text-[#334155]" : "text-[#E2E8F0]"}>·</span><span className={`text-[12px] ${dark ? "text-[#475569]" : "text-[#94A3B8]"}`}>{posted}</span></>}
                </div>
              </div>
              <ScoreRing score={analysis.score} verdict={analysis.verdict} dark={dark} />
            </div>

            {/* Verdict pill */}
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition-all duration-300"
              style={dark
                ? { backgroundColor: config.darkBg, color: config.darkText, border: `1px solid ${config.darkBorder}` }
                : { backgroundColor: config.bg, color: config.text, border: `1px solid ${config.border}` }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: config.ring }} />
              {analysis.verdict_reason}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <a href={job.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] active:scale-95 text-white text-[13px] font-semibold px-4 py-1.5 rounded-full transition-all duration-150 select-none">
                Apply now
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>

              <button onClick={() => setExpanded(!expanded)}
                className={`flex items-center gap-1 text-[13px] font-semibold px-4 py-1.5 rounded-full border active:scale-95 transition-all duration-150 select-none ${
                  dark ? "text-[#93c5fd] border-[#1e3a5f] hover:bg-[#1e3a5f]" : "text-[#2563EB] border-[#BFDBFE] hover:bg-[#EFF6FF]"}`}>
                {expanded ? "Hide" : "See"} analysis
                <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <button onClick={handleSave} disabled={isSaved}
                className={`flex items-center gap-1.5 text-[13px] font-semibold px-4 py-1.5 rounded-full border active:scale-95 transition-all duration-150 select-none ${
                  isSaved || justSaved
                    ? "bg-[#DCFCE7] text-[#15803D] border-[#BBF7D0] cursor-default"
                    : dark
                    ? "text-[#94a3b8] border-[#334155] hover:border-[#475569] hover:text-white"
                    : "text-[#475569] border-[#E2E8F0] hover:border-[#2563EB] hover:text-[#2563EB] hover:bg-[#EFF6FF]"
                }`}>
                {isSaved || justSaved ? (
                  <><span className="pop-in inline-block">✓</span> {justSaved && !isSaved ? "Saved!" : "Saved"}</>
                ) : (
                  <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>Save</>
                )}
              </button>

              <span className={`text-[11px] ml-auto ${dark ? "text-[#334155]" : "text-[#CBD5E1]"}`}>#{rank}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Slide-down analysis */}
      <div style={{ maxHeight: expanded ? "480px" : "0px", overflow: "hidden", transition: "max-height 0.45s cubic-bezier(0.4,0,0.2,1)" }}>
        <div className={`border-t px-5 py-4 transition-colors duration-300 ${dark ? "border-[#334155] bg-[#0f172a]" : "border-[#F1F5F9] bg-[#F8FAFC]"}`}>
          <div className="grid grid-cols-3 gap-5 mb-4">
            {[
              { label: "You have", items: analysis.you_have, color: "#15803D", darkColor: "#86efac", symbol: "✓", empty: "None identified" },
              { label: "Missing", items: analysis.you_lack, color: "#B91C1C", darkColor: "#fca5a5", symbol: "✗", empty: "Nothing critical" },
              { label: "Transferable", items: analysis.transferable, color: "#A16207", darkColor: "#fde68a", symbol: "⇌", empty: "Not applicable" },
            ].map(({ label, items, color, darkColor, symbol, empty }) => (
              <div key={label}>
                <p className="text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5"
                  style={{ color: dark ? darkColor : color }}>
                  <span>{symbol}</span>{label}
                </p>
                <ul className="space-y-1.5">
                  {items.length > 0 ? items.map((item, i) => (
                    <li key={i} className={`text-[12.5px] leading-snug flex gap-1.5 transition-colors ${dark ? "text-[#cbd5e1]" : "text-[#374151]"}`}>
                      <span style={{ color: dark ? darkColor : color }} className="shrink-0 mt-0.5">·</span>{item}
                    </li>
                  )) : <li className={`text-[12px] italic ${dark ? "text-[#475569]" : "text-[#94A3B8]"}`}>{empty}</li>}
                </ul>
              </div>
            ))}
          </div>
          <div className={`border-t pt-3 ${dark ? "border-[#1e293b]" : "border-[#E2E8F0]"}`}>
            <p className={`text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${dark ? "text-[#475569]" : "text-[#94A3B8]"}`}>About this role</p>
            <p className={`text-[12.5px] leading-relaxed line-clamp-3 ${dark ? "text-[#94a3b8]" : "text-[#475569]"}`}>{job.description}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Saved Jobs ─────────────────────────────────────────────────────────────

function SavedJobsView({ savedJobs, onRemove, dark }: { savedJobs: SavedJob[]; onRemove: (id: string) => void; dark: boolean }) {
  if (savedJobs.length === 0) {
    return (
      <div className={`rounded-2xl border p-16 text-center transition-colors ${dark ? "bg-[#1e293b] border-[#334155]" : "bg-white border-[#E2E8F0]"}`}>
        <div className="text-[48px] mb-3 select-none" style={{ animation: "float 3s ease-in-out infinite alternate" }}>🔖</div>
        <p className={`text-[15px] font-semibold mb-1 ${dark ? "text-white" : "text-[#0F172A]"}`}>No saved jobs yet</p>
        <p className={`text-[13px] ${dark ? "text-[#64748b]" : "text-[#64748B]"}`}>Save jobs while searching to review them here</p>
      </div>
    );
  }

  const groups = [
    { verdict: "Apply", label: "Apply 🟢", color: "#15803D", darkColor: "#86efac", jobs: savedJobs.filter(j => j.verdict === "Apply") },
    { verdict: "Maybe", label: "Maybe 🟡", color: "#A16207", darkColor: "#fde68a", jobs: savedJobs.filter(j => j.verdict === "Maybe") },
    { verdict: "Skip",  label: "Skip 🔴",  color: "#B91C1C", darkColor: "#fca5a5", jobs: savedJobs.filter(j => j.verdict === "Skip") },
  ].filter(g => g.jobs.length > 0);

  return (
    <div className="space-y-6">
      {groups.map(({ verdict, label, color, darkColor, jobs }) => (
        <div key={verdict}>
          <h3 className="text-[12px] font-bold uppercase tracking-wider mb-3" style={{ color: dark ? darkColor : color }}>
            {label} ({jobs.length})
          </h3>
          <div className="space-y-2">
            {jobs.map(job => {
              const cfg = VERDICT_CONFIG[job.verdict as keyof typeof VERDICT_CONFIG] ?? VERDICT_CONFIG.Maybe;
              const r = 14; const circ = 2 * Math.PI * r;
              return (
                <div key={job.job_id}
                  className={`rounded-xl border p-4 flex items-center gap-3 transition-all duration-200 hover:scale-[1.005] ${dark ? "bg-[#1e293b] border-[#334155] hover:border-[#475569]" : "bg-white border-[#E2E8F0] hover:shadow-md"}`}>
                  <CompanyLogo company={job.company} size={40} dark={dark} />
                  <div className="w-10 h-10 shrink-0 relative">
                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                      <circle cx="18" cy="18" r={r} fill="none" stroke={dark ? "#334155" : "#F1F5F9"} strokeWidth="3.5" />
                      <circle cx="18" cy="18" r={r} fill="none" stroke={cfg.ring} strokeWidth="3.5"
                        strokeDasharray={circ} strokeDashoffset={circ - (job.score / 100) * circ} strokeLinecap="round" />
                    </svg>
                    <span className={`absolute inset-0 flex items-center justify-center text-[11px] font-black ${dark ? "text-white" : "text-[#0F172A]"}`}>{job.score}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[14px] font-semibold truncate ${dark ? "text-white" : "text-[#0F172A]"}`}>{job.job_title}</p>
                    <p className={`text-[12px] mt-0.5 ${dark ? "text-[#64748b]" : "text-[#64748B]"}`}>{cleanCompanyName(job.company)} · {job.location}</p>
                    {job.verdict_reason && <p className={`text-[12px] mt-1 truncate italic ${dark ? "text-[#475569]" : "text-[#94A3B8]"}`}>{job.verdict_reason}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <a href={job.url} target="_blank" rel="noopener noreferrer"
                      className="text-[12px] font-semibold text-[#2563EB] hover:underline">Apply →</a>
                    <button onClick={() => onRemove(job.job_id)}
                      className={`text-[11px] transition-colors ${dark ? "text-[#475569] hover:text-[#fca5a5]" : "text-[#94A3B8] hover:text-[#DC2626]"}`}>
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Dark Mode Toggle ───────────────────────────────────────────────────────

function DarkToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle}
      className={`relative w-12 h-6 rounded-full transition-all duration-300 focus:outline-none ${dark ? "bg-[#2563EB]" : "bg-[#E2E8F0]"}`}
      aria-label="Toggle dark mode">
      <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px] shadow-sm transition-all duration-300 ${dark ? "translate-x-6 bg-white" : "translate-x-0 bg-white"}`}>
        {dark ? "🌙" : "☀️"}
      </div>
    </button>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

type Tab = "search" | "saved";

export default function Page() {
  const [dark, setDark] = useState(false);
  const [tab, setTab] = useState<Tab>("search");
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("us");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<JobResult[]>([]);
  const [totalFound, setTotalFound] = useState(0);
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [filterVerdict, setFilterVerdict] = useState<string>("");
  const [profileOpen, setProfileOpen] = useState(true);
  const [hasSearched, setHasSearched] = useState(false);
  const [cardsVisible, setCardsVisible] = useState(false);

  const profileComplete = profile.title.trim() !== "" && profile.skills.trim() !== "";

  useEffect(() => {
    const saved = localStorage.getItem("joblens_profile");
    if (saved) { try { setProfile(JSON.parse(saved)); } catch { /* ignore */ } }
    const savedDark = localStorage.getItem("joblens_dark");
    if (savedDark === "true") setDark(true);
  }, []);

  useEffect(() => {
    if (profile.title || profile.skills) localStorage.setItem("joblens_profile", JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem("joblens_dark", String(dark));
  }, [dark]);

  const loadSavedJobs = useCallback(async () => {
    try {
      const data = await apiFetch<{ saved_jobs: SavedJob[] }>("/saved-jobs");
      setSavedJobs(data.saved_jobs);
      setSavedIds(new Set(data.saved_jobs.map(j => j.job_id)));
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadSavedJobs(); }, [loadSavedJobs]);

  async function search() {
    if (!query.trim()) return;
    if (!profileComplete) { setError("Fill in your target role and skills first ✏️"); return; }
    setLoading(true); setError(null); setResults([]); setCardsVisible(false); setFilterVerdict(""); setHasSearched(true);
    try {
      const data = await apiFetch<{ results: JobResult[]; total: number }>("/search", "POST", { query, location, profile });
      setResults(data.results);
      setTotalFound(data.total);
      if (profileComplete) setProfileOpen(false);
      setTimeout(() => setCardsVisible(true), 120);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Search failed — check your connection");
    } finally { setLoading(false); }
  }

  async function handleSave(result: JobResult) {
    try {
      await apiFetch("/saved-jobs", "POST", {
        job_id: result.job.id, job_title: result.job.title, company: result.job.company,
        location: result.job.location, url: result.job.url,
        salary_min: result.job.salary_min, salary_max: result.job.salary_max,
        score: result.analysis.score, verdict: result.analysis.verdict,
        verdict_reason: result.analysis.verdict_reason,
      });
      setSavedIds(prev => new Set([...prev, result.job.id]));
      await loadSavedJobs();
    } catch { /* already saved */ }
  }

  async function handleRemove(jobId: string) {
    await apiFetch(`/saved-jobs/${jobId}`, "DELETE");
    setSavedIds(prev => { const s = new Set(prev); s.delete(jobId); return s; });
    await loadSavedJobs();
  }

  const filteredResults = filterVerdict ? results.filter(r => r.analysis.verdict === filterVerdict) : results;
  const counts = { Apply: results.filter(r => r.analysis.verdict === "Apply").length, Maybe: results.filter(r => r.analysis.verdict === "Maybe").length, Skip: results.filter(r => r.analysis.verdict === "Skip").length };
  const avgScore = results.length > 0 ? Math.round(results.reduce((s, r) => s + r.analysis.score, 0) / results.length) : null;

  const bg = dark ? "#0f172a" : "#F7F8FA";
  const headerBg = dark ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.85)";
  const headerBorder = dark ? "#1e293b" : "#E2E8F0";
  const cardBg = dark ? "#1e293b" : "white";
  const cardBorder = dark ? "#334155" : "#E2E8F0";
  const textPrimary = dark ? "#f1f5f9" : "#0F172A";
  const textSecondary = dark ? "#94a3b8" : "#64748B";
  const inputBg = dark ? "#0f172a" : "#F8FAFC";
  const inputBorder = dark ? "#334155" : "#E2E8F0";
  const inputText = dark ? "#f1f5f9" : "#0F172A";

  return (
    <div style={{ minHeight: "100vh", backgroundColor: bg, fontFamily: "'Inter', system-ui, sans-serif", transition: "background-color 0.3s ease" }}>
      <style>{`
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes float { from { transform: translateY(0) rotate(-2deg); } to { transform: translateY(-8px) rotate(2deg); } }
        @keyframes slideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes popIn { from { opacity:0; transform:scale(0.9); } to { opacity:1; transform:scale(1); } }
        .slide-up { animation: slideUp 0.35s ease forwards; }
        .pop-in { animation: popIn 0.25s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        input::placeholder { color: ${dark ? "#475569" : "#94A3B8"}; }
        * { transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease; }
        button, a { transition: all 0.15s ease !important; }
      `}</style>

      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 20, backgroundColor: headerBg, backdropFilter: "blur(16px)", borderBottom: `1px solid ${headerBorder}` }}>
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#2563EB] rounded-xl flex items-center justify-center shadow-sm hover:scale-110 transition-transform cursor-default select-none">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <span className="text-[16px] font-black tracking-tight" style={{ color: textPrimary }}>JobLens</span>
            <span className="text-[10px] font-bold text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded-full border border-[#BFDBFE] select-none">AI Match</span>
          </div>

          <div className="flex items-center gap-3">
            <DarkToggle dark={dark} onToggle={() => setDark(!dark)} />
            <div className="flex gap-1 rounded-lg p-0.5" style={{ backgroundColor: dark ? "#1e293b" : "#F1F5F9" }}>
              {(["search", "saved"] as Tab[]).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className="px-4 py-1.5 rounded-md text-[13px] font-semibold transition-all"
                  style={tab === t
                    ? { backgroundColor: dark ? "#334155" : "white", color: textPrimary, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }
                    : { color: textSecondary }}>
                  {t === "search" ? "Search" : `Saved${savedJobs.length > 0 ? ` (${savedJobs.length})` : ""}`}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {tab === "saved" ? (
          <div className="space-y-5 slide-up">
            <div>
              <h1 className="text-[22px] font-black" style={{ color: textPrimary }}>Saved jobs</h1>
              <p className="text-[13px] mt-1" style={{ color: textSecondary }}>
                {savedJobs.length > 0 ? `${savedJobs.length} job${savedJobs.length > 1 ? "s" : ""} saved · sorted by match verdict` : "Jobs you bookmark will appear here"}
              </p>
            </div>
            <SavedJobsView savedJobs={savedJobs} onRemove={handleRemove} dark={dark} />
          </div>
        ) : (
          <div className="space-y-4">
            {!hasSearched && (
              <div className="py-2 slide-up">
                <h1 className="text-[28px] font-black tracking-tight leading-tight mb-1.5" style={{ color: textPrimary }}>
                  Know your odds before you apply 🎯
                </h1>
                <p className="text-[14px]" style={{ color: textSecondary }}>
                  JobLens scores every listing against your profile — spend time on jobs where you actually have a shot.
                </p>
              </div>
            )}

            {/* Profile card */}
            <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
              <button onClick={() => setProfileOpen(!profileOpen)}
                className="w-full px-5 py-3.5 flex items-center justify-between hover:opacity-80 transition-opacity"
                style={{ backgroundColor: "transparent" }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: dark ? "#1e3a5f" : "#EFF6FF" }}>
                    <svg className="w-3.5 h-3.5 text-[#2563EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <span className="text-[13px] font-semibold" style={{ color: textPrimary }}>
                    Your profile
                    {profileComplete && <span className="font-normal ml-2" style={{ color: textSecondary }}>— {profile.title}</span>}
                    {!profileComplete && <span className="font-normal ml-2 text-[12px] text-[#DC2626]">· Fill this in first ✏️</span>}
                  </span>
                  {profileComplete && <span className="text-[10px] font-bold text-[#15803D] bg-[#DCFCE7] px-2 py-0.5 rounded-full pop-in">✓ Ready</span>}
                </div>
                <svg className={`w-4 h-4 transition-transform duration-300 ${profileOpen ? "rotate-180" : ""}`}
                  style={{ color: textSecondary }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              <div style={{ maxHeight: profileOpen ? "420px" : "0px", overflow: "hidden", transition: "max-height 0.4s cubic-bezier(0.4,0,0.2,1)", borderTop: profileOpen ? `1px solid ${cardBorder}` : "none" }}>
                <div className="px-5 pb-5 pt-4 space-y-3">
                  {[
                    [
                      { label: "Target role *", key: "title", placeholder: "e.g. Software Engineer", type: "text" },
                      { label: "Years of experience *", key: "years_experience", placeholder: "1", type: "number" },
                    ],
                    [{ label: "Skills *", key: "skills", placeholder: "e.g. Python, React, SQL, TypeScript", type: "text", full: true }],
                    [
                      { label: "Education", key: "education", placeholder: "e.g. CS degree, bootcamp", type: "text" },
                      { label: "Notes", key: "notes", placeholder: "e.g. remote only", type: "text" },
                    ],
                  ].map((row, ri) => (
                    <div key={ri} className={`grid gap-3 ${row.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                      {row.map(({ label, key, placeholder, type }) => (
                        <div key={key}>
                          <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: textSecondary }}>{label}</label>
                          <input
                            type={type} min={type === "number" ? 0 : undefined} max={type === "number" ? 40 : undefined}
                            value={profile[key as keyof UserProfile]}
                            onChange={e => setProfile({ ...profile, [key]: type === "number" ? parseInt(e.target.value) || 0 : e.target.value })}
                            placeholder={placeholder}
                            className="w-full text-[14px] rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 border transition-all"
                            style={{ backgroundColor: inputBg, borderColor: inputBorder, color: inputText }} />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Search bar */}
            <div className="rounded-xl border p-3" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: textSecondary }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && search()}
                    placeholder="Job title, skill, or keyword…"
                    className="w-full text-[14px] rounded-lg pl-9 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 border transition-all"
                    style={{ backgroundColor: inputBg, borderColor: inputBorder, color: inputText }} />
                </div>
                <select value={location} onChange={e => setLocation(e.target.value)}
                  className="text-[13px] font-medium rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 border transition-all"
                  style={{ backgroundColor: inputBg, borderColor: inputBorder, color: inputText }}>
                  {LOCATIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
                <button onClick={search} disabled={loading || !query.trim()}
                  className="flex items-center gap-2 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 active:scale-95 text-white text-[14px] font-semibold px-5 py-2.5 rounded-lg">
                  {loading ? (
                    <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  )}
                  {loading ? "Analyzing…" : "Search"}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl px-4 py-3 flex items-center gap-2.5 slide-up" style={{ backgroundColor: dark ? "rgba(127,29,29,0.3)" : "#FEF2F2", border: `1px solid ${dark ? "#7f1d1d" : "#FECACA"}` }}>
                <span className="text-[16px]">⚠️</span>
                <p className="text-[13px] font-medium" style={{ color: dark ? "#fca5a5" : "#B91C1C" }}>{error}</p>
              </div>
            )}

            {loading && <LoadingScreen dark={dark} />}

            {results.length > 0 && !loading && (
              <div className="space-y-3 slide-up">
                {/* Stats bar */}
                <div className="rounded-xl border px-5 py-3.5 flex items-center justify-between flex-wrap gap-3" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-[22px] font-black" style={{ color: textPrimary }}>{results.length}</span>
                      <span className="text-[13px] ml-1.5" style={{ color: textSecondary }}>results analyzed</span>
                      {totalFound > results.length && <span className="text-[12px] ml-1" style={{ color: dark ? "#334155" : "#94A3B8" }}>of {totalFound.toLocaleString()}</span>}
                    </div>
                    {avgScore !== null && (
                      <div className="border-l pl-4 flex items-center gap-3" style={{ borderColor: cardBorder }}>
                        <div>
                          <span className="text-[22px] font-black" style={{ color: avgScore < 40 ? "#DC2626" : avgScore < 60 ? "#CA8A04" : "#2563EB" }}>{avgScore}</span>
                          <span className="text-[13px] ml-1.5" style={{ color: textSecondary }}>avg score</span>
                        </div>
                        {avgScore < 40 && (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg pop-in"
                            style={{ backgroundColor: dark ? "rgba(113,63,18,0.4)" : "#FEF9C3", border: `1px solid ${dark ? "#92400E" : "#FEF08A"}` }}>
                            <span className="text-[13px]">💡</span>
                            <span className="text-[12px] font-semibold" style={{ color: dark ? "#fde68a" : "#A16207" }}>Try a more specific role</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(["", "Apply", "Maybe", "Skip"] as const).map(v => {
                      const count = v === "" ? results.length : counts[v];
                      const active = filterVerdict === v;
                      const cfg = v ? VERDICT_CONFIG[v] : null;
                      return (
                        <button key={v} onClick={() => setFilterVerdict(v)}
                          className="text-[12px] font-semibold px-3 py-1.5 rounded-lg border active:scale-95"
                          style={active && cfg
                            ? { backgroundColor: dark ? cfg.darkBg : cfg.bg, color: dark ? cfg.darkText : cfg.text, borderColor: dark ? cfg.darkBorder : cfg.border }
                            : active
                            ? { backgroundColor: dark ? "#334155" : "#0F172A", color: "white", borderColor: dark ? "#475569" : "#0F172A" }
                            : { backgroundColor: "transparent", color: textSecondary, borderColor: cardBorder }}>
                          {v || "All"} <span className="opacity-60 ml-1">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {filteredResults.map((result, i) => (
                  <JobCard key={result.job.id} result={result} onSave={handleSave}
                    isSaved={savedIds.has(result.job.id)} rank={i + 1} visible={cardsVisible} dark={dark} />
                ))}
              </div>
            )}

            {hasSearched && results.length === 0 && !loading && !error && (
              <div className="rounded-xl border p-12 text-center slide-up" style={{ backgroundColor: cardBg, borderColor: cardBorder }}>
                <div className="text-[40px] mb-3 select-none">🤷</div>
                <p className="text-[15px] font-semibold mb-1" style={{ color: textPrimary }}>No results found</p>
                <p className="text-[13px]" style={{ color: textSecondary }}>Try a broader search term or a different location</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
