// ============================================================
// LangScreen.tsx — First-launch language picker
// "Choose, choomba!" — Mr. Torgue (probably)
// ============================================================

import { LANGUAGES } from '../i18n';

interface Props {
  onPick: (code: string) => void;
}

export default function LangScreen({ onPick }: Props) {
  return (
    <div className="screen active" id="lang-screen">
      <div className="menu-content">
        <img src="/assets/logo.png" alt="BH Studios" className="menu-logo" />
        <h1 className="menu-title" style={{ fontSize: '2.6rem' }}>WARDOGS</h1>
        <p className="menu-subtitle">Language / Langue</p>
        <div className="lang-pick-grid">
          {Object.values(LANGUAGES).map(l => (
            <button key={l.code} className="btn-primary lang-pick-btn" onClick={() => onPick(l.code)}>
              {l.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
