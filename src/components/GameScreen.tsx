// ============================================================
// GameScreen.tsx — Canvas wrapper, modes, gauge UI, power-ups, scaling
// ============================================================

import { useEffect, useRef, useState } from 'react';
import {
  initGame, startGame, stopGame, forceGameOver,
  castWildcardBall, castBarrage, castLaser, isLaserActive,
  getOpponentScore, setOpponentScore,
  getPowerCosts, setRushOverride,
  setMultiTouchMode, setDuelScoreCallback,
} from '../game/engine';
import { isLoggedIn, submitScore } from '../api/client';
import {
  sendInterference as mpSendInterference,
  sendChat as mpSendChat,
  sendScoreUpdate as mpSendScoreUpdate,
  sendGameOver as mpSendGameOver,
  setMultiplayerHandler,
  isMultiplayerConnected,
  type MultiplayerEvent,
} from '../multiplayer/client';
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
  aiName?: string;
}

export default function GameScreen({ onGameOver, seedOverride, mode, aiName }: Props) {
  const started = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gauge, setGauge] = useState(0);
  const [gaugeMax, setGaugeMax] = useState(100);
  const [oppScore, setOppScore] = useState(0);
  const [duel, setDuel] = useState({ p1: 0, p2: 0 });
  const [laserArmedUI, setLaserArmedUI] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ from: 'me' | 'them'; text: string; ts: number }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadChat, setUnreadChat] = useState(0);
  const chatListRef = useRef<HTMLDivElement>(null);
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

  // Online: subscribe to multiplayer events for opponent score, interference, chat, gameOver.
  useEffect(() => {
    if (!isOnline) return;
    setMultiplayerHandler((event: MultiplayerEvent) => {
      if (event.type === 'opponentScore') {
        setOpponentScore(event.score);
        setOppScore(event.score);
      } else if (event.type === 'chat') {
        setChatMessages(prev => [...prev.slice(-29), { from: 'them', text: event.text, ts: event.ts }]);
        setUnreadChat(u => (chatOpen ? 0 : u + 1));
      } else if (event.type === 'opponentGameOver') {
        // Opponent quit or finished → end our game now too
        forceGameOver();
      }
    });
  }, [isOnline, chatOpen]);

  // Auto-scroll chat to bottom on new message
  useEffect(() => {
    if (chatListRef.current) chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
  }, [chatMessages, chatOpen]);

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
      onScoreUpdate: (score, level) => {
        if (isOnline) mpSendScoreUpdate(score, level);
      },
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

  const handleSendChat = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    if (!isMultiplayerConnected()) return;
    mpSendChat(text);
    setChatMessages(prev => [...prev.slice(-29), { from: 'me', text, ts: Date.now() }]);
    setChatInput('');
  };

  const toggleChat = () => {
    setChatOpen(o => {
      if (!o) setUnreadChat(0);
      return !o;
    });
  };

  const handleQuit = () => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(t('quitConfirm'))) return;
    if (isOnline) mpSendGameOver(0);
    forceGameOver();
  };

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
                  {isOnline ? t('vs') : isAI ? (aiName || t('aiLabel')) : t('level')}
                </span>
                {showOpponent
                  ? <span>{oppScore}</span>
                  : <span id="current-level">1</span>}
              </div>
            </div>
          )}

          <canvas id="game-canvas"></canvas>

          <button className="quit-btn" onClick={handleQuit} title={t('quit')} aria-label={t('quit')}>
            ✕
          </button>

          <button
            className="rush-btn"
            onPointerDown={(e) => { e.preventDefault(); setRushOverride(true); }}
            onPointerUp={() => setRushOverride(false)}
            onPointerLeave={() => setRushOverride(false)}
            onPointerCancel={() => setRushOverride(false)}
            onContextMenu={(e) => e.preventDefault()}
            aria-label="Rush"
          >
            ⏬ RUSH
          </button>

          {isOnline && (
            <>
              <button
                className={`chat-toggle ${unreadChat > 0 ? 'has-unread' : ''}`}
                onClick={toggleChat}
                aria-label="Chat"
              >
                💬{unreadChat > 0 ? <span className="chat-unread">{unreadChat}</span> : null}
              </button>

              {chatOpen && (
                <div className="chat-panel">
                  <div className="chat-header">
                    <span>{t('vs')}</span>
                    <button className="chat-close" onClick={toggleChat}>×</button>
                  </div>
                  <div className="chat-list" ref={chatListRef}>
                    {chatMessages.length === 0 && <div className="chat-empty">…</div>}
                    {chatMessages.map((m, i) => (
                      <div key={i} className={`chat-msg ${m.from}`}>{m.text}</div>
                    ))}
                  </div>
                  <form className="chat-input-row" onSubmit={handleSendChat}>
                    <input
                      type="text"
                      maxLength={200}
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      placeholder="…"
                      autoComplete="off"
                    />
                    <button type="submit" disabled={!chatInput.trim()}>↑</button>
                  </form>
                </div>
              )}
            </>
          )}

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
                title={`${t('pawSlash')} (${costs.laser})`}
              >
                🐾 <span className="power-cost">{costs.laser}</span>
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
