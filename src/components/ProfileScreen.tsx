import { useState, useEffect } from 'react';
import { getUser, getMyScores } from '../api/client';
import { t } from '../i18n';

interface Props { onBack: () => void; }

export default function ProfileScreen({ onBack }: Props) {
  const user = getUser();
  const [scores, setScores] = useState<{ scores: Array<{ score: number; words_found: number; played_at: string }>; stats: { bestScore: number; totalGames: number; totalWords: number } } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyScores(20).then(data => { setScores(data); setLoading(false); });
  }, []);

  return (
    <div className="screen active" id="profile-screen">
      <div className="profile-content">
        <h2 className="profile-title">{t('profileTitle')}</h2>
        <div className="profile-username">@{user?.username}</div>
        <div className="profile-stats">
          <div className="stat"><span className="stat-label">{t('bestScore')}</span><span className="stat-value">{scores?.stats.bestScore ?? '-'}</span></div>
          <div className="stat"><span className="stat-label">{t('gamesPlayed')}</span><span className="stat-value">{scores?.stats.totalGames ?? '-'}</span></div>
          <div className="stat"><span className="stat-label">{t('wordsFound')}</span><span className="stat-value">{scores?.stats.totalWords ?? '-'}</span></div>
        </div>
        <h3 className="profile-section-title">{t('history')}</h3>
        <div className="profile-history">
          {loading && <p style={{ color: 'var(--text-dim)' }}>{t('loading')}</p>}
          {!loading && (!scores?.scores.length ? <p style={{ color: 'var(--text-dim)' }}>{t('noGames')}</p> :
            scores.scores.map((s, i) => (
              <div key={i} className="history-item">
                <span className="history-score">{s.score}</span>
                <span className="history-words">{s.words_found} {t('wordsUnit')}</span>
                <span className="history-date">{new Date(s.played_at).toLocaleDateString(user ? undefined : 'fr-FR')}</span>
              </div>
            ))
          )}
        </div>
        <button className="btn-secondary" onClick={onBack}>{t('back')}</button>
      </div>
    </div>
  );
}
