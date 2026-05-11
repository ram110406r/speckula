"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import {
  Settings, Cpu, Puzzle, Users, Bell, CreditCard,
  Key, Shield, ChevronRight, Check, Copy, RefreshCw,
  Trash2, Plus, Eye, EyeOff, Globe, Loader2, AlertCircle,
  Zap, Brain, ToggleLeft, ToggleRight,
} from "lucide-react";
import Image from "next/image";

// ── Types ─────────────────────────────────────────────────────────────────────

type Section =
  | "general" | "ai" | "extension" | "team"
  | "notifications" | "billing" | "api-keys" | "privacy";

interface SectionMeta { id: Section; label: string; icon: React.ElementType; }

const SECTIONS: SectionMeta[] = [
  { id: "general",       label: "General",            icon: Settings    },
  { id: "ai",            label: "AI Preferences",     icon: Brain       },
  { id: "extension",     label: "Extension",          icon: Puzzle      },
  { id: "team",          label: "Team",               icon: Users       },
  { id: "notifications", label: "Notifications",      icon: Bell        },
  { id: "billing",       label: "Billing & Usage",    icon: CreditCard  },
  { id: "api-keys",      label: "API Keys",           icon: Key         },
  { id: "privacy",       label: "Privacy & Security", icon: Shield      },
];

// ── Shared primitives ─────────────────────────────────────────────────────────

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-4 border-b border-border/50 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{description}</p>
        )}
      </div>
      <div className="shrink-0 flex items-center">{children}</div>
    </div>
  );
}

