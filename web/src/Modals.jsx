import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { PROGRAMS } from './i18n.js';
import { getSessionId } from './storage.js';
import { CheckIcon, CloseIcon } from './icons.jsx';

function Modal({ title, closeLabel, onClose, children }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement;
    const first =
      dialogRef.current?.querySelector('input, textarea, select') ||
      dialogRef.current?.querySelector('button');
    first?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, []);

  return (
    <div
      className="backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" ref={dialogRef}>
        <div className="dialog-head">
          <h2 id="dialog-title">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={closeLabel}>
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Done({ text, closeLabel, onClose }) {
  return (
    <div className="done">
      <span className="done-icon">
        <CheckIcon width={22} height={22} />
      </span>
      <p>{text}</p>
      <div className="actions">
        <button type="button" className="btn btn-primary" onClick={onClose}>
          {closeLabel}
        </button>
      </div>
    </div>
  );
}

export function StudentLogin({ L, onClose, onSignedIn }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    setError('');
    try {
      const { student } = await api.login(code.trim().toUpperCase());
      onSignedIn(student);
    } catch (err) {
      setError(err.status === 404 ? L.codeNotFound : L.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={L.studentSignIn} closeLabel={L.close} onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>{L.codeLabel}</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="DEMO-STUDENT"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
        </label>
        <p className="hint">
          {L.codeHint}{' '}
          <button type="button" className="link" onClick={() => setCode('DEMO-STUDENT')}>
            DEMO-STUDENT
          </button>
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <button className="btn btn-primary" disabled={busy || !code.trim()}>
            {L.signIn}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function LeadForm({ L, lang, onClose }) {
  const [form, setForm] = useState({ name: '', contact: '', interest: PROGRAMS[0], preferredTime: L.timeOptions[0] });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (form.name.trim().length < 2 || form.contact.trim().length < 3) {
      setError(L.required);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.lead({ ...form, lang, sessionId: getSessionId() });
      setDone(true);
    } catch {
      setError(L.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={L.leadTitle} closeLabel={L.close} onClose={onClose}>
      {done ? (
        <Done text={L.leadDone} closeLabel={L.close} onClose={onClose} />
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
                {PROGRAMS.map((p) => (
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
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button className="btn btn-primary" disabled={busy}>
              {L.sendRequest}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function tomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function ExcuseForm({ L, student, onClose }) {
  const [date, setDate] = useState(tomorrow);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!date || reason.trim().length < 3) {
      setError(L.required);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.excuse({ code: student.code, date, reason });
      setDone(true);
    } catch {
      setError(L.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={L.excuseTitle} closeLabel={L.close} onClose={onClose}>
      {done ? (
        <Done text={L.excuseDone} closeLabel={L.close} onClose={onClose} />
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
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button className="btn btn-primary" disabled={busy}>
              {L.send}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
