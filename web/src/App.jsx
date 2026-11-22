import { useEffect, useState } from 'react';
import Admin from './Admin.jsx';
import Cabinet from './Cabinet.jsx';
import Chat from './Chat.jsx';
import Sidebar from './Sidebar.jsx';
import { AppProvider, useApp } from './context.jsx';
import { LANGS } from './i18n.js';
import { MenuIcon } from './icons.jsx';
import { Modals } from './Modals.jsx';
import { usePath } from './router.js';

function LangSwitch() {
  const { lang, setLang } = useApp();
  return (
    <div className="seg" role="group" aria-label="Language">
      {LANGS.map((l) => (
        <button key={l.code} type="button" className={l.code === lang ? 'on' : ''} aria-pressed={l.code === lang} onClick={() => setLang(l.code)}>
          {l.label}
        </button>
      ))}
    </div>
  );
}

function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return null;
  }
}

function Shell({ path }) {
  const { L, chats } = useApp();
  const [drawer, setDrawer] = useState(false);
  const conversationId = path.startsWith('/c/') ? safeDecode(path.slice(3)) : null;
  const page = path.startsWith('/cabinet') ? 'cabinet' : 'chat';
  const title =
    page === 'cabinet' ? L.cabinet : chats.find((c) => c.id === conversationId)?.title || (conversationId ? '' : L.newChat);

  useEffect(() => setDrawer(false), [path]);
  useEffect(() => {
    document.title = title && title !== L.newChat ? `${title} · Academy Concierge` : 'Academy Concierge · Picsart Academy';
  }, [title, L.newChat]);

  return (
    <div className={`shell ${drawer ? 'drawer-open' : ''}`}>
      <Sidebar activeId={conversationId} page={page} onClose={() => setDrawer(false)} />
      <div className="scrim" onClick={() => setDrawer(false)} aria-hidden="true" />
      <main className="main">
        <header className="topbar">
          <button type="button" className="icon-btn menu-btn" onClick={() => setDrawer(true)} aria-label={L.menu}>
            <MenuIcon />
          </button>
          <img className="topbar-cube" src="/brand/cube-64.png" alt="" width="28" height="26" />
          <h2 className="topbar-title">{title}</h2>
          <LangSwitch />
        </header>
        {page === 'cabinet' ? <Cabinet /> : <Chat conversationId={conversationId} />}
      </main>
      <Modals />
    </div>
  );
}

export default function App() {
  const path = usePath();
  if (path.startsWith('/admin')) return <Admin />;
  return (
    <AppProvider>
      <Shell path={path} />
    </AppProvider>
  );
}