function SavedBadge({ show }: { show: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] text-success transition-opacity duration-300 ${
        show ? "opacity-100" : "opacity-0"
      }`}
    >
      <Check className="h-3 w-3" /> Saved
    </span>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
        checked ? "bg-primary" : "bg-muted-foreground/30"
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-4" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function Input({
  value,
  onChange,
  onBlur,
  placeholder,
  type = "text",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      className={`h-8 rounded-md border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40 transition-colors ${className}`}
    />
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-md border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ── Sections ──────────────────────────────────────────────────────────────────

function GeneralSection({ user }: { user: any }) {
  const [workspaceName, setWorkspaceName] = useState("My Workspace");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const save = (key: string) => {
    setSaved((s) => ({ ...s, [key]: true }));
    setTimeout(() => setSaved((s) => ({ ...s, [key]: false })), 2000);
  };

  const timezones = [
    { value: "Asia/Kolkata", label: "IST — Asia/Kolkata" },
    { value: "UTC", label: "UTC" },
    { value: "America/New_York", label: "EST — America/New_York" },
    { value: "America/Los_Angeles", label: "PST — America/Los_Angeles" },
    { value: "Europe/London", label: "GMT — Europe/London" },
    { value: "Europe/Berlin", label: "CET — Europe/Berlin" },
    { value: "Asia/Tokyo", label: "JST — Asia/Tokyo" },
    { value: "Asia/Singapore", label: "SGT — Asia/Singapore" },
  ];

  return (
    <div>
      <h2 className="text-base font-semibold text-foreground mb-1">General</h2>
      <p className="text-xs text-muted-foreground mb-6">Workspace identity and core preferences.</p>

      <SettingRow label="Workspace Name" description="The name shown across your SPECKULA workspace.">
        <div className="flex items-center gap-2">
          <Input
            value={workspaceName}
            onChange={setWorkspaceName}
            onBlur={() => save("name")}
            placeholder="My Workspace"
            className="w-48"
          />
          <SavedBadge show={!!saved.name} />
        </div>
      </SettingRow>

      <SettingRow label="Account Email" description="Your Google account email.">
        <span className="text-sm text-muted-foreground">{user?.email || "—"}</span>
      </SettingRow>

      <SettingRow label="Display Name">
        <span className="text-sm text-muted-foreground">{user?.displayName || "—"}</span>
      </SettingRow>

      <SettingRow label="Timezone" description="Used for timestamps and scheduled analyses.">
        <div className="flex items-center gap-2">
          <Select value={timezone} onChange={(v) => { setTimezone(v); save("tz"); }} options={timezones} />
          <SavedBadge show={!!saved.tz} />
        </div>
      </SettingRow>

      <SettingRow label="Default View" description="The view shown when you first open SPECKULA.">
        <Select
          value="editor"
          onChange={() => save("view")}
          options={[
            { value: "workspace", label: "Workspace Home" },
            { value: "editor", label: "Research" },
            { value: "decisions", label: "Decisions" },
            { value: "autonomous", label: "Autonomous Mode" },
          ]}
        />
      </SettingRow>
    </div>
  );
}

function AISection() {
  const [depth, setDepth] = useState("balanced");
  const [autoClassify, setAutoClassify] = useState(true);
  const [vectorMemory, setVectorMemory] = useState(true);
  const [autonomousMode, setAutonomousMode] = useState(true);
  const [saved, setSaved] = useState(false);

  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div>
      <h2 className="text-base font-semibold text-foreground mb-1">AI Preferences</h2>
      <p className="text-xs text-muted-foreground mb-6">Configure how SPECKULA's intelligence engine behaves.</p>

      <SettingRow label="Analysis Depth" description="Controls depth vs. speed tradeoff for AI analyses.">
        <div className="flex gap-1 rounded-lg border border-border p-0.5 bg-muted/30">
          {[
            { value: "fast", label: "Fast" },
            { value: "balanced", label: "Balanced" },
            { value: "deep", label: "Deep" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setDepth(opt.value); save(); }}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                depth === opt.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </SettingRow>

      <SettingRow label="Auto-classify Pages" description="Automatically detect page type when the extension captures content.">
        <Toggle checked={autoClassify} onChange={(v) => { setAutoClassify(v); save(); }} />
      </SettingRow>

      <SettingRow label="Vector Memory" description="Store insights in semantic memory for contextual retrieval.">
        <Toggle checked={vectorMemory} onChange={(v) => { setVectorMemory(v); save(); }} />
      </SettingRow>

      <SettingRow label="Autonomous Mode" description="Allow SPECKULA to proactively surface insights from captured data.">
        <Toggle checked={autonomousMode} onChange={(v) => { setAutonomousMode(v); save(); }} />
      </SettingRow>

      <SettingRow label="AI Model" description="Language model used for analysis and reasoning.">
        <Select
          value="groq-llama"
          onChange={() => {}}
          options={[
            { value: "groq-llama", label: "Llama 3.3 (Groq) — Fast" },
            { value: "claude-sonnet", label: "Claude Sonnet — Balanced" },
            { value: "claude-opus", label: "Claude Opus — Deep" },
          ]}
        />
      </SettingRow>

      {saved && (
        <div className="mt-4 flex items-center gap-1.5 text-xs text-success">
          <Check className="h-3.5 w-3.5" /> Preferences saved
        </div>
      )}
    </div>
  );
}

function ExtensionSection() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [autoCapture, setAutoCapture] = useState(false);
  const [allowedDomains, setAllowedDomains] = useState("*.competitor.com\n*.producthunt.com\nreddit.com");
  const [saved, setSaved] = useState(false);

  const mockToken = user
    ? `spk_ext_${user.uid.slice(0, 8)}xxxxxxxxxxxxxxxxxxxx`
    : "spk_ext_sign_in_first";

  const copyToken = () => {
    navigator.clipboard.writeText(mockToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <h2 className="text-base font-semibold text-foreground mb-1">Extension</h2>
      <p className="text-xs text-muted-foreground mb-6">Configure the SPECKULA browser extension integration.</p>

      <SettingRow label="Extension Token" description="Paste this token in the extension Settings to link your account.">
        <div className="flex items-center gap-2">
          <code className="px-2.5 py-1 rounded-md bg-muted text-[11px] font-mono text-muted-foreground max-w-[220px] truncate">
            {mockToken}
          </code>
          <button
            onClick={copyToken}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </SettingRow>

      <SettingRow label="Auto-capture" description="Automatically capture and queue pages for analysis when browsing allowed domains.">
        <Toggle checked={autoCapture} onChange={setAutoCapture} />
      </SettingRow>

      <SettingRow label="Allowed Domains" description="Domains where auto-capture is active (one per line). Leave blank for all domains.">
        <div className="flex flex-col items-end gap-2">
          <textarea
            value={allowedDomains}
            onChange={(e) => setAllowedDomains(e.target.value)}
            onBlur={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}
            rows={3}
            className="w-64 rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none font-mono"
          />
          <SavedBadge show={saved} />
        </div>
      </SettingRow>

      <SettingRow label="Extension Status">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
          <span className="text-xs text-muted-foreground">Not detected</span>
          <a
            href="https://speckula.eddgeportal.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline"
          >
            Install →
          </a>
        </div>
      </SettingRow>
    </div>
  );
}

function TeamSection() {
  const { user } = useAuth();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [inviting, setInviting] = useState(false);

  const members = [
    { email: user?.email || "you@example.com", name: user?.displayName || "You", role: "owner", avatar: user?.photoURL },
  ];

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    await new Promise((r) => setTimeout(r, 1200));
    setInviting(false);
    setInviteEmail("");
  };

  return (
    <div>
      <h2 className="text-base font-semibold text-foreground mb-1">Team</h2>
      <p className="text-xs text-muted-foreground mb-6">Manage workspace members and roles.</p>

      {/* Invite */}
      <div className="mb-6 rounded-xl border border-border bg-muted/20 p-4">
        <p className="text-xs font-medium text-foreground mb-3">Invite teammate</p>
        <div className="flex gap-2">
          <Input
            value={inviteEmail}
            onChange={setInviteEmail}
            placeholder="colleague@company.com"
            type="email"
            className="flex-1"
          />
          <Select
            value={inviteRole}
            onChange={setInviteRole}
            options={[
              { value: "editor", label: "Editor" },
              { value: "viewer", label: "Viewer" },
            ]}
          />
          <button
            onClick={handleInvite}
            disabled={inviting || !inviteEmail.trim()}
            className="flex items-center gap-1.5 px-3 h-8 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {inviting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Invite
          </button>
        </div>
      </div>

      {/* Members */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-2.5 bg-muted/30 border-b border-border">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Members ({members.length})</p>
        </div>
        {members.map((m) => (
          <div key={m.email} className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0">
            {m.avatar ? (
              <Image src={m.avatar} alt="" width={28} height={28} className="rounded-full" />
            ) : (
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                {(m.name?.[0] || "?").toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
              <p className="text-xs text-muted-foreground truncate">{m.email}</p>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold capitalize">
              {m.role}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotificationsSection() {
  const [prefs, setPrefs] = useState({
    analysisComplete: true,
    newInsight: true,
    competitorUpdate: true,
    teamActivity: false,
    weeklyDigest: true,
    slackWebhook: false,
  });
  const [webhookUrl, setWebhookUrl] = useState("");
  const [saved, setSaved] = useState(false);

  const toggle = (key: keyof typeof prefs) => {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const rows: { key: keyof typeof prefs; label: string; desc: string }[] = [
    { key: "analysisComplete", label: "Analysis completed", desc: "When a page analysis finishes." },
    { key: "newInsight",       label: "New insight captured", desc: "When the extension captures and saves an insight." },
    { key: "competitorUpdate", label: "Competitor updates", desc: "When monitored competitor pages change." },
    { key: "teamActivity",    label: "Team activity", desc: "When teammates capture or create insights." },
    { key: "weeklyDigest",    label: "Weekly intelligence digest", desc: "Email summary of the week's top signals." },
  ];

  return (
    <div>
      <h2 className="text-base font-semibold text-foreground mb-1">Notifications</h2>
      <p className="text-xs text-muted-foreground mb-6">Control when and how SPECKULA notifies you.</p>

      {rows.map((row) => (
        <SettingRow key={row.key} label={row.label} description={row.desc}>
          <Toggle checked={prefs[row.key]} onChange={() => toggle(row.key)} />
        </SettingRow>
      ))}

      <SettingRow label="Slack Webhook" description="Send notification summaries to a Slack channel.">
        <Toggle checked={prefs.slackWebhook} onChange={() => toggle("slackWebhook")} />
      </SettingRow>

      {prefs.slackWebhook && (
        <div className="mt-3 ml-0">
          <Input
            value={webhookUrl}
            onChange={setWebhookUrl}
            placeholder="https://hooks.slack.com/services/..."
            className="w-full max-w-sm"
          />
        </div>
      )}

      {saved && (
        <div className="mt-4 flex items-center gap-1.5 text-xs text-success">
          <Check className="h-3.5 w-3.5" /> Preferences saved
        </div>
      )}
    </div>
  );
}

function BillingSection() {
  const usages = [
    { label: "AI Credits", used: 2840, total: 5000, unit: "credits" },
    { label: "Analyses run", used: 47, total: 100, unit: "analyses" },
    { label: "Storage", used: 128, total: 500, unit: "MB" },
  ];

  return (
    <div>
      <h2 className="text-base font-semibold text-foreground mb-1">Billing & Usage</h2>
      <p className="text-xs text-muted-foreground mb-6">Monitor your AI consumption and manage your subscription.</p>

      {/* Plan */}
      <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Starter Plan</span>
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">Active</span>
          </div>
          <p className="text-xs text-muted-foreground">5,000 AI credits / month · 100 analyses · 500 MB storage</p>
        </div>
        <button className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity">
          Upgrade
        </button>
      </div>

      {/* Usage bars */}
      <div className="space-y-4 mb-6">
        {usages.map((u) => {
          const pct = Math.round((u.used / u.total) * 100);
          return (
            <div key={u.label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-foreground">{u.label}</span>
                <span className="text-xs text-muted-foreground font-mono">
                  {u.used.toLocaleString()} / {u.total.toLocaleString()} {u.unit}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${pct > 80 ? "bg-warning" : "bg-primary"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">{pct}% used</p>
            </div>
          );
        })}
      </div>

      {/* Invoices */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-2.5 bg-muted/30 border-b border-border">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Invoice History</p>
        </div>
        {[
          { date: "May 2026", amount: "$29.00", status: "Paid" },
          { date: "Apr 2026", amount: "$29.00", status: "Paid" },
          { date: "Mar 2026", amount: "$29.00", status: "Paid" },
        ].map((inv) => (
          <div key={inv.date} className="flex items-center justify-between px-4 py-3 border-b border-border/50 last:border-0">
            <span className="text-sm text-foreground">{inv.date}</span>
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono text-foreground">{inv.amount}</span>
              <span className="px-2 py-0.5 rounded-full bg-success/10 text-success text-[10px] font-semibold">{inv.status}</span>
              <button className="text-xs text-primary hover:underline">Download</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function APIKeysSection() {
  const [keys, setKeys] = useState([
    { id: "key_1", name: "Extension Integration", created: "May 1, 2026", lastUsed: "2 hours ago", scopes: ["read", "capture"] },
    { id: "key_2", name: "CI Pipeline", created: "Apr 15, 2026", lastUsed: "Yesterday", scopes: ["read"] },
  ]);
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showKeyId, setShowKeyId] = useState<string | null>(null);

  const generateKey = () => {
    if (!newKeyName.trim()) return;
    const k = `spk_live_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
    setGeneratedKey(k);
    setKeys((prev) => [
      ...prev,
      { id: `key_${Date.now()}`, name: newKeyName, created: "Just now", lastUsed: "Never", scopes: ["read", "capture"] },
    ]);
    setNewKeyName("");
  };

  const copyKey = () => {
    if (generatedKey) { navigator.clipboard.writeText(generatedKey); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  const deleteKey = (id: string) => {
    setKeys((k) => k.filter((key) => key.id !== id));
  };

  return (
    <div>
      <h2 className="text-base font-semibold text-foreground mb-1">API Keys</h2>
      <p className="text-xs text-muted-foreground mb-6">Generate and manage API keys for programmatic access.</p>

      {generatedKey && (
        <div className="mb-6 rounded-xl border border-success/30 bg-success/5 p-4">
          <p className="text-xs font-semibold text-success mb-2">API key generated — copy it now. It won't be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 rounded-md bg-background border border-border text-xs font-mono text-foreground break-all">
              {generatedKey}
            </code>
            <button
              onClick={copyKey}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-border text-xs hover:bg-muted transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button onClick={() => setGeneratedKey(null)} className="mt-2 text-xs text-muted-foreground hover:text-foreground">
            Dismiss
          </button>
        </div>
      )}

      {/* New key form */}
      <div className="mb-6 flex gap-2">
        <Input value={newKeyName} onChange={setNewKeyName} placeholder="Key name (e.g. Production)" className="flex-1" />
        <button
          onClick={generateKey}
          disabled={!newKeyName.trim()}
          className="flex items-center gap-1.5 px-3 h-8 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          <Plus className="h-3.5 w-3.5" /> Generate Key
        </button>
      </div>

      {/* Keys list */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-2.5 bg-muted/30 border-b border-border">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Active Keys ({keys.length})</p>
        </div>
        {keys.map((k) => (
          <div key={k.id} className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0">
            <Key className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{k.name}</p>
              <p className="text-xs text-muted-foreground">Created {k.created} · Last used {k.lastUsed}</p>
            </div>
            <div className="flex items-center gap-1">
              {k.scopes.map((s) => (
                <span key={s} className="px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground">{s}</span>
              ))}
            </div>
            <button
              onClick={() => deleteKey(k.id)}
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Revoke key"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {keys.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground">No API keys yet.</div>
        )}
      </div>
    </div>
  );
}

function PrivacySection() {
  const { user } = useAuth();
  const [dataRetention, setDataRetention] = useState("90");
  const [analytics, setAnalytics] = useState(true);
  const [saved, setSaved] = useState(false);
  const [exportState, setExportState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [deleteState, setDeleteState] = useState<"idle" | "confirm" | "loading" | "done" | "error">("idle");
  const [actionError, setActionError] = useState<string | null>(null);

  const handleExport = async () => {
    if (!user) return;
    setExportState("loading");
    setActionError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/user/me/export", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Export failed (${res.status})`);
      }
      // Trigger browser download.
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `speckula-export-${user.uid}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportState("done");
      setTimeout(() => setExportState("idle"), 3000);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Export failed");
      setExportState("error");
      setTimeout(() => setExportState("idle"), 4000);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    if (deleteState === "idle") { setDeleteState("confirm"); return; }
    if (deleteState !== "confirm") return;
    setDeleteState("loading");
    setActionError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/user/me", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Deletion failed (${res.status})`);
      }
      setDeleteState("done");
      // Sign the user out — their account no longer exists.
      const { getAuth, signOut } = await import("firebase/auth");
      await signOut(getAuth()).catch(() => undefined);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Deletion failed");
      setDeleteState("error");
      setTimeout(() => setDeleteState("idle"), 4000);
    }
  };

  return (
    <div>
      <h2 className="text-base font-semibold text-foreground mb-1">Privacy & Security</h2>
      <p className="text-xs text-muted-foreground mb-6">Control your data, sessions, and security settings.</p>

      <SettingRow label="Data Retention" description="How long SPECKULA keeps your captured intelligence and analyses.">
        <div className="flex items-center gap-2">
          <Select
            value={dataRetention}
            onChange={(v) => { setDataRetention(v); setSaved(true); setTimeout(() => setSaved(false), 2000); }}
            options={[
              { value: "30", label: "30 days" },
              { value: "90", label: "90 days" },
              { value: "180", label: "6 months" },
              { value: "365", label: "1 year" },
              { value: "forever", label: "Forever" },
            ]}
          />
          <SavedBadge show={saved} />
        </div>
      </SettingRow>

      <SettingRow label="Analytics" description="Share anonymous usage data to help improve SPECKULA.">
        <Toggle checked={analytics} onChange={(v) => { setAnalytics(v); setSaved(true); setTimeout(() => setSaved(false), 2000); }} />
      </SettingRow>

      <SettingRow label="Active Sessions" description="Devices currently signed in to your SPECKULA account.">
        <div className="text-xs text-muted-foreground">1 session (this device)</div>
      </SettingRow>

      {actionError && (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {actionError}
        </div>
      )}

      <div className="mt-8 pt-6 border-t border-border space-y-3">
        {/* ── Data export ── */}
        <button
          onClick={handleExport}
          disabled={exportState === "loading"}
          className="flex items-center gap-2 px-3 py-2 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          {exportState === "loading" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : exportState === "done" ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {exportState === "loading" ? "Preparing export…" : exportState === "done" ? "Downloaded" : "Export my data"}
        </button>

        {/* ── Account deletion ── */}
        {deleteState === "confirm" ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-2">
            <p className="text-xs text-destructive font-medium">
              This will permanently delete your account and ALL data. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                className="px-3 py-1.5 rounded-md bg-destructive text-destructive-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                Yes, delete everything
              </button>
              <button
                onClick={() => setDeleteState("idle")}
                className="px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleDelete}
            disabled={deleteState === "loading" || deleteState === "done"}
            className="flex items-center gap-2 px-3 py-2 rounded-md border border-destructive/30 text-xs text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
          >
            {deleteState === "loading" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            {deleteState === "loading" ? "Deleting account…" : deleteState === "done" ? "Account deleted" : "Delete account"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const SECTION_COMPONENTS: Record<Section, React.ComponentType<any>> = {
  general:       GeneralSection,
  ai:            AISection,
  extension:     ExtensionSection,
  team:          TeamSection,
  notifications: NotificationsSection,
  billing:       BillingSection,
  "api-keys":    APIKeysSection,
  privacy:       PrivacySection,
};

export function SettingsView() {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState<Section>("general");

  const ActiveComponent = SECTION_COMPONENTS[activeSection];

  return (
    <div className="flex h-full bg-background">
      {/* Left nav */}
      <aside className="w-52 shrink-0 border-r border-border/70 bg-card flex flex-col">
        <div className="px-4 py-4 border-b border-border/50">
          <h1 className="text-sm font-semibold text-foreground">Settings</h1>
        </div>
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const isActive = activeSection === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs transition-colors ${
                  isActive
                    ? "bg-accent text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-primary" : ""}`} />
                {s.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-8 py-8">
          <ActiveComponent user={user} />
        </div>
      </main>
    </div>
  );
}
