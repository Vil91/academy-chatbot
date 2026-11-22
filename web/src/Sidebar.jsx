import { useState } from 'react';
import { useApp } from './context.jsx';
import { fmtWhen } from './i18n.js';
import { CheckIcon, CloseIcon, PlusIcon, TrashIcon } from './icons.jsx';
import { linkTo, navigate } from './router.js';

export default function Sidebar({ activeId, page, onClose }) {
  const { L, lang, chats, user, openModal, removeChat } = useApp();
  const [confirming, setConfirming] = useState(null);

  async function remove(id) {
    setConfirming(null);
    await removeChat(id);
    if (id === activeId) navigate('/', { replace: true });
  }

  const initial = (user?.profile?.firstName?.[lang] || user?.name || '?').slice(0, 1).toUpperCase();

  return (
    <aside className="sidebar" aria-label={L.chats}>
      <div className="side-top">
        <a className="side-brand" href="/" onClick={linkTo('/', onClose)}>
          <img src="/brand/cube-128.png" alt="" width="38" height="35" />
          <span>
            <b>Academy Concierge</b>
            <small>Picsart Academy</small>
          </span>
        </a>
        <button type="button" className="icon-btn side-close" onClick={onClose} aria-label={L.close}>
          <CloseIcon />
        </button>
      </div>

      <button
        type="button"
        className="new-chat"
        onClick={() => {
          navigate('/');
          onClose();
        }}
      >
        <PlusIcon /> {L.newChat}
      </button>

      <div className="side-label">{L.chats}</div>
      <nav className="chat-list">
        {chats.length === 0 && <p className="side-empty">{L.emptyHistory}</p>}
        {chats.map((c) => (
          <div key={c.id} className={`chat-item ${c.id === activeId && page === 'chat' ? 'on' : ''}`}>
            {confirming === c.id ? (
              <div className="chat-confirm">
                <span>{L.confirmDelete}</span>
                <button type="button" onClick={() => remove(c.id)} aria-label={L.deleteChat}>
                  <CheckIcon width={16} height={16} />
                </button>
                <button type="button" onClick={() => setConfirming(null)} aria-label={L.cancel}>
                  <CloseIcon width={16} height={16} />
                </button>
              </div>
            ) : (
              <>
                <a href={`/c/${c.id}`} onClick={linkTo(`/c/${c.id}`, onClose)} title={c.title}>
                  <span className="chat-title">{c.title}</span>
                  {c.updatedAt && <small>{fmtWhen(c.updatedAt, lang)}</small>}
                </a>
                <button type="button" className="chat-del" onClick={() => setConfirming(c.id)} aria-label={L.deleteChat} title={L.deleteChat}>
                  <TrashIcon width={16} height={16} />
                </button>
              </>
            )}
          </div>
        ))}
      </nav>

      <div className="side-bottom">
        {user ? (
          <a className={`account ${page === 'cabinet' ? 'on' : ''}`} href="/cabinet" onClick={linkTo('/cabinet', onClose)}>
            <span className="account-avatar">{initial}</span>
            <span className="account-text">
              <b>{user.profile?.name?.[lang] || user.name}</b>
              <small>
                {L.cabinet}
                {user.isDemo ? ` · ${L.demo}` : ''}
              </small>
            </span>
          </a>
        ) : (
          <button type="button" className="btn btn-brand btn-block" onClick={() => openModal('auth')}>
            {L.signIn}
          </button>
        )}
      </div>
    </aside>
  );
}
