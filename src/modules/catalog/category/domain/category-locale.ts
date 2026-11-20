export const CATEGORY_SUPPORTED_LOCALES = ['vi', 'en', 'th', 'ja', 'ko', 'zh-CN', 'fr', 'de', 'es'] as const;

export type CategoryLocale = (typeof CATEGORY_SUPPORTED_LOCALES)[number];

export function isCategoryLocale(locale: string): locale is CategoryLocale {
  return (CATEGORY_SUPPORTED_LOCALES as readonly string[]).includes(locale);
}
