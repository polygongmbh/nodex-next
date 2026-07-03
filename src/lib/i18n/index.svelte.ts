import en from "./en";
import de from "./de";

export type Locale = "en" | "de";

const STORAGE_KEY = "nodex-next.locale";
const dictionaries: Record<Locale, Record<string, string>> = { en, de };

function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "de") return stored;
  } catch {
    // No storage (tests, private mode) — fall through to navigator.
  }
  if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("de")) {
    return "de";
  }
  return "en";
}

class I18nStore {
  locale = $state<Locale>(detectLocale());

  setLocale(locale: Locale): void {
    this.locale = locale;
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // Session-only.
    }
  }
}

export const i18n = new I18nStore();

/**
 * Translate a key with {param} interpolation. Unknown keys pass through
 * verbatim — so raw server messages can be fed through t() safely.
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const template = dictionaries[i18n.locale][key] ?? dictionaries.en[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole
  );
}
