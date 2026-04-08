// ============================================================
// GameScreen.tsx — Canvas wrapper for the physics game engine
// ============================================================

import { useEffect, useRef } from 'react';
import { initGame, startGame, stopGame } from '../game/engine';
import { isLoggedIn, submitScore } from '../api/client';
import { t } from '../i18n';
import type { GameStats } from '../game/types';

interface Props {
  onGameOver: (stats: GameStats) => void;
  seedOverride?: number;
}

export default function GameScreen({ onGameOver, seedOverride }: Props) {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    initGame({
      onGameOver: (stats) => {
        if (isLoggedIn()) {
          submitScore(stats.score, Math.floor(stats.score / 50) + 1, stats.wordsFound, stats.bestWord);
        }
        onGameOver(stats);
      },
      onScoreUpdate: () => {},
    });
    startGame(seedOverride);

    return () => { stopGame(); started.current = false; };
  }, [onGameOver, seedOverride]);

  return (
    <div className="screen active" id="game-screen">
      <div id="game-container">
        <div id="score-bar">
          <div className="score-left">
            <span className="score-label">{t('score')}</span>
            <span id="current-score">0</span>
          </div>
          <div className="score-center">
            <span id="current-word-display"></span>
            <span id="combo-display" className="combo-display" style={{ opacity: 0 }}></span>
          </div>
          <div className="score-right">
            <span className="score-label">{t('level')}</span>
            <span id="current-level">1</span>
          </div>
        </div>
        <canvas id="game-canvas"></canvas>
      </div>
    </div>
  );
}
