// ============================================================
// MultiplayerScreen.tsx — Matchmaking lobby for 1v1
// "Stairs?! NOOOOOOO!" — Claptrap (but ranked ladders go UP)
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { connectMultiplayer, disconnectMultiplayer } from '../multiplayer/client';
import { getToken } from '../api/client';
import { loadDictionary } from '../game/dictionary';
import { t, getLang, setLang, LANGUAGES } from '../i18n';
import { generateFakeOpponentName } from '../multiplayer/fakeName';
import type { MultiplayerEvent } from '../multiplayer/client';
import type { GameMode } from '../App';

interface Props {
  onGameStart: (seed: number, mode: GameMode, opponentName?: string) => void;
  onBack: () => void;
}

const MATCH_TIMEOUT_MS = 10000;

export default function MultiplayerScreen({ onGameStart, onBack }: Props) {
  const [status, setStatus] = useState<'idle' | 'searching' | 'found' | 'error'>('idle');
  const [opponent, setOpponent] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [seed, setSeed] = useState(0);
  const [, forceTick] = useState(0);
  const matchedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentLang = getLang();

  const handleLangChange = (code: string) => {
    if (code === getLang()) return;
    setLang(code);
    loadDictionary();
    forceTick(n => n + 1);
  };

  const clearTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  // Disconnect only if we leave WITHOUT having matched. After a match the
  // socket ownership transfers to GameScreen so chat & state keep flowing.
  useEffect(() => {
    return () => {
      clearTimer();
      if (!matchedRef.current) disconnectMultiplayer();
    };
  }, []);

  const startAiFallback = () => {
    if (matchedRef.current) return;
    matchedRef.current = true;
    disconnectMultiplayer();
    const name = generateFakeOpponentName(getLang());
    const fakeSeed = Math.floor(Math.random() * 2 ** 31);
    setStatus('found');
    setOpponent(name);
    setSeed(fakeSeed);
    setTimeout(() => onGameStart(fakeSeed, 'ai', name), 2000);
  };

  const handleFind = () => {
    setStatus('searching');
    setErrorMsg('');
    matchedRef.current = false;
    clearTimer();
    timeoutRef.current = setTimeout(startAiFallback, MATCH_TIMEOUT_MS);

    connectMultiplayer((event: MultiplayerEvent) => {
      switch (event.type) {
        case 'matched':
          if (matchedRef.current) return;
          clearTimer();
          matchedRef.current = true;
          setStatus('found');
          setOpponent(event.opponentName);
          setSeed(event.seed);
          setTimeout(() => onGameStart(event.seed, 'online'), 2000);
          break;
        case 'error':
          if (matchedRef.current) return;
          clearTimer();
          // WS failure → fall through to AI fallback so the player still gets a game.
          startAiFallback();
          break;
        case 'disconnected':
          if (matchedRef.current) return;
          if (status === 'searching') {
            clearTimer();
            startAiFallback();
          }
          break;
      }
    }, getToken() || undefined);
  };

  const handleCancel = () => {
    clearTimer();
    matchedRef.current = false;
    disconnectMultiplayer();
    setStatus('idle');
  };

  const handleBack = () => {
    clearTimer();
    disconnectMultiplayer();
    onBack();
  };

  return (
    <div className="screen active" id="multiplayer-screen">
      <div className="multiplayer-content">
        <h1 className="menu-title" style={{ fontSize: '2.5rem' }}>{t('multiplayer')}</h1>

        {status === 'idle' && (
          <div className="lang-picker mp-lang-picker">
            {Object.values(LANGUAGES).map(l => (
              <button
                key={l.code}
                className={`lang-btn ${currentLang === l.code ? 'active' : ''}`}
                onClick={() => handleLangChange(l.code)}
              >
                {l.name}
              </button>
            ))}
          </div>
        )}

        {status !== 'idle' && (
          <div className="mp-lang-badge">
            <span className="score-label">{t('language')}</span>
            <span className="mp-lang-value">{LANGUAGES[currentLang]?.name ?? currentLang}</span>
          </div>
        )}

        {status === 'idle' && (
          <>
            <p className="menu-subtitle">1 vs 1 — {t('subtitle')}</p>
            <button className="btn-primary" onClick={handleFind}>{t('findMatch')}</button>
            <button className="btn-secondary" onClick={handleBack}>{t('back')}</button>
          </>
        )}

        {status === 'searching' && (
          <>
            <div className="matchmaking-spinner">
              <div className="spinner" />
              <p>{t('waiting')}</p>
            </div>
            <button className="btn-secondary" onClick={handleCancel}>{t('back')}</button>
          </>
        )}

        {status === 'found' && (
          <div className="match-found">
            <p className="vs-text">{t('vs')}</p>
            <h2 className="opponent-name">{opponent}</h2>
            <p className="menu-subtitle">Seed: {seed}</p>
          </div>
        )}

        {status === 'error' && (
          <>
            <p className="auth-error">{errorMsg}</p>
            <button className="btn-primary" onClick={handleFind}>{t('retry')}</button>
            <button className="btn-secondary" onClick={handleBack}>{t('back')}</button>
          </>
        )}
      </div>
    </div>
  );
}
