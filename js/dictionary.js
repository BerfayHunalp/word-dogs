// Primary: large French dictionary from GitHub (~336K words)
// Fallback: local data/words.json
const REMOTE_DICT_URL = 'https://raw.githubusercontent.com/words/an-array-of-french-words/master/index.json';
const LOCAL_DICT_URL = './data/words.json';

let wordSet = null;
let prefixSet2 = null;
let prefixSet3 = null;

function normalize(word) {
    return word.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function buildSets(words) {
    wordSet = new Set();
    prefixSet2 = new Set();
    prefixSet3 = new Set();

    for (const raw of words) {
        const w = normalize(raw);
        // Filter: 2-8 chars, only letters, no hyphens/apostrophes
        if (w.length < 2 || w.length > 8) continue;
        if (!/^[a-z]+$/.test(w)) continue;

        wordSet.add(w);
        if (w.length >= 2) prefixSet2.add(w.slice(0, 2));
        if (w.length >= 3) prefixSet3.add(w.slice(0, 3));
    }

    console.log(`Dictionary loaded: ${wordSet.size} words`);
}

export async function loadDictionary() {
    // Try remote (big dictionary) first, fallback to local
    try {
        const res = await fetch(REMOTE_DICT_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const words = await res.json();
        buildSets(words);
        return true;
    } catch (err) {
        console.warn('Remote dictionary failed, trying local:', err.message);
    }

    try {
        const res = await fetch(LOCAL_DICT_URL);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const words = await res.json();
        buildSets(words);
        return true;
    } catch (err) {
        console.error('Local dictionary also failed:', err);
        // Minimal fallback
        wordSet = new Set([
            'le','la','de','et','en','un','une','du','au','les','des','est',
            'que','pas','sur','son','par','qui','pour','dans','plus','tout',
            'mais','fait','bien','elle','lui','nous','vous','mot','eau','feu',
            'jeu','ami','art','bas','but','car','cas','don','dos','dur','fin',
            'foi','gaz','gel','gros','haut','ici','joli','jour','loin','long',
            'main','mal','mer','mode','mort','neuf','noir','nord','note','nuit',
            'or','os','pain','part','peau','pere','pied','plan','pont','port',
            'prix','rare','rien','roi','rose','sang','sel','seul','soir','sol',
            'sort','sud','tel','toi','ton','tour','tres','trop','type','vent',
            'vers','vide','vie','vin','voir','voix','vol','vrai','vue','zone',
            'cout','coup','cou','cour','bout','tout','nous','vous','sous','doux'
        ]);
        prefixSet2 = new Set();
        prefixSet3 = new Set();
        for (const w of wordSet) {
            if (w.length >= 2) prefixSet2.add(w.slice(0, 2));
            if (w.length >= 3) prefixSet3.add(w.slice(0, 3));
        }
        return true;
    }
}

export function isWord(str) {
    if (!wordSet) return false;
    return wordSet.has(normalize(str));
}

export function isValidPrefix(str) {
    if (!prefixSet2 || !prefixSet3) return true;
    const s = normalize(str);
    if (s.length <= 1) return true;
    if (s.length === 2) return prefixSet2.has(s);
    return prefixSet3.has(s.slice(0, 3));
}

export function isDictionaryReady() {
    return wordSet !== null;
}
