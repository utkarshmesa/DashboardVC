'use client';
// Small motion helpers shared by client components. Every effect is skipped when the visitor asks for reduced motion.
import { gsap } from 'gsap';

export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// A brief burst of particles from an element: the reward for logging an email. Particles live on <body>, so the burst
// survives the card re-rendering or moving section after the refresh.
export function burst(from: Element | null) {
  if (!from || reducedMotion()) return;
  const r = from.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const colours = ['var(--accent)', 'var(--accent-2)', 'var(--warn)', 'var(--info)'];
  for (let i = 0; i < 14; i++) {
    const p = document.createElement('span');
    const size = 4 + Math.random() * 5;
    Object.assign(p.style, {
      position: 'fixed', left: `${cx}px`, top: `${cy}px`, width: `${size}px`, height: `${size}px`, borderRadius: i % 3 ? '999px' : '2px',
      background: colours[i % colours.length], pointerEvents: 'none', zIndex: '60',
    });
    document.body.appendChild(p);
    const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.4, dist = 40 + Math.random() * 46;
    gsap.fromTo(p, { x: -size / 2, y: -size / 2, scale: 1, opacity: 1 }, {
      x: Math.cos(angle) * dist, y: Math.sin(angle) * dist - 14, scale: 0.2, opacity: 0, rotation: Math.random() * 180,
      duration: 0.7 + Math.random() * 0.35, ease: 'power3.out', onComplete: () => p.remove(),
    });
  }
  gsap.fromTo(from, { scale: 0.94 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.45)' });
}
