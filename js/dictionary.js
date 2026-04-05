const DICT_URL = './data/words.json';

let wordSet = null;
let prefixSet2 = null;
let prefixSet3 = null;

function normalize(word) {
    return word.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export async function loadDictionary() {
    try {
        const res = await fetch(DICT_URL);
        const words = await res.json();

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
        return true;
    } catch (err) {
        console.error('Failed to load dictionary:', err);
        // Fallback: small embedded set of common French words
        wordSet = new Set([
            'le', 'la', 'de', 'et', 'en', 'un', 'une', 'du', 'au', 'les',
            'des', 'est', 'que', 'pas', 'sur', 'son', 'par', 'qui', 'avec',
            'pour', 'dans', 'plus', 'tout', 'mais', 'fait', 'bien', 'dire',
            'elle', 'lui', 'nous', 'vous', 'leur', 'etre', 'avoir', 'faire',
            'comme', 'meme', 'aussi', 'entre', 'autre', 'tous', 'peut',
            'mot', 'eau', 'feu', 'jeu', 'lieu', 'peu', 'veu', 'ami',
            'art', 'bas', 'but', 'car', 'cas', 'ces', 'cet', 'don',
            'dos', 'dur', 'fin', 'foi', 'gaz', 'gel', 'gre', 'gros',
            'haut', 'hier', 'ici', 'joli', 'jour', 'loin', 'long',
            'main', 'mal', 'mer', 'mis', 'mode', 'mort', 'neuf',
            'noir', 'nord', 'note', 'nuit', 'or', 'os', 'pain',
            'paix', 'part', 'peau', 'pere', 'pied', 'plan', 'pont',
            'port', 'prix', 'quoi', 'rare', 'rien', 'roi', 'rose',
            'sang', 'sauf', 'sel', 'seul', 'soir', 'sol', 'sort',
            'sud', 'suis', 'sur', 'taux', 'tel', 'tete', 'toi',
            'ton', 'tour', 'tres', 'trop', 'type', 'vent', 'vers',
            'vide', 'vie', 'vieux', 'ville', 'vin', 'voir', 'voix',
            'vol', 'vrai', 'vue', 'zone', 'aide', 'air', 'an',
            'age', 'arme', 'avis', 'banc', 'beau', 'bois', 'bord',
            'bout', 'bras', 'cafe', 'camp', 'chef', 'chez', 'ciel',
            'cinq', 'club', 'code', 'coin', 'coin', 'coup', 'cour',
            'dame', 'dent', 'deux', 'dieu', 'dix', 'doit', 'doux',
            'droit', 'etat', 'face', 'fer', 'fete', 'film', 'fils',
            'fond', 'fort', 'fou', 'gens', 'gout', 'gris', 'gros',
            'guerre', 'habit', 'herbe', 'homme', 'idee', 'image',
            'ile', 'jeune', 'joie', 'jouer', 'libre', 'ligne',
            'lion', 'lit', 'loi', 'lourd', 'lune', 'mains',
            'maison', 'marche', 'masse', 'midi', 'mine', 'monde',
            'mur', 'nature', 'neige', 'nom', 'nombre', 'ouest',
            'ombre', 'onde', 'oeil', 'ordre', 'page', 'palais',
            'papa', 'pays', 'peine', 'petit', 'piece', 'pierre',
            'place', 'plein', 'poids', 'point', 'porte', 'poste',
            'prince', 'propre', 'puis', 'reine', 'reste', 'riche',
            'route', 'rue', 'sable', 'scene', 'sens', 'six',
            'table', 'temps', 'terre', 'titre', 'trois', 'usage',
            'vaste', 'ventre', 'verre', 'wagon', 'lame', 'dame',
            'rame', 'ame', 'arme', 'ferme', 'terme', 'forme',
            'norme', 'larme', 'charme', 'calme'
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
    return wordSet.has(str.toLowerCase());
}

export function isValidPrefix(str) {
    if (!prefixSet2 || !prefixSet3) return true; // be optimistic if not loaded
    const s = str.toLowerCase();
    if (s.length <= 1) return true;
    if (s.length === 2) return prefixSet2.has(s);
    return prefixSet3.has(s.slice(0, 3));
}

export function isDictionaryReady() {
    return wordSet !== null;
}
