import messages from './locales.json' with { type: 'json' };

export const locales = ['zh-Hans', 'zh-Hant', 'en'];
export function resolveLocale(languages = []) {
  for (const language of languages) {
    const tag = String(language).toLowerCase();
    if (tag.startsWith('zh')) {
      if (/(?:^|-)hans(?:-|$)/.test(tag)) return 'zh-Hans';
      return /(?:^|-)(?:hant|tw|hk|mo)(?:-|$)/.test(tag) ? 'zh-Hant' : 'zh-Hans';
    }
    if (tag.startsWith('en')) return 'en';
  }
  return 'en';
}
let locale = resolveLocale(globalThis.navigator?.languages?.length ? globalThis.navigator.languages : [globalThis.navigator?.language]);
export function setLocale(language) { locale = resolveLocale(Array.isArray(language) ? language : [language]); }
export function getLocale() { return locale; }
export function tr(key, values = {}) {
  const text = locale === 'zh-Hans' ? key : messages[key]?.[locale === 'en' ? 0 : 1] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(values, name) ? String(values[name]) : match);
}
export { messages };
