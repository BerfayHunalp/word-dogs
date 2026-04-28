// ============================================================
// fakeName.ts — Believable opponent names for AI fallback when
// online matchmaking times out without finding a real player.
// ============================================================

const FR_FIRST = [
  'Léo', 'Hugo', 'Mathis', 'Théo', 'Lucas', 'Nathan', 'Antoine', 'Maxime',
  'Julien', 'Romain', 'Clément', 'Adrien', 'Sophie', 'Marie', 'Emma',
  'Camille', 'Manon', 'Chloé', 'Pauline', 'Sarah', 'Léa', 'Juliette',
];

const EN_FIRST = [
  'Alex', 'Jordan', 'Liam', 'Noah', 'Ethan', 'Ryan', 'Jake', 'Mason',
  'Dylan', 'Caleb', 'Owen', 'Lucas', 'Emma', 'Olivia', 'Ava', 'Mia',
  'Sophia', 'Chloe', 'Grace', 'Zoe', 'Lily', 'Hannah',
];

const SUFFIXES = ['', '', '_', '.', '_'];
const ENDINGS = ['', '', '42', '88', '99', '07', '21', '23', '_M', '_B', '77', '_K', '_FR', '_x'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateFakeOpponentName(lang: string): string {
  const pool = lang === 'en' ? EN_FIRST : FR_FIRST;
  const first = pick(pool);
  const sep = pick(SUFFIXES);
  const end = pick(ENDINGS);
  return `${first}${sep}${end}`;
}
