import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import type { Period } from "@/lib/lms";
import { useLmsContext } from "@/lib/lms-context";
import tnLogo from "@/assets/tn-logo.png.asset.json";
import manarkeniLogo from "@/assets/manarkeni-logo.png.asset.json";

const NAV = [
  { to: "/", label: "Overall" },
  { to: "/lead", label: "Lead-wise" },
  { to: "/region", label: "Region-wise" },
  { to: "/school", label: "School-wise" },
  { to: "/courses", label: "Course-level" },
];


export function Shell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-6 px-6 py-4">
          <div className="flex items-center gap-3">
            <img src={tnLogo.url} alt="Government of Tamil Nadu emblem" className="h-11 w-auto" />
            <img src={manarkeniLogo.url} alt="Manarkeni logo" className="h-7 w-auto" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight text-foreground">
              Manarkeni LMS Consumption Dashboard
            </p>
            <DataSourceBadge />
          </div>
          <nav className="flex flex-wrap gap-1">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  path === n.to
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-6 py-8">{children}</main>
    </div>
  );
}

function DataSourceBadge() {
  const { recordCount, source } = useLmsContext();
  return (
    <p className="text-xs text-muted-foreground">
      {source.label} · {recordCount.toLocaleString()} records
      {source.uploadedAt ? ` · uploaded ${new Date(source.uploadedAt).toLocaleDateString()}` : ""}
    </p>
  );
}



export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-border bg-card p-4">
      {children}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

const controlCls =
  "h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none focus:border-ring";

