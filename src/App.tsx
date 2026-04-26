// ============================================================
// App.tsx — Root component, screen + mode management
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import SplashScreen from './components/SplashScreen';
import LangScreen from './components/LangScreen';
import AuthScreen from './components/AuthScreen';
import MenuScreen from './components/MenuScreen';
import ProfileScreen from './components/ProfileScreen';
import GameScreen from './components/GameScreen';
import GameOverScreen from './components/GameOverScreen';
import MultiplayerScreen from './components/MultiplayerScreen';
import { loadDictionary } from './game/dictionary';
import { loadSession, isLoggedIn } from './api/client';
import { getLang, setLang } from './i18n';
import { setDifficulty } from './game/engine';
import type { GameStats, Difficulty } from './game/types';

type Screen = 'splash' | 'lang' | 'auth' | 'menu' | 'game' | 'gameover' | 'profile' | 'multiplayer';
export type GameMode = 'solo' | 'ai' | 'localDuel' | 'online';

const LANG_PICKED_KEY = 'wardogs_lang_picked';
const DIFFICULTY_KEY = 'wardogs_difficulty';

function loadDifficulty(): Difficulty {
  const saved = localStorage.getItem(DIFFICULTY_KEY) as Difficulty | null;
  return saved && ['easy', 'normal', 'hard'].includes(saved) ? saved : 'normal';
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('splash');
  const [gameStats, setGameStats] = useState<GameStats | null>(null);
  const [lang, setLangState] = useState(getLang());
  const [mode, setMode] = useState<GameMode>('solo');
  const [seed, setSeed] = useState<number | undefined>();
  const [difficulty, setDifficultyState] = useState<Difficulty>(loadDifficulty());

  // Apply difficulty to engine on mount + on change
  useEffect(() => { setDifficulty(difficulty); }, [difficulty]);

  // Boot sequence
  useEffect(() => {
    loadSession();
    Promise.all([
      loadDictionary(),
      new Promise(r => setTimeout(r, 3000)),
    ]).then(() => {
      const langPicked = localStorage.getItem(LANG_PICKED_KEY) === '1';
      if (!langPicked) setScreen('lang');
      else setScreen(isLoggedIn() ? 'menu' : 'auth');
    });
  }, []);

  const handleLangPick = useCallback((code: string) => {
    setLang(code);
    setLangState(code);
    localStorage.setItem(LANG_PICKED_KEY, '1');
    loadDictionary().then(() => {
      setScreen(isLoggedIn() ? 'menu' : 'auth');
    });
  }, []);

  const changeLang = useCallback((code: string) => {
    setLang(code);
    setLangState(code);
    loadDictionary();
  }, []);

  const changeDifficulty = useCallback((d: Difficulty) => {
    setDifficultyState(d);
    setDifficulty(d);
    localStorage.setItem(DIFFICULTY_KEY, d);
  }, []);

  const handleGameOver = useCallback((stats: GameStats) => {
    setGameStats(stats);
    setSeed(undefined);
    setScreen('gameover');
  }, []);

  const startGame = useCallback((m: GameMode, s?: number) => {
    setMode(m);
    setSeed(s);
    setScreen('game');
  }, []);

  return (
    <>
      {screen === 'splash' && <SplashScreen />}
      {screen === 'lang' && <LangScreen onPick={handleLangPick} />}
      {screen === 'auth' && <AuthScreen onDone={() => setScreen('menu')} />}
      {screen === 'menu' && (
        <MenuScreen
          onModeSelect={(m) => {
            if (m === 'online') setScreen('multiplayer');
            else startGame(m);
          }}
          onProfile={() => setScreen('profile')}
          onLogout={() => setScreen('auth')}
          lang={lang}
          onLangChange={changeLang}
          difficulty={difficulty}
          onDifficultyChange={changeDifficulty}
        />
      )}
      {screen === 'profile' && <ProfileScreen onBack={() => setScreen('menu')} />}
      {screen === 'game' && (
        <GameScreen onGameOver={handleGameOver} seedOverride={seed} mode={mode} />
      )}
      {screen === 'gameover' && (
        <GameOverScreen
          stats={gameStats!}
          onRetry={() => startGame(mode)}
          onMenu={() => setScreen('menu')}
        />
      )}
      {screen === 'multiplayer' && (
        <MultiplayerScreen
          onGameStart={(s) => startGame('online', s)}
          onBack={() => setScreen('menu')}
        />
      )}
    </>
  );
}
