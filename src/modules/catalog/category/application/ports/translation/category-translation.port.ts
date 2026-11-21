export const CATEGORY_TRANSLATION_PORT = Symbol('CATEGORY_TRANSLATION_PORT');

export interface CategoryTranslationPort {
  readonly enabled: boolean;
  translate(name: string, targetLocale?: string): Promise<string>;
}
