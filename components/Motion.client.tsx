'use client';
// Page motion, driven by data attributes so server components stay server components:
//   [data-word]        hero headline words rise in, staggered        [data-reveal]   fades/rises in after the hero
//   [data-count]       numbers count up to their rendered value       [data-fill]     bars grow from the left
//   [data-seg]         pipeline segments grow, staggered              [data-card]     cards cascade in on scroll
//   [data-ring]        fit rings sweep to their score on scroll       [data-blob]     aurora blobs drift slowly
//   [data-tilt]        tiles tilt toward the pointer                  [data-spotlight] cursor spotlight (CSS vars)
//   [data-progress]    header scroll-progress line                    [data-draw]     SVG strokes draw on
// Reduced motion: nothing animates; content is shown immediately. If this script never runs, a timeout in the layout
// removes the pending class, so content is never hidden for good.
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { usePathname } from 'next/navigation';

gsap.registerPlugin(ScrollTrigger, useGSAP);
// Development only: lets automated checks drive the animation clock (headless/background tabs throttle frames).
if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') Object.assign(window as object, { __gsap: gsap, __ST: ScrollTrigger });

const ease = 'power3.out';

function countUp(el: HTMLElement, delay = 0) {
  const to = Number(el.dataset.count ?? el.textContent ?? 0);
  const decimals = Number(el.dataset.decimals ?? 0);
  if (!Number.isFinite(to)) return;
  const o = { v: 0 };
  el.textContent = (0).toFixed(decimals);
  gsap.to(o, { v: to, duration: 1.2, delay, ease: 'power2.out', onUpdate: () => { el.textContent = o.v.toFixed(decimals); } });
}

