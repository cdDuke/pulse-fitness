import './style.css';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { createI18n } from './i18n';
import { dict, goalMix, kcalPerMin, typeColor, type WorkoutType } from './lang';

gsap.registerPlugin(ScrollTrigger);

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s)!;
const $$ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => [...r.querySelectorAll<T>(s)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const i18n = createI18n({ dict });
const { t } = i18n;

/* ---------------- Smooth scroll ---------------- */
const lenis = new Lenis({ duration: 1.1, smoothWheel: !reduceMotion });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

$$<HTMLAnchorElement>('a[href^="#"]').forEach((a) =>
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href')!;
    const target = id === '#top' ? 0 : document.querySelector<HTMLElement>(id);
    if (target === null) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: -80 });
  })
);

const header = $('.header');
lenis.on('scroll', ({ scroll }: { scroll: number }) => header.classList.toggle('is-scrolled', scroll > 30));

/* ---------------- Live heart rate ---------------- */
let bpm = 128;
if (!reduceMotion) {
  setInterval(() => {
    bpm = Math.max(112, Math.min(146, bpm + Math.round((Math.random() - 0.5) * 6)));
    $$('.bpm').forEach((el) => (el.textContent = String(bpm)));
  }, 1100);
}

/* ---------------- Story: sticky phone, screens follow the text ---------------- */
const screens = $$('.story-screen');
const steps = $$('.step');
function showScreen(i: number) {
  screens.forEach((s, k) => s.classList.toggle('is-active', k === i));
  steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
}
steps.forEach((step, i) =>
  ScrollTrigger.create({
    trigger: step,
    start: 'top 60%',
    end: 'bottom 60%',
    onToggle: ({ isActive }) => isActive && showScreen(i),
  })
);
showScreen(0);

/* ---------------- Plan generator ---------------- */
const planner = $<HTMLFormElement>('.planner');
const weekEl = $('.week-plan');
const DAY_PATTERNS: Record<number, number[]> = { 2: [1, 4], 3: [0, 2, 4], 4: [0, 1, 3, 5], 5: [0, 1, 3, 4, 5], 6: [0, 1, 2, 3, 4, 5] };
const BASE_MIN: Record<WorkoutType, number> = { run: 30, strength: 40, hiit: 25, yoga: 35, mobility: 20, cycle: 45 };

type Day = { type: WorkoutType | 'rest'; min: number; intensity: number };

function buildWeek(goal: string, level: number, days: number): Day[] {
  const active = DAY_PATTERNS[days];
  let n = 0;
  return Array.from({ length: 7 }, (_, d) => {
    if (!active.includes(d)) return { type: 'rest', min: 0, intensity: 0 };
    const type = goalMix[goal][n % goalMix[goal].length];
    const min = Math.round((BASE_MIN[type] * (0.7 + 0.2 * level)) / 5) * 5;
    const intensity = type === 'hiit' ? Math.min(3, level + 1) : Math.max(1, level - (n % 2));
    n++;
    return { type, min, intensity };
  });
}

let firstRender = true;
function renderPlan() {
  const data = new FormData(planner);
  const goal = String(data.get('goal'));
  const level = Number(data.get('level'));
  const days = Number(data.get('days'));
  $('#days-out').textContent = String(days);

  const week = buildWeek(goal, level, days);
  const names = t('days.short').split(',');
  weekEl.innerHTML = week
    .map((d, i) =>
      d.type === 'rest'
        ? `<li class="wd wd--rest"><b>${names[i]}</b><span>${t('w.type.rest')}</span></li>`
        : `<li class="wd" style="--c:${typeColor[d.type]}">
            <b>${names[i]}</b>
            <strong>${t(`w.type.${d.type}`)}</strong>
            <span>${d.min} ${t('min')} · ${t(`w.int.${d.intensity}`)}</span>
            <i class="wd__bar" style="--k:${d.min / 70}"></i>
          </li>`
    )
    .join('');

  const total = week.reduce((s, d) => s + d.min, 0);
  const kcal = week.reduce((s, d) => s + (d.type === 'rest' ? 0 : d.min * kcalPerMin[d.type] * (0.8 + 0.15 * level)), 0);
  const h = Math.floor(total / 60);
  $('#sum-time').textContent = !h ? t('sum.m', { m: total }) : total % 60 ? t('sum.h', { h, m: total % 60 }) : t('sum.hOnly', { h });
  $('#sum-kcal').textContent = t('sum.k', { k: Math.round(kcal / 10) * 10 });
  $('#sum-focus').textContent = t(`focus.${goal}`);

  if (!reduceMotion && !firstRender) {
    gsap.from($$('.wd', weekEl), { y: 16, opacity: 0, duration: 0.45, stagger: 0.04, ease: 'power3.out' });
  }
  firstRender = false;
}
planner.addEventListener('input', renderPlan);
renderPlan();