export function Select({
  value,
  onChange,
  options,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <select
      className={`${controlCls} min-w-[180px] disabled:opacity-50`}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      {placeholder ? <option value="">{placeholder}</option> : null}
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

/** Checkbox dropdown; an empty selection means "all". */
export function MultiSelect({
  values,
  onChange,
  options,
  placeholder = "All",
  disabled,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = options.filter((o) =>
    o.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const label =
    values.length === 0
      ? placeholder
      : values.length === 1
        ? values[0]
        : `${values.length} selected`;
  const toggle = (o: string) =>
    onChange(values.includes(o) ? values.filter((v) => v !== o) : [...values, o]);

  return (
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={`${controlCls} flex min-w-[200px] items-center justify-between gap-2 text-left disabled:opacity-50`}
      >
        <span className="truncate">{label}</span>
        <span className="text-muted-foreground">▾</span>
      </button>
      {open && !disabled ? (
        <div className="absolute z-20 mt-1 w-[260px] rounded-md border border-border bg-card p-2 shadow-lg">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className={`${controlCls} mb-2 w-full`}
          />
          <div className="mb-2 flex gap-2 text-xs">
            <button
              type="button"
              className="rounded px-2 py-1 text-muted-foreground hover:bg-muted"
              onClick={() => onChange(filtered)}
            >
              Select all
            </button>
            <button
              type="button"
              className="rounded px-2 py-1 text-muted-foreground hover:bg-muted"
              onClick={() => onChange([])}
            >
              Clear
            </button>
          </div>
          <div className="max-h-[260px] overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-1 py-2 text-xs text-muted-foreground">No matches</p>
            ) : null}
            {filtered.map((o) => (
              <label
                key={o}
                className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-foreground hover:bg-muted"
              >
                <input
                  type="checkbox"
                  checked={values.includes(o)}
                  onChange={() => toggle(o)}
                />
                <span className="truncate">{o}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PeriodPicker({
  period,
  onChange,
}: {
  period: Period;
  onChange: (p: Period) => void;
}) {
  const { data } = useLmsContext();
  const overall = data.defaultPeriod;
  const isOverall = period.from === overall.from && period.to === overall.to;
  return (
    <>
      <Field label="From date">
        <input
          type="date"
          className={controlCls}
          value={period.from}
          max={period.to || undefined}
          onChange={(e) => onChange({ ...period, from: e.target.value })}
        />
      </Field>
      <Field label="To date">
        <input
          type="date"
          className={controlCls}
          value={period.to}
          min={period.from || undefined}
          onChange={(e) => onChange({ ...period, to: e.target.value })}
        />
      </Field>
      <Field label="Shortcut">
        <button
          type="button"
          onClick={() => onChange({ ...overall })}
          className={`${controlCls} whitespace-nowrap font-medium ${
            isOverall ? "bg-accent text-accent-foreground" : "hover:bg-muted"
          }`}
        >
          Overall time
        </button>
      </Field>
    </>
  );
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

export function Kpi({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "positive" | "warning";
}) {
  const toneCls =
    tone === "positive"
      ? "text-positive"
      : tone === "warning"
        ? "text-warning"
        : "text-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tabular-nums ${toneCls}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <h2 className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
        {title}
      </h2>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function BarList({
  items,
  emptyLabel = "No data for this selection",
}: {
  items: { label: string; value: number; caption?: string }[];
  emptyLabel?: string;
}) {
  if (items.length === 0)
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-foreground">{i.label}</span>
            <span className="tabular-nums text-muted-foreground">{i.caption ?? i.value}</span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-chart-bar"
              style={{ width: `${(i.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function heatBand(value: number) {
  if (value >= 80) return { bg: "var(--heat-dark-green)", fg: "var(--heat-fg-light)" };
  if (value >= 60) return { bg: "var(--heat-light-green)", fg: "var(--heat-fg-dark)" };
  if (value >= 40) return { bg: "var(--heat-yellow)", fg: "var(--heat-fg-dark)" };
  if (value >= 20) return { bg: "var(--heat-orange)", fg: "var(--heat-fg-dark)" };
  return { bg: "var(--heat-red)", fg: "var(--heat-fg-light)" };
}

export function HeatCell({ value }: { value: number }) {
  const band = heatBand(value);
  return (
    <td
      className="px-3 py-2 text-center font-medium tabular-nums"
      style={{ backgroundColor: band.bg, color: band.fg }}
    >
      {value.toFixed(0)}%
    </td>
  );
}

export function HeatLegend() {
  const bands = [
    { label: "0–20%", v: 10 },
    { label: "20–40%", v: 30 },
    { label: "40–60%", v: 50 },
    { label: "60–80%", v: 70 },
    { label: "80–100%", v: 90 },
  ];
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>Legend:</span>
      {bands.map((b) => {
        const band = heatBand(b.v);
        return (
          <span
            key={b.label}
            className="rounded-md px-2 py-0.5 font-medium"
            style={{ backgroundColor: band.bg, color: band.fg }}
          >
            {b.label}
          </span>
        );
      })}
    </div>
  );
}

export function SearchableBarList({
  items,
  placeholder = "Search…",
}: {
  items: { label: string; value: number; caption?: string; percent?: number }[];
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const filtered = items.filter((i) => i.label.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className={`${controlCls} mb-3 w-full`}
      />
      <div className="max-h-[420px] overflow-y-auto pr-1">
        <ul className="space-y-3">
          {filtered.length === 0 ? (
            <li className="text-sm text-muted-foreground">No matches</li>
          ) : null}
          {filtered.map((i) => {
            const pct = Math.min(Math.max(i.percent ?? 0, 0), 100);
            const band = heatBand(pct);
            return (
              <li key={i.label}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate text-foreground">{i.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {i.caption ?? i.value}
                  </span>
                </div>
                <div className="mt-1.5 h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: band.bg }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/**
 * Table head columns keep the spreadsheet letter separate from the label so the
 * letters (and their formulas) render on their own second header row.
 */
export type HeadCol = string | { code?: string; label: string };

function splitHead(h: HeadCol): { code: string; label: string } {
  if (typeof h !== "string") return { code: h.code ?? "", label: h.label };
  const parts = h.split("·");
  if (parts.length > 1)
    return { code: (parts[0] ?? "").trim(), label: parts.slice(1).join("·").trim() };

  return { code: "", label: h };
}

export function Table({ head, children }: { head: HeadCol[]; children: ReactNode }) {
  const cols = head.map(splitHead);
  const hasCodes = cols.some((c) => c.code);
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[720px] border-collapse text-sm [&_td]:border [&_td]:border-border [&_td]:!text-center [&_td]:align-middle [&_th]:border [&_th]:border-border">
        <thead>
          <tr className="bg-muted/60">
            {cols.map((c) => (
              <th
                key={c.label}
                className="px-3 py-2.5 text-center text-xs font-semibold tracking-wide text-muted-foreground"
              >
                {c.label}
              </th>
            ))}
          </tr>
          {hasCodes ? (
            <tr className="bg-muted">
              {cols.map((c) => (
                <th
                  key={`code-${c.label}`}
                  className="px-3 py-1.5 text-center text-[11px] font-bold tabular-nums tracking-wider text-foreground/70"
                >
                  {c.code || "—"}
                </th>
              ))}
            </tr>
          ) : null}
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}


export function Tag({ yes, labels = ["Yes", "No"] }: { yes: boolean; labels?: [string, string] }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
        yes ? "bg-positive-soft text-positive" : "bg-warning-soft text-warning"
      }`}
    >
      {yes ? labels[0] : labels[1]}
    </span>
  );
}
