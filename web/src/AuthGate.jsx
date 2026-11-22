import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { useApp } from './context.jsx';
import { LANGS } from './i18n.js';

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-3l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.8-5H1.2v3.1C3.2 21.3 7.3 24 12 24z" />
      <path fill="#FBBC05" d="M5.2 14.2c-.2-.7-.4-1.5-.4-2.2s.1-1.5.4-2.2V6.7H1.2C.4 8.3 0 10.1 0 12s.4 3.7 1.2 5.3l4-3.1z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.3 0 3.2 2.7 1.2 6.7l4 3.1c1-2.9 3.7-5 6.8-5z" />
    </svg>
  );
}

function GithubLogo() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55v-2.1c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.08 0 4.41-2.69 5.39-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.66.79.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

export function OAuthButtons({ onSuccess }) {
  const { L, lang, signedIn } = useApp();
  const [cfg, setCfg] = useState({ loaded: false, googleClientId: null, githubEnabled: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const googleRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authErr = params.get('auth_error');
    if (authErr) {
      setError(authErr === 'github_not_configured' ? L.oauthPending('GitHub') : L.oauthFailed);
      window.history.replaceState(null, '', window.location.pathname);
    }
    let active = true;
    api
      .authConfig()
      .then((c) => active && setCfg({ loaded: true, googleClientId: c?.googleClientId || null, githubEnabled: Boolean(c?.githubEnabled) }))
      .catch(() => active && setCfg({ loaded: true, googleClientId: null, githubEnabled: false }));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!cfg.googleClientId || !googleRef.current) return;
    let cancelled = false;
    const renderBtn = () => {
      if (cancelled || !window.google?.accounts?.id || !googleRef.current) return;
      window.google.accounts.id.initialize({
        client_id: cfg.googleClientId,
        callback: async (resp) => {
          if (!resp?.credential) return;
          setBusy(true);
          setError('');
          try {
            const { user } = await api.googleLogin(resp.credential, lang);
            signedIn(user);
            onSuccess?.();
          } catch {
            setError(L.oauthFailed);
          } finally {
            setBusy(false);
          }
        },
      });
      googleRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleRef.current, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        width: Math.min(340, googleRef.current.clientWidth || 300),
        text: 'continue_with',
      });
    };
    if (window.google?.accounts?.id) {
      renderBtn();
    } else {
      let s = document.querySelector('script[data-gsi]');
      if (!s) {
        s = document.createElement('script');
        s.src = 'https://accounts.google.com/gsi/client';
        s.async = true;
        s.defer = true;
        s.dataset.gsi = '1';
        document.head.appendChild(s);
      }
      s.addEventListener('load', renderBtn, { once: true });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.googleClientId, lang]);

  return (
    <div className="oauth-stack">
      {cfg.googleClientId ? (
        <div className="google-wrap" ref={googleRef} />
      ) : (
        <button
          type="button"
          className="oauth-btn oauth-google"
          disabled={busy || !cfg.loaded}
          onClick={() => setError(L.oauthPending('Google'))}
        >
          <GoogleLogo />
          <span>{L.continueGoogle}</span>
        </button>
      )}

      {cfg.githubEnabled ? (
        <a className="oauth-btn oauth-github" href="/api/auth/github">
          <GithubLogo />
          <span>{L.continueGithub}</span>
        </a>
      ) : (
        <button
          type="button"
          className="oauth-btn oauth-github"
          disabled={busy || !cfg.loaded}
          onClick={() => setError(L.oauthPending('GitHub'))}
        >
          <GithubLogo />
          <span>{L.continueGithub}</span>
        </button>
      )}

      {error && (
        <p className="form-error oauth-err" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default function AuthGate() {
  const { L, lang, setLang } = useApp();
  return (
    <div className="landing">
      <div className="landing-orb landing-orb-a" aria-hidden="true" />
      <div className="landing-orb landing-orb-b" aria-hidden="true" />

      <header className="landing-nav">
        <div className="landing-brand">
          <img src="/brand/cube-128.png" alt="Picsart Academy" width="34" height="31" />
          <span>
            <b>Picsart Academy</b>
            <small>AI Concierge</small>
          </span>
        </div>
        <div className="seg" role="group" aria-label="Language">
          {LANGS.map((l) => (
            <button
              key={l.code}
              type="button"
              className={l.code === lang ? 'on' : ''}
              aria-pressed={l.code === lang}
              onClick={() => setLang(l.code)}
            >
              {l.label}
            </button>
          ))}
        </div>
      </header>

      <main className="landing-main">
        <section className="landing-hero">
          <div className="landing-emblem">
            <span className="landing-ring" aria-hidden="true" />
            <img className="landing-cube" src="/brand/cube-256.png" alt="Picsart Academy" width="96" height="88" />
          </div>
          <span className="landing-kicker">{L.authGateKicker}</span>
          <h1 className="landing-title">{L.authGateTitle}</h1>
          <p className="landing-sub">{L.authGateSubtitle}</p>

          <div className="landing-auth-box">
            <span className="landing-auth-label">{L.authGateCtaLabel}</span>
            <OAuthButtons />
          </div>
        </section>

        <section className="landing-bento" aria-label="Features">
          {L.authGateFeatures.map((f) => (
            <article key={f.title} className="bento-card">
              <span className="bento-ico" aria-hidden="true">
                {f.icon}
              </span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </article>
          ))}
        </section>
      </main>

      <footer className="landing-foot">
        <span>{L.mapAddress}</span>
        <span>·</span>
        <a href="tel:+37443477447">+374 43 477447</a>
      </footer>
    </div>
  );
}