/* ---------------- Pricing ---------------- */
const priceEl = $('.price__value');
const money = (n: number) => new Intl.NumberFormat(i18n.locale(), { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(n);
function renderPrice(animate = false) {
  const period = (document.querySelector<HTMLInputElement>('input[name="billing"]:checked')?.value ?? 'm') as 'm' | 'y';
  const target = Number(priceEl.dataset[period]);
  if (!animate || reduceMotion) {
    priceEl.textContent = money(target);
    priceEl.dataset.current = String(target);
    return;
  }
  const obj = { v: Number(priceEl.dataset.current ?? target) };
  priceEl.dataset.current = String(target);
  gsap.to(obj, { v: target, duration: 0.6, ease: 'power2.out', onUpdate: () => (priceEl.textContent = money(Math.round(obj.v))) });
}
$$<HTMLInputElement>('input[name="billing"]').forEach((r) => r.addEventListener('change', () => renderPrice(true)));
renderPrice();

/* ---------------- Counters ---------------- */
const counters = $$('[data-count]').map((el) => ({
  el,
  to: Number(el.dataset.count),
  dec: Number(el.dataset.decimals ?? 0),
  suffix: el.dataset.suffix ?? '',
  v: 0,
}));
const writeCounter = (c: (typeof counters)[number]) => {
  const suffix = i18n.lang === 'ru' ? ({ M: ' млн', '%': '%' } as Record<string, string>)[c.suffix] ?? c.suffix : c.suffix;
  c.el.textContent = c.v.toLocaleString(i18n.locale(), { minimumFractionDigits: c.dec, maximumFractionDigits: c.dec }) + suffix;
};
counters.forEach((c) => {
  if (reduceMotion) {
    c.v = c.to;
    return writeCounter(c);
  }
  ScrollTrigger.create({ trigger: c.el, start: 'top 90%', once: true, onEnter: () => gsap.to(c, { v: c.to, duration: 2, ease: 'power3.out', onUpdate: () => writeCounter(c) }) });
});

/* ---------------- Language change ---------------- */
i18n.onChange(() => {
  renderPlan();
  renderPrice();
  counters.forEach(writeCounter);
  ScrollTrigger.refresh();
});

/* ---------------- Motion ---------------- */
if (!reduceMotion) {
  gsap
    .timeline({ defaults: { ease: 'expo.out' } })
    .from('.hero .kicker', { y: 20, opacity: 0, duration: 0.8 })
    .from('.hl', { yPercent: 60, opacity: 0, skewY: 6, duration: 1.1, stagger: 0.1 }, '-=0.5')
    .from('.hero__lead, .stores, .hero__rating', { y: 24, opacity: 0, duration: 0.9, stagger: 0.08 }, '-=0.7')
    .from('.hero .phone', { y: 120, rotate: 8, opacity: 0, duration: 1.4 }, 0.2)
    .from('.blob', { scale: 0.4, opacity: 0, duration: 1.6 }, 0.1)
    .from('.widget', { scale: 0.6, opacity: 0, duration: 0.9, stagger: 0.15, ease: 'back.out(1.8)' }, 0.9);

  // floating widgets
  $$('.widget').forEach((w, i) => gsap.to(w, { y: i % 2 ? 10 : -10, duration: 2.6 + i * 0.4, repeat: -1, yoyo: true, ease: 'sine.inOut' }));

  // hero phone tilts away while scrolling past
  gsap.to('.hero .phone', { rotate: -6, yPercent: 10, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

  $$('.h2').forEach((el) => gsap.from(el, { y: 40, opacity: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%' } }));
  ScrollTrigger.batch('.feature, .price, details', {
    start: 'top 90%',
    once: true,
    onEnter: (els) => gsap.from(els, { y: 40, opacity: 0, duration: 0.8, stagger: 0.08, ease: 'expo.out' }),
  });
  gsap.from('.final__title', { scale: 0.9, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.final', start: 'top 80%' } });
}

addEventListener('load', () => ScrollTrigger.refresh());
