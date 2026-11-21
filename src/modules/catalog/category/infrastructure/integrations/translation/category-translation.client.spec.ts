import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { CategoryTranslationClient } from '#src/modules/catalog/category/infrastructure/integrations/translation/category-translation.client.js';

const client = (key = 'test-key') =>
  new CategoryTranslationClient(new ConfigService({ GOOGLE_TRANSLATE_API_KEY: key }));
afterEach(() => vi.unstubAllGlobals());

describe('CategoryTranslationClient', () => {
  it('does not call Google without credentials', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(client('').enabled).toBe(false);
    await expect(client('').translate('Áo thun')).rejects.toThrow('not configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('requests Vietnamese to English plain text and decodes provider entities', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ data: { translations: [{ translatedText: 'Men&#39;s T-shirts &amp; tops' }] } }),
      );
    vi.stubGlobal('fetch', fetchMock);
    await expect(client().translate('Áo thun')).resolves.toBe("Men's T-shirts & tops");
    expect(fetchMock).toHaveBeenCalledWith(
      'https://translation.googleapis.com/language/translate/v2',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ q: 'Áo thun', source: 'vi', target: 'en', format: 'text' }),
        headers: { 'content-type': 'application/json', 'x-goog-api-key': 'test-key' },
      }),
    );
  });
  it.each([
    {},
    { data: { translations: [{ translatedText: '' }] } },
    { data: { translations: [{ translatedText: 'x'.repeat(151) }] } },
  ])('rejects invalid provider payloads', async (body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body)));
    await expect(client().translate('Áo thun')).rejects.toThrow('invalid category name');
  });
  it('does not expose a provider error response or credentials', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private provider payload', { status: 403 })));
    await expect(client().translate('Áo thun')).rejects.toThrow('Translation provider returned HTTP 403');
  });
});
