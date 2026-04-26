// ============================================================
// GameScreen.tsx — Canvas wrapper, modes, gauge UI, power-ups, scaling
// ============================================================

import { useEffect, useRef, useState } from 'react';
import {
  initGame, startGame, stopGame,
  castWildcardBall, castBarrage, castLaser, isLaserActive,
  getOpponentScore, setOpponentScore,
  getPowerCosts,
  setMultiTouchMode, setDuelScoreCallback,
} from '../game/engine';
import { isLoggedIn, submitScore } from '../api/client';
import { sendInterference as mpSendInterference } from '../multiplayer/client';
import { setMultiplayerCallback } from '../game/engine';
import { startBot, type BotInstance } from '../game/bot';
import { getElo, updateEloFromMatch } from '../game/elo';
import { t } from '../i18n';
import type { GameStats } from '../game/types';
import type { GameMode } from '../App';

const REF_W = 480;
const REF_H = 850;

interface Props {
  onGameOver: (stats: GameStats) => void;
  seedOverride?: number;
  mode: GameMode;
}

export default function GameScreen({ onGameOver, seedOverride, mode }: Props) {
  const started = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gauge, setGauge] = useState(0);
  const [gaugeMax, setGaugeMax] = useState(100);
  const [oppScore, setOppScore] = useState(0);
  const [duel, setDuel] = useState({ p1: 0, p2: 0 });
  const [laserArmedUI, setLaserArmedUI] = useState(false);
  const costs = getPowerCosts();

  const isOnline = mode === 'online';
  const isAI = mode === 'ai';
  const isDuel = mode === 'localDuel';
  const showOpponent = isOnline || isAI;

  // Bot opponent for AI mode — strength matches the player's hidden Elo.
  const botRef = useRef<BotInstance | null>(null);
  const botEloRef = useRef<number>(0);
  useEffect(() => {
    if (!isAI) return;
    const playerElo = getElo();
    botEloRef.current = playerElo;
    const bot = startBot(playerElo, (points) => {
      const next = getOpponentScore() + points;
      setOpponentScore(next);
      setOppScore(next);
    });
    botRef.current = bot;
    return () => { bot.stop(); botRef.current = null; };
  }, [isAI]);

  // Online opponent score polling
  useEffect(() => {
    if (!isOnline) return;
    const id = setInterval(() => setOppScore(getOpponentScore()), 250);
    return () => clearInterval(id);
  }, [isOnline]);

  // Track laser armed state for UI feedback
  useEffect(() => {
    const id = setInterval(() => setLaserArmedUI(isLaserActive()), 100);
    return () => clearInterval(id);
  }, []);

  // Fixed-size scale-to-fit
  useEffect(() => {
    const apply = () => {
      const el = containerRef.current;
      if (!el) return;
      const sx = window.innerWidth / REF_W;
      const sy = window.innerHeight / REF_H;
      const s = Math.min(sx, sy, 1.4);
      el.style.transform = `scale(${s})`;
    };
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);

  // Game lifecycle
  useEffect(() => {
    if (started.current) return;
    started.current = true;

    setMultiTouchMode(isDuel);
    setDuelScoreCallback((p1, p2) => setDuel({ p1, p2 }));

    initGame({
      onGameOver: (stats) => {
        if (isLoggedIn() && !isDuel) {
          submitScore(stats.score, Math.floor(stats.score / 50) + 1, stats.wordsFound, stats.bestWord);
        }
        // Hidden Elo update for AI matches only
        if (isAI) {
          const botElo = botEloRef.current || getElo();
          updateEloFromMatch(stats.score, getOpponentScore(), botElo);
        }
        onGameOver(stats);
      },
      onScoreUpdate: () => {},
      onGaugeUpdate: (g, m) => { setGauge(g); setGaugeMax(m); },
    });

    if (isOnline) setMultiplayerCallback((type) => mpSendInterference(type));

    startGame(seedOverride);

    return () => {
      stopGame();
      setMultiTouchMode(false);
      setDuelScoreCallback(() => {});
      started.current = false;
    };
  }, [onGameOver, seedOverride, mode, isOnline, isDuel]);

  const gaugePct = Math.round((gauge / gaugeMax) * 100);
  const canCastWild = gauge >= costs.wildcard;
  const canCastBarrage = gauge >= costs.barrage && isOnline;
  const canCastLaser = gauge >= costs.laser && !laserArmedUI;

  return (
    <div className="screen active" id="game-screen">
      <div id="game-fit">
        <div id="game-container" ref={containerRef}>
          {isDuel ? (
            <div id="score-bar" className="duel-bar">
              <div className="duel-side p1"><span className="score-label">{t('p1')}</span><span>{duel.p1}</span></div>
              <div className="score-center">
                <span id="current-word-display"></span>
                <span id="combo-display" className="combo-display" style={{ opacity: 0 }}></span>
              </div>
              <div className="duel-side p2"><span className="score-label">{t('p2')}</span><span>{duel.p2}</span></div>
            </div>
          ) : (
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
                <span className="score-label">
                  {isOnline ? t('vs') : isAI ? t('aiLabel') : t('level')}
                </span>
                {showOpponent
                  ? <span>{oppScore}</span>
                  : <span id="current-level">1</span>}
              </div>
            </div>
          )}

          <canvas id="game-canvas"></canvas>

          <div id="gauge-bar">
            <div className="gauge-track">
              <div className="gauge-fill" style={{ width: `${gaugePct}%` }} />
              <span className="gauge-label">{gauge}/{gaugeMax}</span>
            </div>
            <div className="power-buttons">
              <button
                className={`power-btn ${canCastWild ? 'ready' : ''}`}
                disabled={!canCastWild}
                onClick={() => castWildcardBall()}
                title={`Wildcard ball (${costs.wildcard})`}
              >
                ★ <span className="power-cost">{costs.wildcard}</span>
              </button>
              <button
                className={`power-btn ${canCastLaser ? 'ready' : ''} ${laserArmedUI ? 'armed' : ''}`}
                disabled={!canCastLaser}
                onClick={() => castLaser()}
                title={`Laser slash (${costs.laser})`}
              >
                ⚡ <span className="power-cost">{costs.laser}</span>
              </button>
              <button
                className={`power-btn ${canCastBarrage ? 'ready' : ''}`}
                disabled={!canCastBarrage}
                onClick={() => castBarrage()}
                title={`5-ball barrage (${costs.barrage})`}
              >
                ☄ x5 <span className="power-cost">{costs.barrage}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
