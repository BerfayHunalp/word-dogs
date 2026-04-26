// Download complete word lists for FR and EN, write into src/data/dictionaries.
// Uses the same public sources the runtime falls back to.

import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../public/dictionaries');

const SOURCES = [
  { code: 'fr', url: 'https://raw.githubusercontent.com/words/an-array-of-french-words/master/index.json' },
  { code: 'en', url: 'https://raw.githubusercontent.com/words/an-array-of-english-words/master/index.json' },
];

async function fetchOne({ code, url }) {
  process.stdout.write(`fetching ${code}... `);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${code}: HTTP ${res.status}`);
  const words = await res.json();
  if (!Array.isArray(words)) throw new Error(`${code}: not an array`);

  // Pre-filter to playable words (2..8 chars, a-z only after deburr) to keep file lean.
  const cleaned = [];
  for (const raw of words) {
    if (typeof raw !== 'string') continue;
    const w = raw.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (w.length < 2 || w.length > 8) continue;
    if (!/^[a-z]+$/.test(w)) continue;
    cleaned.push(w);
  }
  // Deduplicate and sort
  const unique = [...new Set(cleaned)].sort();
  await writeFile(resolve(OUT_DIR, `${code}.json`), JSON.stringify(unique));
  console.log(`${unique.length} words -> ${code}.json`);
}

await mkdir(OUT_DIR, { recursive: true });
for (const s of SOURCES) {
  try { await fetchOne(s); }
  catch (e) { console.error(`FAILED ${s.code}:`, e.message); process.exitCode = 1; }
}
