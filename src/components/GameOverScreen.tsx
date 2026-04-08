import { t } from '../i18n';
import type { GameStats } from '../game/types';

interface Props {
  stats: GameStats;
  onRetry: () => void;
  onMenu: () => void;
}

export default function GameOverScreen({ stats, onRetry, onMenu }: Props) {
  return (
    <div className="screen active" id="gameover-screen">
      <div className="gameover-content">
        <img src="/assets/logo.png" alt="BH Studios" className="gameover-logo" />
        <h1 className="gameover-title">{t('gameOver')}</h1>
        <div className="gameover-stats">
          <div className="stat"><span className="stat-label">{t('score')}</span><span className="stat-value">{stats.score}</span></div>
          <div className="stat"><span className="stat-label">{t('best')}</span><span className="stat-value">{stats.highScore}</span></div>
          <div className="stat"><span className="stat-label">{t('words')}</span><span className="stat-value">{stats.wordsFound}</span></div>
          <div className="stat"><span className="stat-label">{t('bestWord')}</span><span className="stat-value">{stats.bestWord}</span></div>
          {stats.maxCombo > 1 && (
            <div className="stat"><span className="stat-label">{t('combo')}</span><span className="stat-value">x{stats.maxCombo}</span></div>
          )}
        </div>
        <button className="btn-primary" onClick={onRetry}>{t('retry')}</button>
        <button className="btn-secondary" onClick={onMenu}>{t('menu')}</button>
      </div>
    </div>
  );
}
