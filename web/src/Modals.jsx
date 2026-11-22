import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { useApp } from './context.jsx';
import { LEAD_PROGRAMS, PROGRAMS } from './i18n.js';
import { CheckIcon, CloseIcon } from './icons.jsx';

export function Modal({ title, onClose, children, wide = false }) {
  const { L } = useApp();
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement;
    (ref.current?.querySelector('input, textarea, select') || ref.current?.querySelector('button'))?.focus();
    const onKey = (e) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, []);

  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`dialog ${wide ? 'dialog-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title" ref={ref}>
        <div className="dialog-head">
          <h2 id="dialog-title">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={L.close}>
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Done({ text, onClose }) {
  const { L } = useApp();
  return (
    <div className="done">
      <span className="done-icon">
        <CheckIcon width={22} height={22} />
      </span>
      <p>{text}</p>
      <button type="button" className="btn btn-brand" onClick={onClose}>
        {L.close}
      </button>
    </div>
  );
}

const FormError = ({ children }) =>
  children ? (
    <p className="form-error" role="alert">
      {children}
    </p>
  ) : null;

export function AuthModal({ initialTab = 'signin', onClose }) {
  const { L, lang, signedIn } = useApp();
  const [tab, setTab] = useState(initialTab);
  const [form, setForm] = useState({ name: '', email: '', password: '', program: PROGRAMS[0] });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);
  const [googleId, setGoogleId] = useState(null);
  const googleBtnRef = useRef(null);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const fail = (err) => setError(L.authErrors[err.code] || L.error);

  useEffect(() => {
    let active = true;
    api
      .authConfig()
      .then((c) => active && setGoogleId(c?.googleClientId || null))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!googleId || !googleBtnRef.current) return;
    let cancelled = false;
    const renderBtn = () => {
      if (cancelled || !window.google?.accounts?.id || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: googleId,
        callback: async (resp) => {
          if (!resp?.credential) return;
          setBusy('google');
          setError('');
          try {
            signedIn((await api.googleLogin(resp.credential, lang)).user);
          } catch (err) {
            fail(err);
          } finally {
            setBusy(null);
          }
        },
      });
      googleBtnRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        width: 340,
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
  }, [googleId, lang]);

  async function submit(e) {
    e.preventDefault();
    setBusy('form');
    setError('');
    try {
      const { user } =
        tab === 'signin'
          ? await api.login({ email: form.email, password: form.password })
          : await api.signup({ ...form, lang });
      signedIn(user);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  }

  async function demo() {
    setBusy('demo');
    setError('');
    try {
      signedIn((await api.demo(lang)).user);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal title={tab === 'signin' ? L.signIn : L.signUp} onClose={onClose}>
      <button type="button" className="demo-card" onClick={demo} disabled={busy !== null}>
        <img src="/brand/cube-128.png" alt="" width="40" height="37" />
        <span>
          <strong>{L.tryDemo}</strong>
          <small>{L.demoHint}</small>
        </span>
      </button>

      {googleId && <div className="google-wrap" ref={googleBtnRef} />}

      <div className="divider">
        <span>{L.or}</span>
      </div>

      <div className="tabs" role="tablist">
        {['signin', 'signup'].map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? 'on' : ''}
            onClick={() => {
              setTab(key);
              setError('');
            }}
          >
            {key === 'signin' ? L.signIn : L.signUp}
          </button>
        ))}
      </div>

      <form className="form" onSubmit={submit} noValidate>
        {tab === 'signup' && (
          <label className="field">
            <span>{L.name}</span>
            <input value={form.name} onChange={set('name')} autoComplete="name" maxLength={80} />
          </label>
        )}
        <label className="field">
          <span>{L.email}</span>
          <input type="email" value={form.email} onChange={set('email')} autoComplete="email" maxLength={120} />
        </label>
        <label className="field">
          <span>{L.password}</span>
          <input
            type="password"
            value={form.password}
            onChange={set('password')}
            autoComplete={tab === 'signin' ? 'current-password' : 'new-password'}
            maxLength={200}
          />
          {tab === 'signup' && <small className="field-hint">{L.passwordHint}</small>}
        </label>
        {tab === 'signup' && (
          <label className="field">
            <span>{L.program}</span>
            <select value={form.program} onChange={set('program')}>
              {PROGRAMS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
        )}
        <FormError>{error}</FormError>
        <button className="btn btn-dark btn-block" disabled={busy !== null}>
          {tab === 'signin' ? L.signIn : L.createAccount}
        </button>
      </form>
    </Modal>
  );
}

export function LeadForm({ conversationId, onClose }) {
  const { L, lang } = useApp();
  const [form, setForm] = useState({ name: '', contact: '', interest: LEAD_PROGRAMS[0], preferredTime: L.timeOptions[0] });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (form.name.trim().length < 2 || form.contact.trim().length < 3) return setError(L.required);
    setBusy(true);
    setError('');
    try {
      await api.lead({ ...form, lang, conversationId });
      setDone(true);
    } catch {
      setError(L.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={L.leadTitle} onClose={onClose}>
      {done ? (
        <Done text={L.leadDone} onClose={onClose} />
      ) : (
        <form className="form" onSubmit={submit} noValidate>
          <p className="dialog-intro">{L.leadIntro}</p>
          <label className="field">
            <span>{L.name} *</span>
            <input value={form.name} onChange={set('name')} autoComplete="name" maxLength={120} />
          </label>
          <label className="field">
            <span>{L.contact} *</span>
            <input value={form.contact} onChange={set('contact')} autoComplete="email" maxLength={120} />
          </label>
          <div className="field-row">
            <label className="field">
              <span>{L.program}</span>
              <select value={form.interest} onChange={set('interest')}>
                {LEAD_PROGRAMS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
                <option value={L.other}>{L.other}</option>
              </select>
            </label>
            <label className="field">
              <span>{L.preferredTime}</span>
              <select value={form.preferredTime} onChange={set('preferredTime')}>
                {L.timeOptions.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
          </div>
          <FormError>{error}</FormError>
          <button className="btn btn-brand btn-block" disabled={busy}>
            {L.sendRequest}
          </button>
        </form>
      )}
    </Modal>
  );
}

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ExcuseForm({ onClose, onDone }) {
  const { L } = useApp();
  const [date, setDate] = useState(tomorrow);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!date || reason.trim().length < 3) return setError(L.required);
    setBusy(true);
    setError('');
    try {
      await api.excuse({ date, reason });
      setDone(true);
      onDone?.();
    } catch {
      setError(L.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={L.excuseTitle} onClose={onClose}>
      {done ? (
        <Done text={L.excuseDone} onClose={onClose} />
      ) : (
        <form className="form" onSubmit={submit} noValidate>
          <p className="dialog-intro">{L.excuseIntro}</p>
          <label className="field">
            <span>{L.date} *</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            <span>{L.reason} *</span>
            <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          </label>
          <FormError>{error}</FormError>
          <button className="btn btn-brand btn-block" disabled={busy}>
            {L.send}
          </button>
        </form>
      )}
    </Modal>
  );
}

// Renders whichever dialog is open in the app state.
export function Modals() {
  const { modal, closeModal } = useApp();
  if (!modal) return null;
  const { name, props } = modal;
  if (name === 'auth') return <AuthModal {...props} onClose={closeModal} />;
  if (name === 'lead') return <LeadForm {...props} onClose={closeModal} />;
  if (name === 'excuse') return <ExcuseForm {...props} onClose={closeModal} />;
  return null;
}
