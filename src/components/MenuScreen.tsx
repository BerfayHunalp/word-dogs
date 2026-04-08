import { isLoggedIn, getUser, logout } from '../api/client';
import { getHighScore } from '../game/engine';
import { t, LANGUAGES } from '../i18n';

interface Props {
  onPlay: () => void;
  onProfile: () => void;
  onMultiplayer: () => void;
  onLogout: () => void;
  lang: string;
  onLangChange: (code: string) => void;
}

export default function MenuScreen({ onPlay, onProfile, onMultiplayer, onLogout, lang, onLangChange }: Props) {
  const loggedIn = isLoggedIn();
  const user = getUser();

  const handleLogout = () => { logout(); onLogout(); };

  return (
    <div className="screen active" id="menu-screen">
      <div className="menu-content">
        <h1 className="menu-title">{t('title')}</h1>
        <p className="menu-subtitle">{t('subtitle')}</p>

        {/* Language picker */}
        <div className="lang-picker">
          {Object.values(LANGUAGES).map(l => (
            <button key={l.code} className={`lang-btn ${lang === l.code ? 'active' : ''}`} onClick={() => onLangChange(l.code)}>
              {l.name}
            </button>
          ))}
        </div>

        {loggedIn && user && (
          <div className="user-badge">
            <span>{user.username}</span>
            <a href="#" onClick={e => { e.preventDefault(); handleLogout(); }}>{t('logout')}</a>
          </div>
        )}

        <button className="btn-primary" onClick={onPlay}>{t('play')}</button>
        <button className="btn-primary" style={{ background: '#7c3aed', boxShadow: '0 4px 20px rgba(124,58,237,0.4)' }} onClick={onMultiplayer}>{t('multiplayer')}</button>
        {loggedIn && <button className="btn-secondary" onClick={onProfile}>{t('profile')}</button>}

        <div className="high-score-display">
          <span>{t('highScore')}</span>
          <span>{getHighScore()}</span>
        </div>
      </div>
    </div>
  );
}
