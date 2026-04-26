// ============================================================
// dictionary.ts — Word validation with multi-language support
// ============================================================

import { getLangConfig } from '../i18n';

let wordSet: Set<string> | null = null;
let prefixSet2: Set<string> | null = null;
let prefixSet3: Set<string> | null = null;
let wordsByLength: Map<number, string[]> = new Map();
let loadedLang = '';

function normalize(word: string): string {
  return word.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function buildSets(words: string[]) {
  wordSet = new Set();
  prefixSet2 = new Set();
  prefixSet3 = new Set();
  wordsByLength = new Map();

  for (const raw of words) {
    const w = normalize(raw);
    if (w.length < 2 || w.length > 8 || !/^[a-z]+$/.test(w)) continue;
    wordSet.add(w);
    if (w.length >= 2) prefixSet2.add(w.slice(0, 2));
    if (w.length >= 3) prefixSet3.add(w.slice(0, 3));
    let bucket = wordsByLength.get(w.length);
    if (!bucket) { bucket = []; wordsByLength.set(w.length, bucket); }
    bucket.push(w);
  }
  console.log(`Dictionary loaded: ${wordSet.size} words`);
}

// Bots: pull a random valid word in a length range, or null if none available.
export function getRandomWordOfLength(minLen: number, maxLen: number): string | null {
  const candidates: string[][] = [];
  for (let l = minLen; l <= maxLen; l++) {
    const bucket = wordsByLength.get(l);
    if (bucket && bucket.length > 0) candidates.push(bucket);
  }
  if (candidates.length === 0) return null;
  const bucket = candidates[Math.floor(Math.random() * candidates.length)];
  return bucket[Math.floor(Math.random() * bucket.length)];
}

export async function loadDictionary(): Promise<boolean> {
  const config = getLangConfig();
  if (loadedLang === config.code && wordSet) return true;

  // Try remote first, then local
  for (const url of [config.dictionaryUrl, config.localDictPath]) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const words: string[] = await res.json();
      buildSets(words);
      loadedLang = config.code;
      return true;
    } catch { /* try next */ }
  }

  // Emergency fallback — common French words
  wordSet = new Set(['le','la','de','et','en','un','une','du','au','les','des','est',
    'que','pas','sur','son','par','qui','pour','dans','plus','tout','mais','fait',
    'bien','elle','lui','nous','vous','mot','eau','feu','jeu','ami','art']);
  prefixSet2 = new Set(); prefixSet3 = new Set();
  for (const w of wordSet) {
    if (w.length >= 2) prefixSet2.add(w.slice(0, 2));
    if (w.length >= 3) prefixSet3.add(w.slice(0, 3));
  }
  loadedLang = config.code;
  return true;
}

export function isWord(str: string): boolean {
  return wordSet?.has(normalize(str)) ?? false;
}

export function isValidPrefix(str: string): boolean {
  const s = normalize(str);
  if (s.length <= 1) return true;
  if (s.length === 2) return prefixSet2?.has(s) ?? true;
  return prefixSet3?.has(s.slice(0, 3)) ?? true;
}

export function isDictionaryReady(): boolean {
  return wordSet !== null;
}
