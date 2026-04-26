// ============================================================
// MultiplayerScreen.tsx — Matchmaking lobby for 1v1
// "Stairs?! NOOOOOOO!" — Claptrap (but ranked ladders go UP)
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { connectMultiplayer, disconnectMultiplayer } from '../multiplayer/client';
import { getToken } from '../api/client';
import { t, getLangConfig } from '../i18n';
import type { MultiplayerEvent } from '../multiplayer/client';

interface Props {
  onGameStart: (seed: number) => void;
  onBack: () => void;
}

export default function MultiplayerScreen({ onGameStart, onBack }: Props) {
  const [status, setStatus] = useState<'idle' | 'searching' | 'found' | 'error'>('idle');
  const [opponent, setOpponent] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [seed, setSeed] = useState(0);
  const matchedRef = useRef(false);
  const lang = getLangConfig();

  // Disconnect only if we leave WITHOUT having matched. After a match the
  // socket ownership transfers to GameScreen so chat & state keep flowing.
  useEffect(() => {
    return () => {
      if (!matchedRef.current) disconnectMultiplayer();
    };
  }, []);

  const handleFind = () => {
    setStatus('searching');
    setErrorMsg('');
    connectMultiplayer((event: MultiplayerEvent) => {
      switch (event.type) {
        case 'matched':
          setStatus('found');
          setOpponent(event.opponentName);
          setSeed(event.seed);
          matchedRef.current = true;
          setTimeout(() => onGameStart(event.seed), 2000);
          break;
        case 'error':
          setStatus('error');
          setErrorMsg(event.message);
          break;
        case 'disconnected':
          if (status === 'searching') { setStatus('error'); setErrorMsg('Disconnected'); }
          break;
      }
    }, getToken() || undefined);
  };

  const handleCancel = () => {
    disconnectMultiplayer();
    setStatus('idle');
  };

  const handleBack = () => {
    disconnectMultiplayer();
    onBack();
  };

  return (
    <div className="screen active" id="multiplayer-screen">
      <div className="multiplayer-content">
        <h1 className="menu-title" style={{ fontSize: '2.5rem' }}>{t('multiplayer')}</h1>

        <div className="mp-lang-badge">
          <span className="score-label">{t('language')}</span>
          <span className="mp-lang-value">{lang.name}</span>
        </div>

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
