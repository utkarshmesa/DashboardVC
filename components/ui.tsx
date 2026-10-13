// Small shared UI kit (server- and client-safe: no hooks). All colours come from the tokens in app/globals.css.
// Visual language: operational console — square geometry, hairlines, mono labels, colour only when it means something.
import type { HTMLAttributes, ReactNode, SVGProps } from 'react';

// ---- Icons (inline, 16px, fine 1.5 stroke = currentColor) ----
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'square', strokeLinejoin: 'miter' } as const;
const svg = (d: ReactNode) => function Icon(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true" {...P} {...props}>{d}</svg>;
};
export const I = {
  mail: svg(<><rect x="3" y="5" width="18" height="14" /><path d="m3 7 9 6 9-6" /></>),
  form: svg(<><rect x="5" y="3" width="14" height="18" /><path d="M9 8h6M9 12h6M9 16h3" /></>),
  linkedin: svg(<><rect x="3" y="3" width="18" height="18" /><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7" /></>),
  globe: svg(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>),
  external: svg(<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />),
  chevron: svg(<path d="m6 9 6 6 6-6" />),
  arrow: svg(<path d="M5 12h14M13 6l6 6-6 6" />),
  sparkle: svg(<path d="M12 3v4M12 17v4M3 12h4M17 12h4" />),
  clock: svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  alert: svg(<><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17v.01" /></>),
  check: svg(<path d="m5 12 5 5 9-10" />),
  copy: svg(<><rect x="9" y="9" width="11" height="11" /><path d="M5 15V4h11" /></>),
  users: svg(<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a5 5 0 0 1 3.5 6" /></>),
  plus: svg(<path d="M12 5v14M5 12h14" />),
  more: svg(<><path d="M5 12h.01M12 12h.01M19 12h.01" strokeWidth={3} /></>),
  bolt: svg(<path d="M13 3 4 14h7l-1 7 9-11h-7l1-7Z" />),
  thumbUp: svg(<path d="M7 11v9H4v-9h3Zm0 0 4-8a2 2 0 0 1 2 2v4h5.5a2 2 0 0 1 2 2.3l-1.2 6.5a2 2 0 0 1-2 1.7H7" />),
  thumbDown: svg(<path d="M7 13V4H4v9h3Zm0 0 4 8a2 2 0 0 0 2-2v-4h5.5a2 2 0 0 0 2-2.3l-1.2-6.5a2 2 0 0 0-2-1.7H7" />),
  route: svg(<><path d="M4 20V4h16" /><path d="M8 16l4-5 3 3 5-7" /></>),
  lock: svg(<><rect x="5" y="11" width="14" height="10" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>),
};

// ---- Buttons (class strings so links and buttons share one look) ----
// Square geometry, hairline borders; the primary action is white on black. No glows, no gradients.
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';
const BASE = 'inline-flex items-center justify-center gap-1.5 rounded-[2px] font-medium transition-[background,border-color,color,translate] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-40 whitespace-nowrap';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:bg-accent-2',
  secondary: 'border border-line-2 text-ink hover:border-ink-3 hover:bg-surface-2',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  danger: 'border border-danger/40 text-danger hover:bg-danger-soft',
  quiet: 'text-ink-3 hover:text-ink',
};
export const btn = (v: Variant = 'secondary', size: 'sm' | 'md' = 'sm') =>
  `${BASE} ${VARIANT[v]} ${size === 'sm' ? 'h-8 px-3 text-[12.5px]' : 'h-10 px-4 text-[13.5px]'}`;

// ---- Tones (semantic only) ----
export type Tone = 'signal' | 'accent' | 'warn' | 'danger' | 'info' | 'violet' | 'neutral';
export const TONE: Record<Tone, { soft: string; text: string; dot: string; border: string }> = {
  signal: { soft: 'bg-signal-soft', text: 'text-signal', dot: 'bg-signal', border: 'border-signal/40' },
  accent: { soft: 'bg-accent-soft', text: 'text-accent-text', dot: 'bg-accent-text', border: 'border-accent-text/35' },
  warn: { soft: 'bg-warn-soft', text: 'text-warn', dot: 'bg-warn', border: 'border-warn/35' },
  danger: { soft: 'bg-danger-soft', text: 'text-danger', dot: 'bg-danger', border: 'border-danger/40' },
  info: { soft: 'bg-info-soft', text: 'text-info', dot: 'bg-info', border: 'border-info/35' },
  violet: { soft: 'bg-violet-soft', text: 'text-violet', dot: 'bg-violet', border: 'border-violet/35' },
  neutral: { soft: 'bg-surface-2', text: 'text-ink-2', dot: 'bg-ink-3', border: 'border-line-2' },
};

export function actionToneOf(action: string): Tone {
  if (action.startsWith('Reach out')) return 'signal';
  if (action.startsWith('Nudge') || action.startsWith('Close the loop') || action.startsWith('Next step') || action.startsWith('Mention')) return 'info';
  if (action.startsWith('Warm') || action.startsWith('Data unavailable')) return 'warn';
  if (action.startsWith('Check conflict')) return 'danger';
  if (action.startsWith('Same firm')) return 'violet';
  if (action.startsWith('Good fit') || action.startsWith('Added by you')) return 'accent';
  return 'neutral';
}

// Rectangular mono tag: the console's status language.
export function Badge({ tone = 'neutral', children, title, className = '' }: { tone?: Tone; children: ReactNode; title?: string; className?: string }) {
  return <span title={title} className={`inline-flex items-center gap-1.5 rounded-[2px] border px-1.5 py-[3px] font-mono text-[10.5px] font-medium uppercase leading-none tracking-[0.08em] ${TONE[tone].border} ${TONE[tone].text} ${className}`}>{children}</span>;
}

// "auto": values written by the pipeline or the AI, not by Vikram (SPEC §11.5).
export function Auto({ title = 'Written by the pipeline (AI or code) from the linked sources, not by you' }: { title?: string }) {
  return <span title={title} className="ml-1.5 inline-flex translate-y-[-1px] items-center align-middle font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-3">[auto]</span>;
}

// Monogram: a square mono tile.
export function Avatar({ name, fit, size = 32 }: { name: string; fit: string; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
  return (
    <span aria-hidden="true" style={{ width: size, height: size, fontSize: size * 0.34 }}
      className={`inline-flex shrink-0 items-center justify-center rounded-[2px] border font-mono font-medium tracking-wider ${fit === 'strong' ? 'border-ink-2 text-ink' : 'border-line-2 text-ink-3'}`}>{initials}</span>
  );
}

// Fit meter: ten segments that light up to the 0–100 fit score, with the number in mono.
export function FitMeter({ score, label, title, compact = false }: { score: number; label: string; size?: number; title?: string; compact?: boolean }) {
  const lit = Math.round(Math.max(0, Math.min(100, score)) / 10);
  const on = label === 'strong' ? 'bg-ink' : label === 'good' ? 'bg-ink-2' : 'bg-ink-3';
  return (
    <span className="inline-flex items-center gap-2.5" title={title ?? `Fit ${score}/100 (${label})`} role="img" aria-label={`Fit ${score} out of 100, ${label}`}>
      <span data-segs="" className="flex gap-[3px]">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} data-seg-on={i < lit ? '1' : '0'} className={`${compact ? 'h-2.5 w-[4px]' : 'h-3.5 w-[5px]'} ${i < lit ? on : 'bg-line-2'}`} />
        ))}
      </span>
      <span data-count={score} className={`font-mono tabular-nums text-ink ${compact ? 'text-[12px]' : 'text-[15px] font-medium'}`}>{score}</span>
    </span>
  );
}

