// ============================================================
// App.tsx — Root component, screen management
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import SplashScreen from './components/SplashScreen';
import AuthScreen from './components/AuthScreen';
import MenuScreen from './components/MenuScreen';
import ProfileScreen from './components/ProfileScreen';
import GameScreen from './components/GameScreen';
import GameOverScreen from './components/GameOverScreen';
import MultiplayerScreen from './components/MultiplayerScreen';
import { loadDictionary } from './game/dictionary';
import { loadSession, isLoggedIn } from './api/client';
import { getLang, setLang } from './i18n';
import type { GameStats } from './game/types';

type Screen = 'splash' | 'auth' | 'menu' | 'game' | 'gameover' | 'profile' | 'multiplayer';

export default function App() {
  const [screen, setScreen] = useState<Screen>('splash');
  const [gameStats, setGameStats] = useState<GameStats | null>(null);
  const [lang, setLangState] = useState(getLang());
  const [multiplayerSeed, setMultiplayerSeed] = useState<number | undefined>();

  // Boot sequence
  useEffect(() => {
    loadSession();
    Promise.all([
      loadDictionary(),
      new Promise(r => setTimeout(r, 3000)), // splash timer
    ]).then(() => {
      setScreen(isLoggedIn() ? 'menu' : 'auth');
    });
  }, []);

  const changeLang = useCallback((code: string) => {
    setLang(code);
    setLangState(code);
    // Reload dictionary for new language
    loadDictionary();
  }, []);

  const handleGameOver = useCallback((stats: GameStats) => {
    setGameStats(stats);
    setMultiplayerSeed(undefined);
    setScreen('gameover');
  }, []);

  const startGame = useCallback((seed?: number) => {
    setMultiplayerSeed(seed);
    setScreen('game');
  }, []);

  return (
    <>
      {screen === 'splash' && <SplashScreen />}
      {screen === 'auth' && <AuthScreen onDone={() => setScreen('menu')} />}
      {screen === 'menu' && (
        <MenuScreen
          onPlay={() => startGame()}
          onProfile={() => setScreen('profile')}
          onMultiplayer={() => setScreen('multiplayer')}
          onLogout={() => setScreen('auth')}
          lang={lang}
          onLangChange={changeLang}
        />
      )}
      {screen === 'profile' && <ProfileScreen onBack={() => setScreen('menu')} />}
      {screen === 'game' && <GameScreen onGameOver={handleGameOver} seedOverride={multiplayerSeed} />}
      {screen === 'gameover' && (
        <GameOverScreen
          stats={gameStats!}
          onRetry={() => startGame()}
          onMenu={() => setScreen('menu')}
        />
      )}
      {screen === 'multiplayer' && (
        <MultiplayerScreen
          onGameStart={(seed) => startGame(seed)}
          onBack={() => setScreen('menu')}
        />
      )}
    </>
  );
}
