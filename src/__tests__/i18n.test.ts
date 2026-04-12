import { describe, it, expect, beforeEach } from 'vitest';
import { getLang, setLang, t, getLangConfig, LANGUAGES } from '../i18n';

describe('i18n', () => {
  beforeEach(() => {
    setLang('fr');
  });

  describe('getLang / setLang', () => {
    it('defaults to fr', () => {
      expect(getLang()).toBe('fr');
    });

    it('switches to en', () => {
      setLang('en');
      expect(getLang()).toBe('en');
    });

    it('ignores invalid language codes', () => {
      setLang('xx');
      expect(getLang()).toBe('fr');
    });

    it('persists language to localStorage', () => {
      setLang('en');
      expect(localStorage.getItem('wardogs_lang')).toBe('en');
    });
  });

  describe('t (translations)', () => {
    it('returns French translations by default', () => {
      expect(t('play')).toBe('JOUER');
      expect(t('title')).toBe('WARDOGS');
      expect(t('gameOver')).toBe('GAME OVER');
    });

    it('returns English translations after switching', () => {
      setLang('en');
      expect(t('play')).toBe('PLAY');
      expect(t('retry')).toBe('RETRY');
    });

    it('returns the key itself for unknown translation keys', () => {
      expect(t('nonexistent_key_xyz')).toBe('nonexistent_key_xyz');
    });

    it('covers all expected translation keys', () => {
      const expectedKeys = [
        'title', 'subtitle', 'play', 'retry', 'menu', 'profile',
        'login', 'signup', 'loginBtn', 'signupBtn', 'skipAuth',
        'score', 'level', 'gameOver', 'best', 'words', 'bestWord',
        'multiplayer', 'findMatch', 'waiting', 'back', 'language',
      ];
      for (const key of expectedKeys) {
        const val = t(key);
        expect(val).not.toBe(key); // Should have a real translation
        expect(val.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getLangConfig', () => {
    it('returns French config by default', () => {
      const config = getLangConfig();
      expect(config.code).toBe('fr');
      expect(config.name).toBe('Fran\u00e7ais');
      expect(config.vowels).toEqual(['A', 'E', 'I', 'O', 'U']);
    });

    it('returns English config after switching', () => {
      setLang('en');
      const config = getLangConfig();
      expect(config.code).toBe('en');
      expect(config.name).toBe('English');
    });

    it('has letter weights for all 26 letters', () => {
      const config = getLangConfig();
      expect(Object.keys(config.letterWeights).length).toBe(26);
    });

    it('has letter points for all 26 letters', () => {
      const config = getLangConfig();
      expect(Object.keys(config.letterPoints).length).toBe(26);
    });

    it('letter weights are all positive', () => {
      for (const langCode of Object.keys(LANGUAGES)) {
        setLang(langCode);
        const config = getLangConfig();
        for (const [, weight] of Object.entries(config.letterWeights)) {
          expect(weight).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('LANGUAGES', () => {
    it('has fr and en configs', () => {
      expect(LANGUAGES.fr).toBeDefined();
      expect(LANGUAGES.en).toBeDefined();
    });

    it('each language has a valid dictionary URL', () => {
      for (const config of Object.values(LANGUAGES)) {
        expect(config.dictionaryUrl).toMatch(/^https:\/\//);
      }
    });
  });
});
