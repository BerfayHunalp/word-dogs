import { describe, it, expect, beforeEach } from 'vitest';
import { setLang } from '../i18n';
import { getLetterPoints, calculateWordScore } from '../game/scoring';
import type { Ball } from '../game/types';

// Helper to build a minimal Ball for scoring tests
function makeBall(letter: string, special: Ball['special'] = null, powerUp: Ball['powerUp'] = null): Ball {
  return {
    id: 0,
    body: { position: { x: 0, y: 0 } } as Ball['body'],
    letter,
    radius: 20,
    special,
    popping: 0,
    powerUp,
  };
}

describe('scoring', () => {
  beforeEach(() => {
    setLang('fr');
  });

  describe('getLetterPoints', () => {
    it('returns correct French Scrabble values', () => {
      expect(getLetterPoints('A')).toBe(1);
      expect(getLetterPoints('E')).toBe(1);
      expect(getLetterPoints('J')).toBe(8);
      expect(getLetterPoints('Z')).toBe(10);
      expect(getLetterPoints('K')).toBe(10);
    });

    it('is case-insensitive', () => {
      expect(getLetterPoints('a')).toBe(getLetterPoints('A'));
      expect(getLetterPoints('z')).toBe(getLetterPoints('Z'));
    });

    it('returns 0 for unknown characters', () => {
      expect(getLetterPoints('!')).toBe(0);
      expect(getLetterPoints('1')).toBe(0);
    });

    it('uses English points when language is set to EN', () => {
      setLang('en');
      expect(getLetterPoints('K')).toBe(5); // EN: 5, FR: 10
      expect(getLetterPoints('W')).toBe(4); // EN: 4, FR: 10
    });
  });

  describe('calculateWordScore', () => {
    it('sums base letter points for a 3-letter word (no bonus)', () => {
      // E=1, A=1, U=1 => base=3, len 3 => mult 1, combo 0 => 1
      const path = [makeBall('E'), makeBall('A'), makeBall('U')];
      expect(calculateWordScore(path, 0)).toBe(3);
    });

    it('applies 2x special multiplier to individual letter', () => {
      // E=1 (2x=2), A=1, U=1 => base=4
      const path = [makeBall('E', '2x'), makeBall('A'), makeBall('U')];
      expect(calculateWordScore(path, 0)).toBe(4);
    });

    it('applies 3x special multiplier to individual letter', () => {
      // E=1 (3x=3), A=1, U=1 => base=5
      const path = [makeBall('E', '3x'), makeBall('A'), makeBall('U')];
      expect(calculateWordScore(path, 0)).toBe(5);
    });

    it('applies 1.25x length bonus for 5-6 letter words', () => {
      // 5 letters all worth 1: base=5, mult=1.25 => 6.25 => round to 6
      const path = Array.from('EAIOU', l => makeBall(l));
      expect(calculateWordScore(path, 0)).toBe(6);
    });

    it('applies 1.5x length bonus for 7+ letter words', () => {
      // 7 letters all worth 1: base=7, mult=1.5 => 10.5 => round to 11
      const path = Array.from('EAIOUNE', l => makeBall(l));
      expect(calculateWordScore(path, 0)).toBe(11);
    });

    it('applies combo bonus (+10% per combo)', () => {
      const path = [makeBall('E'), makeBall('A'), makeBall('U')];
      // combo 3 => comboMult = 1 + 3*0.1 = 1.3, base=3 => 3*1*1.3 = 3.9 => 4
      expect(calculateWordScore(path, 3)).toBe(4);
    });

    it('applies double power-up (2x final)', () => {
      const path = [makeBall('E', null, 'double'), makeBall('A'), makeBall('U')];
      // base=3, no length bonus, no combo, powerMult=2 => 6
      expect(calculateWordScore(path, 0)).toBe(6);
    });

    it('stacks all multipliers together', () => {
      // 5 letters: J=8(3x=24), E=1, A=1, U=1, I=1 with double power-up on one ball
      // base = 24+1+1+1+1 = 28
      // length 5 => mult 1.25
      // combo 2 => comboMult 1.2
      // double => powerMult 2
      // total = round(28 * 1.25 * 1.2 * 2) = round(84) = 84
      const path = [
        makeBall('J', '3x'),
        makeBall('E'),
        makeBall('A', null, 'double'),
        makeBall('U'),
        makeBall('I'),
      ];
      expect(calculateWordScore(path, 2)).toBe(84);
    });

    it('returns 0 for empty path', () => {
      expect(calculateWordScore([], 0)).toBe(0);
    });
  });
});