// "Person / Firm", each a link: the person to their LinkedIn, the firm to its website. When either isn't known, the
// link is a web search for it (labelled as such in the tooltip), never a guessed URL.
const search = (q: string) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
export function NameLinks({ name, firm, linkedin, website, className = '' }: { name: string; firm: string; linkedin: string | null; website: string | null; className?: string }) {
  const a = 'relative z-[1] underline decoration-transparent decoration-1 underline-offset-4 transition-colors hover:decoration-current focus-visible:decoration-current';
  return (
    <span className={className}>
      <a href={linkedin ?? search(`${name} ${firm} LinkedIn`)} target="_blank" rel="noopener noreferrer" title={linkedin ? `${name} on LinkedIn` : `Search for ${name}'s LinkedIn`} className={`${a} text-ink`}>{name}</a>
      <span className="text-ink-3"> / </span>
      <a href={website ?? search(`${firm} venture capital`)} target="_blank" rel="noopener noreferrer" title={website ? `${firm} website (${website.replace(/^https:\/\//, '')})` : `Search for ${firm}'s website`} className={`${a} text-ink-3 hover:text-ink-2`}>{firm}</a>
    </span>
  );
}

// ---- Layout pieces ----
export function Card({ children, className = '', ...rest }: { children: ReactNode; className?: string } & HTMLAttributes<HTMLDivElement> & Record<`data-${string}`, string>) {
  return <div {...rest} className={`rounded-[2px] border border-line bg-surface ${className}`}>{children}</div>;
}

// Indexed section header: "01  Reach out this week ..................... 06"
export function SectionTitle({ children, count, hint, tone, index }: { children: ReactNode; count?: number; hint?: string; tone?: Tone; index?: string }) {
  return (
    <div className="mb-4 border-b border-line pb-3">
      <div className="flex items-baseline gap-3">
        {index && <span className="font-mono text-[11px] text-ink-3">{index}</span>}
        <h2 className="flex items-center gap-2.5 text-[15px] font-medium tracking-tight text-ink">
          {tone && <span className={`h-1.5 w-1.5 ${TONE[tone].dot}`} aria-hidden="true" />}
          {children}
        </h2>
        {count !== undefined && <span className="ml-auto font-mono text-[12px] tabular-nums text-ink-3">{String(count).padStart(2, '0')}</span>}
      </div>
      {hint && <p className="mt-1 text-[12.5px] text-ink-3">{hint}</p>}
    </div>
  );
}

export function PageTitle({ eyebrow, title, sub }: { eyebrow?: string; title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="relative mb-10 pt-4">
      <div className="grid-bg" aria-hidden="true" />
      <div className="relative z-[1]">
        {eyebrow && <p data-reveal="" data-scramble="" className="label mb-4">{eyebrow}</p>}
        <h1 className="max-w-3xl text-[40px] font-medium leading-[1.02] tracking-[-0.035em] text-ink sm:text-[52px]"><span className="mask-line"><span data-line="">{title}</span></span></h1>
        {sub && <p data-reveal="" className="mt-4 max-w-2xl text-[14.5px] leading-relaxed text-ink-2">{sub}</p>}
      </div>
    </div>
  );
}

export const inputCls = 'w-full rounded-[2px] border border-line-2 bg-paper px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-3 transition-colors focus:border-ink-2 focus:outline-none';
export const labelCls = 'block text-[13px] font-medium text-ink';
export const helpCls = 'mt-0.5 mb-2 block text-[12.5px] text-ink-3';
