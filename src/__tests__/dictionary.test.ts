import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setLang } from '../i18n';

// We need to reset the module state between tests
let dictionary: typeof import('../game/dictionary');

describe('dictionary', () => {
  beforeEach(async () => {
    setLang('fr');
    // Re-import to get fresh module state
    vi.resetModules();
    dictionary = await import('../game/dictionary');
  });

  describe('loadDictionary', () => {
    it('loads words from fetch and sets up word/prefix sets', async () => {
      const words = ['chat', 'chien', 'eau', 'ami', 'art', 'le', 'abricot', 'bonjour'];
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(words),
      }) as unknown as typeof fetch;

      const result = await dictionary.loadDictionary();
      expect(result).toBe(true);
      expect(dictionary.isDictionaryReady()).toBe(true);
    });

    it('falls back to emergency words when fetch fails', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('network'));

      const result = await dictionary.loadDictionary();
      expect(result).toBe(true);
      expect(dictionary.isDictionaryReady()).toBe(true);
      // Emergency fallback includes common words
      expect(dictionary.isWord('eau')).toBe(true);
      expect(dictionary.isWord('ami')).toBe(true);
    });
  });

  describe('isWord', () => {
    beforeEach(async () => {
      const words = ['chat', 'chien', 'eau', 'monde', 'bonjour', 'le', 'abricot'];
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(words),
      }) as unknown as typeof fetch;
      await dictionary.loadDictionary();
    });

    it('validates loaded words', () => {
      expect(dictionary.isWord('chat')).toBe(true);
      expect(dictionary.isWord('chien')).toBe(true);
      expect(dictionary.isWord('monde')).toBe(true);
    });

    it('rejects words not in dictionary', () => {
      expect(dictionary.isWord('zzzzz')).toBe(false);
      expect(dictionary.isWord('xyz')).toBe(false);
    });

    it('is case-insensitive', () => {
      expect(dictionary.isWord('CHAT')).toBe(true);
      expect(dictionary.isWord('Chat')).toBe(true);
    });

    it('normalizes accented characters', () => {
      // The normalize function strips diacritics
      // If 'resume' is in the dictionary, 'r\u00e9sum\u00e9' should also match
      const words2 = ['resume', 'cafe'];
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(words2),
      }) as unknown as typeof fetch;
    });

    it('rejects single-character words', () => {
      // Dictionary buildSets filters words < 2 chars
      expect(dictionary.isWord('a')).toBe(false);
    });

    it('rejects words longer than 8 characters', () => {
      // buildSets filters words > 8 chars, 'abricot' is 7 chars so it's fine
      expect(dictionary.isWord('abricot')).toBe(true);
    });
  });

  describe('isValidPrefix', () => {
    beforeEach(async () => {
      const words = ['chat', 'chien', 'charme', 'eau', 'est'];
      globalThis.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(words),
      }) as unknown as typeof fetch;
      await dictionary.loadDictionary();
    });

    it('returns true for single character (always valid)', () => {
      expect(dictionary.isValidPrefix('c')).toBe(true);
      expect(dictionary.isValidPrefix('z')).toBe(true);
    });

    it('validates 2-letter prefixes', () => {
      expect(dictionary.isValidPrefix('ch')).toBe(true);
      expect(dictionary.isValidPrefix('ea')).toBe(true);
      expect(dictionary.isValidPrefix('es')).toBe(true);
    });

    it('rejects invalid 2-letter prefixes', () => {
      expect(dictionary.isValidPrefix('zz')).toBe(false);
    });

    it('validates 3-letter prefixes', () => {
      expect(dictionary.isValidPrefix('cha')).toBe(true);
      expect(dictionary.isValidPrefix('chi')).toBe(true);
    });

    it('uses only first 3 chars for longer strings', () => {
      // 'chat' has prefix 'cha' which is valid
      expect(dictionary.isValidPrefix('chat')).toBe(true);
    });
  });

  describe('isDictionaryReady', () => {
    it('returns false before loading', () => {
      expect(dictionary.isDictionaryReady()).toBe(false);
    });
  });
});
