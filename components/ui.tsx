// Small shared UI kit (server- and client-safe: no hooks). All colours come from the tokens in app/globals.css.
import type { ReactNode, SVGProps } from 'react';

// ---- Icons (inline, 16px, stroke = currentColor) ----
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
const svg = (d: ReactNode) => function Icon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true" {...P} {...props}>{d}</svg>;
};
export const I = {
  mail: svg(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>),
  form: svg(<><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 8h6M9 12h6M9 16h3" /></>),
  linkedin: svg(<><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7" /></>),
  globe: svg(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>),
  external: svg(<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />),
  chevron: svg(<path d="m6 9 6 6 6-6" />),
  sparkle: svg(<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />),
  clock: svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  alert: svg(<><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17v.01" /></>),
  check: svg(<path d="m5 12 5 5 9-10" />),
  copy: svg(<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a1 1 0 0 1 1-1h10" /></>),
  users: svg(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a5 5 0 0 1 3.5 6" /></>),
  plus: svg(<path d="M12 5v14M5 12h14" />),
  more: svg(<><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>),
  bolt: svg(<path d="M13 3 4 14h7l-1 7 9-11h-7l1-7Z" />),
  thumbUp: svg(<path d="M7 11v9H4v-9h3Zm0 0 4-8a2 2 0 0 1 2 2v4h5.5a2 2 0 0 1 2 2.3l-1.2 6.5a2 2 0 0 1-2 1.7H7" />),
  thumbDown: svg(<path d="M7 13V4H4v9h3Zm0 0 4 8a2 2 0 0 0 2-2v-4h5.5a2 2 0 0 0 2-2.3l-1.2-6.5a2 2 0 0 0-2-1.7H7" />),
  route: svg(<><circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" /><path d="M8 19h8a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h8" /></>),
};

// ---- Buttons (class strings so links and buttons share one look) ----
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';
const BASE = 'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-[background,box-shadow,color,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink shadow-card hover:bg-accent-2',
  secondary: 'bg-surface text-ink ring-1 ring-line-2 hover:bg-surface-2 hover:ring-ink-3/40',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  danger: 'bg-surface text-danger ring-1 ring-danger/30 hover:bg-danger-soft',
  quiet: 'text-ink-3 hover:text-ink-2 hover:bg-surface-2',
};
export const btn = (v: Variant = 'secondary', size: 'sm' | 'md' = 'sm') =>
  `${BASE} ${VARIANT[v]} ${size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm'}`;

// ---- Tones ----
export type Tone = 'accent' | 'warn' | 'danger' | 'info' | 'violet' | 'neutral';
export const TONE: Record<Tone, { soft: string; text: string; dot: string }> = {
  accent: { soft: 'bg-accent-soft', text: 'text-accent-text', dot: 'bg-accent' },
  warn: { soft: 'bg-warn-soft', text: 'text-warn', dot: 'bg-warn' },
  danger: { soft: 'bg-danger-soft', text: 'text-danger', dot: 'bg-danger' },
  info: { soft: 'bg-info-soft', text: 'text-info', dot: 'bg-info' },
  violet: { soft: 'bg-violet-soft', text: 'text-violet', dot: 'bg-violet' },
  neutral: { soft: 'bg-surface-2', text: 'text-ink-2', dot: 'bg-ink-3' },
};

export function actionToneOf(action: string): Tone {
  if (action.startsWith('Reach out')) return 'accent';
  if (action.startsWith('Nudge') || action.startsWith('Close the loop') || action.startsWith('Next step') || action.startsWith('Mention')) return 'info';
  if (action.startsWith('Warm') || action.startsWith('Data unavailable')) return 'warn';
  if (action.startsWith('Check conflict')) return 'danger';
  if (action.startsWith('Same firm')) return 'violet';
  if (action.startsWith('Good fit') || action.startsWith('Added by you')) return 'accent';
  return 'neutral';
}

export function Badge({ tone = 'neutral', children, title, className = '' }: { tone?: Tone; children: ReactNode; title?: string; className?: string }) {
  return <span title={title} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium ${TONE[tone].soft} ${TONE[tone].text} ${className}`}>{children}</span>;
}

// "auto": values written by the pipeline or the AI, not by Vikram (SPEC §11.5).
export function Auto({ title = 'Written by the pipeline (AI or code) from the linked sources, not by you' }: { title?: string }) {
  return (
    <span title={title} className="ml-1 inline-flex translate-y-[-1px] items-center gap-0.5 rounded px-1 align-middle text-[10px] font-medium uppercase tracking-wider text-ink-3 ring-1 ring-line">
      <I.sparkle width={10} height={10} />auto
    </span>
  );
}

// ---- Avatar: initials on a tone tied to the fit label ----
const AV: Record<string, string> = {
  strong: 'bg-accent text-accent-ink', good: 'bg-info-soft text-info', weak: 'bg-surface-2 text-ink-2 ring-1 ring-line',
};
export function Avatar({ name, fit, size = 40 }: { name: string; fit: string; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
  return (
    <span aria-hidden="true" style={{ width: size, height: size, fontSize: size * 0.36 }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight ${AV[fit] ?? AV.weak}`}>{initials}</span>
  );
}

// ---- Fit meter: a ring that fills with the 0–100 fit score ----
export function FitMeter({ score, label, size = 44, title }: { score: number; label: string; size?: number; title?: string }) {
  const r = (size - 6) / 2, c = 2 * Math.PI * r, pct = Math.max(0, Math.min(100, score)) / 100;
  const colour = label === 'strong' ? 'var(--accent)' : label === 'good' ? 'var(--info)' : 'var(--ink-3)';
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} title={title ?? `Fit ${score}/100 (${label})`} role="img" aria-label={`Fit ${score} out of 100, ${label}`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={4} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colour} strokeWidth={4} strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} />
      </svg>
      <span className="absolute font-mono text-[12.5px] font-semibold tabular-nums text-ink">{score}</span>
    </span>
  );
}

// ---- Layout pieces ----
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-surface shadow-card ring-1 ring-line ${className}`}>{children}</div>;
}

export function SectionTitle({ children, count, hint, tone }: { children: ReactNode; count?: number; hint?: string; tone?: Tone }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight text-ink">
        {tone && <span className={`h-2 w-2 rounded-full ${TONE[tone].dot}`} aria-hidden="true" />}
        {children}
        {count !== undefined && <span className="font-mono text-[12px] font-medium text-ink-3">{count}</span>}
      </h2>
      {hint && <p className="text-[13px] text-ink-3">{hint}</p>}
    </div>
  );
}

export function PageTitle({ eyebrow, title, sub }: { eyebrow?: string; title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-8">
      {eyebrow && <p className="mb-2 text-[12px] font-medium uppercase tracking-[0.14em] text-ink-3">{eyebrow}</p>}
      <h1 className="font-display text-[40px] leading-[1.05] tracking-tight text-ink sm:text-[46px]">{title}</h1>
      {sub && <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-2">{sub}</p>}
    </div>
  );
}

export const inputCls = 'w-full rounded-lg bg-surface px-3 py-2 text-[14px] text-ink ring-1 ring-line-2 placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-accent';
export const labelCls = 'block text-[13px] font-medium text-ink';
export const helpCls = 'mt-0.5 mb-1.5 block text-[12.5px] text-ink-3';
