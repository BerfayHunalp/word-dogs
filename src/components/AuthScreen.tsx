import { useState, FormEvent } from 'react';
import { signup, login } from '../api/client';
import { t } from '../i18n';

interface Props { onDone: () => void; }

export default function AuthScreen({ onDone }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault(); setError('');
    try { await login(email, password); onDone(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Erreur'); }
  };

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault(); setError('');
    try { await signup(username, email, password); onDone(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : 'Erreur'); }
  };

  return (
    <div className="screen active" id="auth-screen">
      <div className="auth-content">
        <img src="/assets/logo.png" alt="BH Studios" className="auth-logo" />
        <h1 className="auth-title">{t('title')}</h1>

        {mode === 'login' ? (
          <form className="auth-form" onSubmit={handleLogin}>
            <h2 className="auth-form-title">{t('login')}</h2>
            <input type="email" placeholder={t('email')} value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            <input type="password" placeholder={t('password')} value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
            {error && <div className="auth-error">{error}</div>}
            <button type="submit" className="btn-primary">{t('loginBtn')}</button>
            <p className="auth-switch">{t('noAccount')} <a href="#" onClick={e => { e.preventDefault(); setMode('signup'); setError(''); }}>{t('createAccount')}</a></p>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleSignup}>
            <h2 className="auth-form-title">{t('signup')}</h2>
            <input type="text" placeholder={t('username')} value={username} onChange={e => setUsername(e.target.value)} required minLength={3} maxLength={20} autoComplete="username" />
            <input type="email" placeholder={t('email')} value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            <input type="password" placeholder={t('passwordHint')} value={password} onChange={e => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
            {error && <div className="auth-error">{error}</div>}
            <button type="submit" className="btn-primary">{t('signupBtn')}</button>
            <p className="auth-switch">{t('hasAccount')} <a href="#" onClick={e => { e.preventDefault(); setMode('login'); setError(''); }}>{t('loginLink')}</a></p>
          </form>
        )}

        <button className="btn-secondary" onClick={onDone}>{t('skipAuth')}</button>
      </div>
    </div>
  );
}
