import { t } from '../i18n';

export default function SplashScreen() {
  return (
    <div className="screen active" id="splash-screen">
      <div className="splash-content">
        <img src="/assets/logo.png" alt="BH Studios" className="splash-logo" />
        <h1 className="splash-title">{t('title')}</h1>
        <div className="splash-loader"><div className="loader-bar" /></div>
      </div>
    </div>
  );
}
