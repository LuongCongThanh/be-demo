import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Google Cloud Translation Basic v2. Never log the key, request text or provider response. */
@Injectable()
export class CategoryTranslationClient {
  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return Boolean(this.config.get<string>('GOOGLE_TRANSLATE_API_KEY')?.trim());
  }

  async translate(name: string): Promise<string> {
    const key = this.config.get<string>('GOOGLE_TRANSLATE_API_KEY');
    if (!key?.trim()) throw new Error('Category translation is not configured');
    const response = await fetch('https://translation.googleapis.com/language/translate/v2', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ q: name, source: 'vi', target: 'en', format: 'text' }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Translation provider returned HTTP ${response.status}`);
    const body: unknown = await response.json();
    const text = readTranslation(body);
    if (!text || text.length > 150) throw new Error('Translation provider returned an invalid category name');
    return text;
  }
}

function readTranslation(body: unknown): string | null {
  if (!body || typeof body !== 'object' || !('data' in body)) return null;
  const data = body.data;
  if (!data || typeof data !== 'object' || !('translations' in data) || !Array.isArray(data.translations)) return null;
  const first: unknown = data.translations[0];
  if (!first || typeof first !== 'object' || !('translatedText' in first) || typeof first.translatedText !== 'string')
    return null;
  const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  return first.translatedText
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (original, entity: string) => {
      if (!entity.startsWith('#')) return entities[entity.toLowerCase()] ?? original;
      const point = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
      return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
        ? String.fromCodePoint(point)
        : original;
    })
    .trim();
}
