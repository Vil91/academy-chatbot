import { useEffect, useState } from 'react';
import Chat from './Chat.jsx';
import Admin from './Admin.jsx';
import { ExcuseForm, LeadForm, StudentLogin } from './Modals.jsx';
import { LANGS, t, detectInitialLang } from './i18n.js';
import { api } from './api.js';
import { load, remove, save } from './storage.js';
import { UserIcon } from './icons.jsx';

function Concierge() {
  const [lang, setLang] = useState(() => {
    const saved = load('ac_lang');
    return LANGS.some((l) => l.code === saved) ? saved : detectInitialLang();
  });
  const [student, setStudent] = useState(null);
  const [modal, setModal] = useState(null);
  const L = t(lang);

  useEffect(() => {
    document.documentElement.lang = lang;
    save('ac_lang', lang);
  }, [lang]);

  // Restore the demo sign-in after a reload.
  useEffect(() => {
    const code = load('ac_student');
    if (!code) return;
    api
      .login(code)
      .then(({ student: s }) => setStudent(s))
      .catch(() => remove('ac_student'));
  }, []);

  function signIn(s) {
    setStudent(s);
    save('ac_student', s.code);
    setModal(null);
  }

  function signOut() {
    setStudent(null);
    remove('ac_student');
  }

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Academy Concierge">
          <span className="mark" aria-hidden="true">
            Ա
          </span>
          <span className="brand-text">
            <span className="brand-name">Academy Concierge</span>
            <span className="brand-sub">{L.brandSub}</span>
          </span>
        </a>
        <div className="top-actions">
          <div className="seg" role="group" aria-label="Language">
            {LANGS.map((l) => (
              <button
                type="button"
                key={l.code}
                className={l.code === lang ? 'on' : ''}
                aria-pressed={l.code === lang}
                onClick={() => setLang(l.code)}
              >
                {l.label}
              </button>
            ))}
          </div>
          {!student && (
            <button type="button" className="btn btn-ghost signin" onClick={() => setModal('login')}>
              <UserIcon />
              <span className="signin-text">{L.studentSignIn}</span>
            </button>
          )}
        </div>
      </header>

      <main className="main">
        <Chat lang={lang} student={student} onOpen={setModal} onSignOut={signOut} />
        <p className="footnote">{L.footer}</p>
      </main>

      {modal === 'login' && <StudentLogin L={L} onClose={() => setModal(null)} onSignedIn={signIn} />}
      {modal === 'lead' && <LeadForm L={L} lang={lang} onClose={() => setModal(null)} />}
      {modal === 'excuse' && student && <ExcuseForm L={L} student={student} onClose={() => setModal(null)} />}
    </div>
  );
}

export default function App() {
  return window.location.pathname.startsWith('/admin') ? <Admin /> : <Concierge />;
}
