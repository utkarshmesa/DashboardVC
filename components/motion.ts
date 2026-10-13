'use client';
// Small motion helpers shared by client components. Every effect is skipped when the visitor asks for reduced motion.
import { gsap } from 'gsap';

export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Confirmation for logging outreach: a square outline expands from the button and fades, like a target lock.
// It lives on <body>, so it survives the card re-rendering or moving section after the refresh.
export function burst(from: Element | null) {
  if (!from || reducedMotion()) return;
  const r = from.getBoundingClientRect();
  const box = document.createElement('span');
  Object.assign(box.style, {
    position: 'fixed', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`,
    border: '1px solid var(--accent-text)', pointerEvents: 'none', zIndex: '60',
  });
  document.body.appendChild(box);
  gsap.fromTo(box, { scale: 1, opacity: 0.9 }, { scale: 1.35, opacity: 0, duration: 0.6, ease: 'power2.out', onComplete: () => box.remove() });
}
