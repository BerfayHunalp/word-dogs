// ============================================================
// i18n — Multi-language support
// "I'm legally obligated to say EXPLOSIONS!" — Mr. Torgue (in every language)
// ============================================================

import type { LanguageConfig } from '../game/types';

// ==================== LANGUAGE CONFIGS ====================

export const LANGUAGES: Record<string, LanguageConfig> = {
  fr: {
    code: 'fr',
    name: 'Français',
    vowels: ['A', 'E', 'I', 'O', 'U'],
    letterWeights: {
      E: 1210, A: 711, I: 659, S: 651, N: 639, R: 607, T: 592,
      O: 502, L: 496, U: 449, D: 367, C: 318, M: 262, P: 249,
      G: 123, B: 114, V: 111, H: 111, F: 111, Q: 65,
      Y: 46, X: 38, J: 34, K: 29, W: 17, Z: 15,
    },
    letterPoints: {
      A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1,
      J: 8, K: 10, L: 1, M: 2, N: 1, O: 1, P: 3, Q: 8, R: 1,
      S: 1, T: 1, U: 1, V: 4, W: 10, X: 10, Y: 10, Z: 10,
    },
    dictionaryUrl: 'https://raw.githubusercontent.com/words/an-array-of-french-words/master/index.json',
    localDictPath: '/src/data/dictionaries/fr.json',
  },
  en: {
    code: 'en',
    name: 'English',
    vowels: ['A', 'E', 'I', 'O', 'U'],
    letterWeights: {
      E: 1270, T: 906, A: 817, O: 751, I: 697, N: 675, S: 633,
      H: 609, R: 599, D: 425, L: 403, C: 278, U: 276, M: 241,
      W: 236, F: 223, G: 202, Y: 197, P: 193, B: 129,
      V: 98, K: 77, J: 15, X: 15, Q: 10, Z: 7,
    },
    letterPoints: {
      A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1,
      J: 8, K: 5, L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1,
      S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10,
    },
    dictionaryUrl: 'https://raw.githubusercontent.com/words/an-array-of-english-words/master/index.json',
    localDictPath: '/src/data/dictionaries/en.json',
  },
};

// ==================== UI TRANSLATIONS ====================

const translations: Record<string, Record<string, string>> = {
  fr: {
    title: 'WARDOGS',
    subtitle: 'Forge des mots. Domine le seau.',
    play: 'JOUER',
    retry: 'REJOUER',
    menu: 'MENU',
    profile: 'MON PROFIL',
    login: 'Connexion',
    signup: 'Inscription',
    loginBtn: 'SE CONNECTER',
    signupBtn: "S'INSCRIRE",
    skipAuth: 'Jouer sans compte',
    noAccount: 'Pas de compte ?',
    createAccount: 'Créer un compte',
    hasAccount: 'Déjà un compte ?',
    loginLink: 'Se connecter',
    logout: 'Déconnexion',
    email: 'Email',
    password: 'Mot de passe',
    passwordHint: 'Mot de passe (6+ caractères)',
    username: "Nom d'utilisateur",
    highScore: 'Meilleur score',
    score: 'SCORE',
    level: 'NIVEAU',
    gameOver: 'GAME OVER',
    best: 'Meilleur',
    words: 'Mots',
    bestWord: 'Meilleur mot',
    profileTitle: 'Mon Profil',
    bestScore: 'Meilleur Score',
    gamesPlayed: 'Parties Jouées',
    wordsFound: 'Mots Trouvés',
    history: 'Historique',
    back: 'RETOUR',
    loading: 'Chargement...',
    noGames: 'Aucune partie jouée',
    historyFail: "Impossible de charger l'historique",
    wordsUnit: 'mots',
    combo: 'COMBO',
    multiplayer: 'MULTIJOUEUR',
    findMatch: 'TROUVER UN MATCH',
    waiting: 'En attente...',
    vs: 'VS',
    youWin: 'VICTOIRE !',
    youLose: 'DÉFAITE',
    language: 'Langue',
    replay: 'REVOIR',
  },
  en: {
    title: 'WARDOGS',
    subtitle: 'Forge words. Dominate the bucket.',
    play: 'PLAY',
    retry: 'RETRY',
    menu: 'MENU',
    profile: 'MY PROFILE',
    login: 'Login',
    signup: 'Sign Up',
    loginBtn: 'LOG IN',
    signupBtn: 'SIGN UP',
    skipAuth: 'Play as guest',
    noAccount: 'No account?',
    createAccount: 'Create one',
    hasAccount: 'Already have an account?',
    loginLink: 'Log in',
    logout: 'Logout',
    email: 'Email',
    password: 'Password',
    passwordHint: 'Password (6+ characters)',
    username: 'Username',
    highScore: 'High score',
    score: 'SCORE',
    level: 'LEVEL',
    gameOver: 'GAME OVER',
    best: 'Best',
    words: 'Words',
    bestWord: 'Best word',
    profileTitle: 'My Profile',
    bestScore: 'Best Score',
    gamesPlayed: 'Games Played',
    wordsFound: 'Words Found',
    history: 'History',
    back: 'BACK',
    loading: 'Loading...',
    noGames: 'No games played',
    historyFail: 'Failed to load history',
    wordsUnit: 'words',
    combo: 'COMBO',
    multiplayer: 'MULTIPLAYER',
    findMatch: 'FIND MATCH',
    waiting: 'Waiting...',
    vs: 'VS',
    youWin: 'YOU WIN!',
    youLose: 'DEFEAT',
    language: 'Language',
    replay: 'REPLAY',
  },
};

// ==================== STATE ====================

let currentLang = localStorage.getItem('wardogs_lang') || 'fr';

export function getLang(): string {
  return currentLang;
}

export function setLang(code: string) {
  if (LANGUAGES[code]) {
    currentLang = code;
    localStorage.setItem('wardogs_lang', code);
  }
}

export function t(key: string): string {
  return translations[currentLang]?.[key] ?? translations.fr[key] ?? key;
}

export function getLangConfig(): LanguageConfig {
  return LANGUAGES[currentLang] || LANGUAGES.fr;
}
