'use client';
// Page motion, driven by data attributes so server components stay server components. Console language: precise,
// quick, no bounce, no glow.
//   [data-line]      headline lines lift out of their mask            [data-scramble]  mono labels decode into place
//   [data-reveal]    blocks fade up after the headline                [data-count]     numbers count up to their value
//   [data-fill]      bars draw from the left                          [data-seg]       pipeline segments draw in turn
//   [data-card]      dossier entries cascade in on scroll             [data-segs]      fit-meter segments light in sequence
//   [data-progress]  header scroll-progress line                      [data-draw]      SVG strokes draw on
// Reduced motion: nothing animates; content is shown immediately. If this script never runs, a timeout in the layout
// removes the pending class, so content is never hidden for good.
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { usePathname } from 'next/navigation';

gsap.registerPlugin(ScrollTrigger, useGSAP);
// Development only: lets automated checks drive the animation clock (headless/background tabs throttle frames).
if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') Object.assign(window as object, { __gsap: gsap, __ST: ScrollTrigger });

const ease = 'expo.out';
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/·—';

function countUp(el: HTMLElement, delay = 0) {
  const to = Number(el.dataset.count ?? el.textContent ?? 0);
  const decimals = Number(el.dataset.decimals ?? 0);
  if (!Number.isFinite(to)) return;
  const o = { v: 0 };
  el.textContent = (0).toFixed(decimals);
  gsap.to(o, { v: to, duration: 1.1, delay, ease: 'power3.out', onUpdate: () => { el.textContent = o.v.toFixed(decimals); }, onComplete: () => { el.textContent = to.toFixed(decimals); } });
}