function sweepRing(svg: Element, delay = 0) {
  const arc = svg.querySelector<SVGCircleElement>('[data-ring-arc]');
  const num = svg.parentElement?.querySelector<HTMLElement>('[data-count]');
  if (arc) {
    const val = Number(arc.dataset.ringArc), total = Number(arc.dataset.ringTotal);
    gsap.fromTo(arc, { attr: { 'stroke-dasharray': `0 ${total}` } }, { attr: { 'stroke-dasharray': `${val} ${total}` }, duration: 1.3, delay, ease: 'power2.out' });
  }
  if (num) countUp(num, delay);
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
      const words = q('[data-word]'), reveal = q('[data-reveal]'), cards = q('[data-card]').filter(rendered);
      // Hide what will animate (inline styles beat the CSS pending rule), then release the pending class.
      gsap.set([...words, ...reveal], { autoAlpha: 0 });
      gsap.set(cards, { autoAlpha: 0, y: 26 });
      root.classList.remove('motion-pending');

      const tl = gsap.timeline({ defaults: { ease } });
      tl.fromTo(words, { yPercent: 70, rotate: 2, filter: 'blur(6px)' }, { autoAlpha: 1, yPercent: 0, rotate: 0, filter: 'blur(0px)', duration: 0.9, stagger: 0.06 })
        .to(reveal, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.07, startAt: { y: 18 } }, '-=0.55')
        .add(() => {
          q('[data-reveal] [data-count], [data-hero-count]').forEach((el, i) => countUp(el, i * 0.05));
        }, '-=0.6')
        .fromTo(q('[data-fill]'), { scaleX: 0 }, { scaleX: 1, transformOrigin: 'left center', duration: 1.1, ease: 'power2.inOut' }, '-=0.5')
        .fromTo(q('[data-seg]'), { scaleX: 0 }, { scaleX: 1, transformOrigin: 'left center', duration: 0.8, stagger: 0.12, ease: 'power2.out' }, '<');

      // Hero headline accent: a single gradient sweep across the emphasised words.
      q('[data-shimmer]').forEach((el) => gsap.fromTo(el, { backgroundPosition: '100% 50%' }, { backgroundPosition: '0% 50%', duration: 2.2, delay: 0.6, ease: 'power2.inOut' }));

      // Cards cascade in as they enter the viewport; their fit rings sweep at the same moment.
      ScrollTrigger.batch(cards, {
        start: 'top 92%', once: true,
        onEnter: (batch) => {
          gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.75, stagger: 0.08, ease, overwrite: true });
          batch.forEach((c, i) => c.querySelectorAll('[data-ring]').forEach((r) => sweepRing(r, 0.15 + i * 0.08)));
        },
      });
      // Insurance for jumps (anchor links, End key, fast flicks): when scrolling stops, any card that is in or above the
      // viewport but still hidden is revealed at once, ring included. Content must never stay invisible.
      const sweepMissed = () => {
        const limit = window.innerHeight * 0.98;
        cards.forEach((c) => {
          if (rendered(c) && c.getBoundingClientRect().top < limit && Number(gsap.getProperty(c, 'autoAlpha')) < 1 && !gsap.isTweening(c)) {
            gsap.to(c, { autoAlpha: 1, y: 0, duration: 0.4, ease, overwrite: true });
            c.querySelectorAll('[data-ring]').forEach((r) => sweepRing(r));
          }
        });
      };
      ScrollTrigger.addEventListener('scrollEnd', sweepMissed);

      // Rings outside cards (e.g. Investors page)
      q('[data-ring]').filter((r) => !r.closest('[data-card]')).forEach((r) => ScrollTrigger.create({ trigger: r, start: 'top 95%', once: true, onEnter: () => sweepRing(r) }));

      // Aurora: slow, endless drift.
      q('[data-blob]').forEach((b, i) => {
        gsap.to(b, { x: `random(-90, 90)`, y: `random(-50, 50)`, scale: `random(0.85, 1.2)`, duration: `random(9, 15)`, ease: 'sine.inOut', repeat: -1, yoyo: true, repeatRefresh: true, delay: i * 0.4 });
      });

      // Logo strokes draw on.
      q<SVGGeometryElement>('[data-draw] path, [data-draw] circle').forEach((p, i) => {
        const len = typeof p.getTotalLength === 'function' ? p.getTotalLength() : 60;
        gsap.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.1, delay: 0.1 + i * 0.15, ease: 'power2.inOut' });
      });

      // Header progress line follows the scroll.
      q('[data-progress]').forEach((el) => gsap.fromTo(el, { scaleX: 0 }, { scaleX: 1, ease: 'none', transformOrigin: 'left center', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } }));

      // Opening a group, a card or a details panel changes the page height: re-measure every trigger, so content in a
      // group that was collapsed (zero height when measured) still reveals instead of staying hidden.
      const cleanups: (() => void)[] = [];
      let raf = 0;
      const remeasure = (e?: Event) => {
        cancelAnimationFrame(raf); raf = requestAnimationFrame(() => ScrollTrigger.refresh());
        // A group just opened: its rows cascade in (they were never hidden, so an interrupted tween leaves them visible).
        const d = e?.target as HTMLDetailsElement | undefined;
        if (d?.tagName === 'DETAILS' && d.open) {
          const rows = d.querySelectorAll('[data-card]');
          if (rows.length) gsap.fromTo(rows, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.035, ease, clearProps: 'transform,opacity,visibility' });
        }
      };
      const ro = new ResizeObserver(() => remeasure());
      ro.observe(document.body);
      document.addEventListener('toggle', remeasure, true);
      cleanups.push(() => { ro.disconnect(); document.removeEventListener('toggle', remeasure, true); cancelAnimationFrame(raf); ScrollTrigger.removeEventListener('scrollEnd', sweepMissed); });

      // Tiles tilt toward the pointer.
      q('[data-tilt]').forEach((el) => {
        const rx = gsap.quickTo(el, 'rotationX', { duration: 0.5, ease }), ry = gsap.quickTo(el, 'rotationY', { duration: 0.5, ease });
        gsap.set(el, { transformPerspective: 900 });
        const move = (e: PointerEvent) => { const r = el.getBoundingClientRect(); ry(((e.clientX - r.left) / r.width - 0.5) * 9); rx(-((e.clientY - r.top) / r.height - 0.5) * 9); };
        const leave = () => { rx(0); ry(0); };
        el.addEventListener('pointermove', move); el.addEventListener('pointerleave', leave);
        cleanups.push(() => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); });
      });
      return () => cleanups.forEach((f) => f());
    });

    // Reduced motion (or anything else): show everything immediately.
    mm.add('(prefers-reduced-motion: reduce)', () => { root.classList.remove('motion-pending'); });

    // Cursor spotlight works for everyone (no motion, just light); CSS variables on the hovered element.
    const spot = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>('[data-spotlight]');
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    document.addEventListener('pointermove', spot, { passive: true });
    return () => { document.removeEventListener('pointermove', spot); mm.revert(); };
  }, { dependencies: [pathname], revertOnUpdate: true });

  return null;
}
