/**
 * Tiny i18n helper.
 * English lives in the HTML itself (read from the DOM on start),
 * other languages come from a dictionary. Elements opt in with:
 *   data-i18n="key"                 → innerHTML
 *   data-i18n-attr="attr:key;..."   → attributes (placeholder, aria-label…)
 */
export type Lang = 'ru' | 'en';
export type Dict = Partial<Record<Lang, Record<string, string>>>;

const STORAGE_KEY = 'lang';
const SUPPORTED: Lang[] = ['ru', 'en'];

export function createI18n({ dict, fallback = 'en', defaultLang = 'ru' }: { dict: Dict; fallback?: Lang; defaultLang?: Lang }) {
  const base: Record<string, string> = {};
  const textNodes = [...document.querySelectorAll<HTMLElement>('[data-i18n]')];
  const attrNodes = [...document.querySelectorAll<HTMLElement>('[data-i18n-attr]')];
  const pairs = (el: HTMLElement) => el.dataset.i18nAttr!.split(';').map((p) => p.split(':') as [string, string]);

  textNodes.forEach((el) => (base[el.dataset.i18n!] = el.innerHTML.trim()));
  attrNodes.forEach((el) => pairs(el).forEach(([attr, key]) => (base[key] = el.getAttribute(attr) ?? '')));
  base['meta.title'] = document.title;
  base['meta.desc'] = document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? '';

  const dicts: Dict = { ...dict, [fallback]: { ...base, ...(dict[fallback] ?? {}) } };
  const listeners = new Set<(lang: Lang) => void>();

  let lang: Lang = defaultLang;
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (saved && SUPPORTED.includes(saved)) lang = saved;
  } catch {
    /* storage blocked — use default */
  }

  const t = (key: string, vars: Record<string, string | number> = {}) => {
    const str = dicts[lang]?.[key] ?? dicts[fallback]?.[key] ?? key;
    return str.replace(/\{(\w+)\}/g, (_, v: string) => String(vars[v] ?? ''));
  };

  function apply() {
    document.documentElement.lang = lang;
    textNodes.forEach((el) => (el.innerHTML = t(el.dataset.i18n!)));
    attrNodes.forEach((el) => pairs(el).forEach(([attr, key]) => el.setAttribute(attr, t(key))));
    document.title = t('meta.title');
    document.querySelector('meta[name="description"]')?.setAttribute('content', t('meta.desc'));
    document.querySelectorAll<HTMLElement>('[data-lang-btn]').forEach((b) => {
      const active = b.dataset.langBtn === lang;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', String(active));
    });
  }

  function set(next: Lang) {
    if (!SUPPORTED.includes(next) || next === lang) return;
    lang = next;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
    apply();
    listeners.forEach((fn) => fn(lang));
  }

  document
    .querySelectorAll<HTMLElement>('[data-lang-btn]')
    .forEach((b) => b.addEventListener('click', () => set(b.dataset.langBtn as Lang)));

  apply();

  return {
    t,
    set,
    get lang() {
      return lang;
    },
    locale: () => (lang === 'ru' ? 'ru-RU' : 'en-US'),
    onChange: (fn: (lang: Lang) => void) => listeners.add(fn),
  };
}