// Characters resolve left to right through random glyphs. Text-only elements; the final text is always restored.
function scramble(el: HTMLElement, delay = 0) {
  if (el.children.length) return;
  const final = el.textContent ?? '';
  if (!final.trim()) return;
  const o = { p: 0 };
  gsap.to(o, {
    p: 1, duration: Math.min(0.9, 0.35 + final.length * 0.02), delay, ease: 'none',
    onStart: () => { el.style.minWidth = `${el.offsetWidth}px`; },
    onUpdate: () => {
      const done = Math.floor(o.p * final.length);
      el.textContent = final.slice(0, done) + [...final.slice(done)].map((c) => (c === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join('');
    },
    onComplete: () => { el.textContent = final; el.style.minWidth = ''; },
  });
}

// Fit meter: lit segments switch on one after another.
function lightSegments(scope: ParentNode, delay = 0) {
  scope.querySelectorAll<HTMLElement>('[data-segs]').forEach((m, j) => {
    const on = m.querySelectorAll('[data-seg-on="1"]');
    if (on.length) gsap.fromTo(on, { opacity: 0.12 }, { opacity: 1, duration: 0.08, stagger: 0.045, delay: delay + j * 0.03, ease: 'none', clearProps: 'opacity' });
    m.parentElement?.querySelectorAll<HTMLElement>('[data-count]').forEach((n) => countUp(n, delay));
  });
}

export default function Motion() {
  const pathname = usePathname();

  useGSAP(() => {
    const root = document.documentElement;
    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      const q = <T extends Element = HTMLElement>(s: string) => gsap.utils.toArray<T>(s);
      // Only cards that are rendered now: rows inside a collapsed group have no size, so a scroll trigger would retire
      // without ever revealing them. Those rows animate in when their group opens (see the toggle handler below).
      const rendered = (el: Element) => el.getClientRects().length > 0;
      const lines = q('[data-line]'), reveal = q('[data-reveal]'), cards = q('[data-card]').filter(rendered);
      // Hide what will animate (inline styles beat the CSS pending rule), then release the pending class.
      gsap.set(lines, { yPercent: 105 });
      gsap.set(reveal, { autoAlpha: 0, y: 14 });
      gsap.set(cards, { autoAlpha: 0, y: 18 });
      root.classList.remove('motion-pending');

      const tl = gsap.timeline({ defaults: { ease } });
      tl.to(lines, { yPercent: 0, duration: 1.1, stagger: 0.09, clearProps: 'transform' })
        .to(reveal, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.06 }, 0.25)
        .add(() => {
          q('[data-scramble]').filter((el) => !el.closest('[data-card]')).forEach((el, i) => scramble(el, i * 0.04));
          q('[data-reveal] [data-count]').filter((el) => !el.closest('[data-segs]') && !el.parentElement?.querySelector('[data-segs]')).forEach((el, i) => countUp(el, i * 0.05));
        }, 0.3)
        .fromTo(q('[data-fill]'), { scaleX: 0 }, { scaleX: 1, transformOrigin: 'left center', duration: 1.2, ease: 'expo.inOut' }, 0.5)
        .fromTo(q('[data-seg]'), { scaleX: 0 }, { scaleX: 1, transformOrigin: 'left center', duration: 0.7, stagger: 0.1, ease: 'expo.out' }, 0.55);

      // Dossier entries cascade in as they enter the viewport; their fit segments light at the same moment.
      ScrollTrigger.batch(cards, {
        start: 'top 94%', once: true,
        onEnter: (batch) => {
          gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.06, ease, overwrite: true });
          batch.forEach((c, i) => lightSegments(c, 0.15 + i * 0.06));
        },
      });
      // Insurance for jumps (anchor links, End key, fast flicks): when scrolling stops, any card that is in or above the
      // viewport but still hidden is revealed at once. Content must never stay invisible.
      const sweepMissed = () => {
        const limit = window.innerHeight * 0.98;
        cards.forEach((c) => {
          if (rendered(c) && c.getBoundingClientRect().top < limit && Number(gsap.getProperty(c, 'autoAlpha')) < 1 && !gsap.isTweening(c)) {
            gsap.to(c, { autoAlpha: 1, y: 0, duration: 0.35, ease, overwrite: true });
          }
        });
      };
      ScrollTrigger.addEventListener('scrollEnd', sweepMissed);

      // Fit meters outside cards (e.g. the Investors table).
      q('[data-segs]').filter((m) => !m.closest('[data-card]')).forEach((m) => ScrollTrigger.create({ trigger: m, start: 'top 96%', once: true, onEnter: () => lightSegments(m.parentElement ?? m) }));

      // Logo strokes draw on.
      q<SVGGeometryElement>('[data-draw] path, [data-draw] circle, [data-draw] rect').forEach((p, i) => {
        const len = typeof p.getTotalLength === 'function' ? p.getTotalLength() : 60;
        gsap.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.2, delay: 0.1 + i * 0.18, ease: 'expo.inOut', clearProps: 'strokeDasharray,strokeDashoffset' });
      });

      // Header progress line follows the scroll.
      q('[data-progress]').forEach((el) => gsap.fromTo(el, { scaleX: 0 }, { scaleX: 1, ease: 'none', transformOrigin: 'left center', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } }));

      // Opening a group, a card or a details panel changes the page height: re-measure every trigger, so content in a
      // group that was collapsed (zero height when measured) still reveals instead of staying hidden.
      let raf = 0;
      const remeasure = (e?: Event) => {
        cancelAnimationFrame(raf); raf = requestAnimationFrame(() => ScrollTrigger.refresh());
        // A group just opened: its rows cascade in (they were never hidden, so an interrupted tween leaves them visible).
        const d = e?.target as HTMLDetailsElement | undefined;
        if (d?.tagName === 'DETAILS' && d.open) {
          const rows = d.querySelectorAll('[data-card]');
          if (rows.length) gsap.fromTo(rows, { autoAlpha: 0, x: -8 }, { autoAlpha: 1, x: 0, duration: 0.4, stagger: 0.03, ease, clearProps: 'transform,opacity,visibility' });
        }
      };
      const ro = new ResizeObserver(() => remeasure());
      ro.observe(document.body);
      document.addEventListener('toggle', remeasure, true);
      return () => { ro.disconnect(); document.removeEventListener('toggle', remeasure, true); cancelAnimationFrame(raf); ScrollTrigger.removeEventListener('scrollEnd', sweepMissed); };
    });

    // Reduced motion (or anything else): show everything immediately.
    mm.add('(prefers-reduced-motion: reduce)', () => { root.classList.remove('motion-pending'); });
    return () => mm.revert();
  }, { dependencies: [pathname], revertOnUpdate: true });

  return null;
}
