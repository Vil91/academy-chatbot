import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { api, attachmentUrl, streamChat } from './api.js';
import { useApp } from './context.jsx';
import { fmtDate, fmtMonth, t } from './i18n.js';
import { ACCEPT, prepareFile } from './images.js';
import { navigate } from './router.js';
import { CloseIcon, FileIcon, InfoIcon, MicIcon, PaperclipIcon, ReceiptIcon, SendIcon } from './icons.jsx';

// ---- rich text: paragraphs, "- " lists and **bold** ------------------------

function Inline({ text }) {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .map((part, i) =>
      part.length > 4 && part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
    );
}

function Rich({ text }) {
  const blocks = [];
  let list = null;
  for (const line of text.split('\n')) {
    const item = line.match(/^\s*[-•*]\s+(.*)$/);
    if (item) {
      if (!list) blocks.push({ type: 'ul', items: (list = []) });
      list.push(item[1]);
    } else {
      list = null;
      if (line.trim()) blocks.push({ type: 'p', text: line.trim() });
    }
  }
  return blocks.map((b, i) =>
    b.type === 'ul' ? (
      <ul key={i}>
        {b.items.map((it, j) => (
          <li key={j}>
            <Inline text={it} />
          </li>
        ))}
      </ul>
    ) : (
      <p key={i}>
        <Inline text={b.text} />
      </p>
    ),
  );
}

// ---- pieces -----------------------------------------------------------------

const Avatar = () => (
  <span className="bot-avatar" aria-hidden="true">
    <img src="/brand/cube-64.png" alt="" width="22" height="20" />
  </span>
);

function Attachments({ items }) {
  if (!items?.length) return null;
  return (
    <div className="msg-files">
      {items.map((a) =>
        a.mime?.startsWith('image/') ? (
          <a key={a.id} href={a.preview || attachmentUrl(a.id)} target="_blank" rel="noreferrer" className="msg-image">
            <img src={a.preview || attachmentUrl(a.id)} alt={a.name} loading="lazy" />
          </a>
        ) : (
          <a key={a.id} href={attachmentUrl(a.id)} target="_blank" rel="noreferrer" className="msg-file">
            <FileIcon /> <span>{a.name}</span>
          </a>
        ),
      )}
    </div>
  );
}

function BotMessage({ m, conversationId }) {
  const { lang, user, openModal } = useApp();
  const M = t(m.meta?.lang || lang); // labels follow the language of the answer
  const meta = m.meta || {};
  return (
    <div className="row row-bot">
      <Avatar />
      <div className="bot">
        <div className={`rich ${m.streaming ? 'is-streaming' : ''}`}>
          <Rich text={m.content} />
        </div>
        {meta.paymentProofId && (
          <div className="notice notice-brand">
            <ReceiptIcon />
            <span>
              {M.paymentSent}
              {meta.payment?.month ? ` · ${fmtMonth(meta.payment.month, meta.lang || lang)}` : ''}
            </span>
            <a
              href="/cabinet"
              onClick={(e) => {
                e.preventDefault();
                navigate('/cabinet');
              }}
            >
              {M.openCabinet}
            </a>
          </div>
        )}
        {meta.handoff && (
          <div className="notice notice-info">
            <InfoIcon />
            <span>{M.handoff}</span>
          </div>
        )}
        {meta.action === 'lead_form' && (
          <button type="button" className="btn btn-brand btn-sm action" onClick={() => openModal('lead', { conversationId })}>
            {M.leadCta}
          </button>
        )}
        {meta.action === 'excuse_form' && (
          <button
            type="button"
            className="btn btn-brand btn-sm action"
            onClick={() => openModal(user ? 'excuse' : 'auth')}
          >
            {user ? M.excuseCta : M.signInCta}
          </button>
        )}
        {meta.sources?.length > 0 && (
          <div className="sources">
            {meta.sources.map((s) => (
              <span className="source" key={s}>
                <span className="source-k">{M.source}</span>
                {M.sourceNames[s] || s}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Waiting({ phase }) {
  const { L } = useApp();
  return (
    <div className="row row-bot">
      <Avatar />
      <div className="typing">
        <span className="dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        {phase > 0 && <span className="typing-note">{phase === 1 ? L.wait1 : L.wait2}</span>}
      </div>
    </div>
  );
}

function StudentChips({ user }) {
  const { L, lang } = useApp();
  const p = user.profile;
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const pay = p.payments?.find((x) => x.month === month) || p.payments?.at(-1);
  return (
    <div className="chips">
      <span className="chip">
        {L.attendance}: <b>{p.attendance?.percent != null ? `${p.attendance.percent}%` : '—'}</b>
      </span>
      {p.nextExam && (
        <span className="chip">
          {L.nextExam}: <b>{fmtDate(p.nextExam.date, lang)}</b>
        </span>
      )}
      {pay && (
        <span className={`chip ${pay.status === 'paid' ? 'chip-ok' : 'chip-warn'}`}>
          {fmtMonth(pay.month, lang)}: <b>{pay.status === 'paid' ? L.paid : L.dueBy(fmtDate(pay.dueDate, lang))}</b>
        </span>
      )}
    </div>
  );
}

function Welcome({ onAsk }) {
  const { L, lang, user, signedIn, openModal } = useApp();
  const [demoBusy, setDemoBusy] = useState(false);
  const first = user?.profile?.firstName?.[lang] || user?.name?.split(' ')[0];

  async function quickDemo() {
    setDemoBusy(true);
    try {
      signedIn((await api.demo(lang)).user);
    } finally {
      setDemoBusy(false);
    }
  }

  return (
    <div className="welcome">
      <img className="welcome-cube" src="/brand/cube-256.png" alt="" width="84" height="78" />
      <h1>{user ? L.studentGreeting(first) : L.greetingTitle}</h1>
      <p>{user ? L.studentGreetingText : L.greeting}</p>
      {user ? (
        <StudentChips user={user} />
      ) : (
        <div className="welcome-actions">
          <button type="button" className="btn btn-brand btn-sm" onClick={quickDemo} disabled={demoBusy}>
            {L.tryDemo}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => openModal({ type: 'auth', tab: 'signin' })}>
            {L.signIn}
          </button>
        </div>
      )}
      <div className="suggest-label">{L.tryAsking}</div>
      <div className="suggestions">
        {(user ? L.suggestStudent : L.suggestGuest).map((q) => (
          <button type="button" key={q} className="suggestion" onClick={() => onAsk(q)}>
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- composer ---------------------------------------------------------------

const SPEECH_LANG = { hy: 'hy-AM', ru: 'ru-RU', en: 'en-US' };

const Composer = forwardRef(function Composer({ busy, onSend }, ref) {
  const { L, lang } = useApp();
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [listening, setListening] = useState(false);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const keyRef = useRef(0);
  const recRef = useRef(null);
  const speechOk = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => () => recRef.current?.stop(), []);

  function toggleVoice() {
    if (!speechOk) return;
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = SPEECH_LANG[lang] || 'ru-RU';
    rec.interimResults = true;
    rec.continuous = false;
    const base = text.trim() ? `${text.trim()} ` : '';
    rec.onresult = (e) => {
      const spoken = [...e.results].map((r) => r[0].transcript).join('');
      setText((base + spoken).slice(0, 1000));
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const full = el.scrollHeight + (el.offsetHeight - el.clientHeight);
    el.style.height = `${Math.min(full, 180)}px`;
    el.style.overflowY = full > 180 ? 'auto' : 'hidden';
  }, [text]);

  async function addFiles(list) {
    setError('');
    const room = Math.max(0, 4 - files.length);
    for (const original of [...list].slice(0, room)) {
      const key = ++keyRef.current;
      setFiles((fs) => [...fs, { key, name: original.name, mime: original.type, status: 'uploading' }]);
      try {
        const file = await prepareFile(original);
        const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
        setFiles((fs) => fs.map((f) => (f.key === key ? { ...f, name: file.name, mime: file.type, preview } : f)));
        const saved = await api.upload(file);
        setFiles((fs) => fs.map((f) => (f.key === key ? { ...f, id: saved.id, status: 'ready' } : f)));
      } catch (err) {
        setFiles((fs) => fs.filter((f) => f.key !== key));
        setError(L.uploadErrors[err.code] || L.uploadErrors.error);
      }
    }
  }

  useImperativeHandle(ref, () => ({ addFiles, focus: () => inputRef.current?.focus() }));

  const uploading = files.some((f) => f.status === 'uploading');
  const canSend = !busy && !uploading && (text.trim() || files.length > 0);

  function submit(e) {
    e?.preventDefault();
    if (!canSend) return;
    onSend(
      text.trim(),
      files.map(({ id, name, mime, preview }) => ({ id, name, mime, preview })),
    );
    setText('');
    setFiles([]);
  }

  return (
    <form className="composer" onSubmit={submit}>
      <div className="composer-box">
        {files.length > 0 && (
          <div className="composer-files">
            {files.map((f) => (
              <div key={f.key} className={`file-chip ${f.status}`}>
                {f.preview ? <img src={f.preview} alt="" /> : <FileIcon />}
                <span>{f.name}</span>
                {f.status === 'uploading' ? (
                  <i className="spinner" aria-hidden="true" />
                ) : (
                  <button
                    type="button"
                    aria-label={L.close}
                    onClick={() => setFiles((fs) => fs.filter((x) => x.key !== f.key))}
                  >
                    <CloseIcon width={14} height={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="composer-row">
          <button
            type="button"
            className="attach-btn"
            onClick={() => fileRef.current?.click()}
            aria-label={L.attach}
            title={L.attach}
            disabled={files.length >= 4}
          >
            <PaperclipIcon />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            multiple
            hidden
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <textarea
            ref={inputRef}
            rows={1}
            value={text}
            maxLength={1000}
            placeholder={L.placeholder}
            aria-label={L.placeholder}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => {
              if (e.clipboardData?.files?.length) {
                e.preventDefault();
                addFiles(e.clipboardData.files);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
          />
          {speechOk && (
            <button
              type="button"
              className={`attach-btn mic-btn ${listening ? 'is-rec' : ''}`}
              onClick={toggleVoice}
              aria-label={listening ? L.voiceStop : L.voiceStart}
              title={listening ? L.voiceStop : L.voiceStart}
              disabled={busy}
            >
              <MicIcon />
            </button>
          )}
          <button className="send-btn" disabled={!canSend} aria-label={L.send} title={L.send}>
            <SendIcon />
          </button>
        </div>
      </div>
      {error ? (
        <p className="composer-error" role="alert">
          {error}
        </p>
      ) : (
        <p className="composer-hint">
          {L.footer}
          <span className="hide-mobile"> · {L.composerHint}</span>
        </p>
      )}
    </form>
  );
});

// ---- chat -------------------------------------------------------------------

export default function Chat({ conversationId }) {
  const { L, lang, upsertChat, refreshChats } = useApp();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState(0);
  const [dragging, setDragging] = useState(false);
  const currentId = useRef(null); // the conversation shown here
  const streamToken = useRef(0);
  const abortRef = useRef(null);
  const listRef = useRef(null);
  const composerRef = useRef(null);
  const timers = useRef([]);

  const stopWaiting = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPhase(0);
  };

  // Follow the URL: open a saved conversation, or start empty on "/".
  useEffect(() => {
    if (conversationId === currentId.current) return;
    abortRef.current?.abort();
    streamToken.current += 1;
    stopWaiting();
    setBusy(false);
    currentId.current = conversationId;
    if (!conversationId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setMessages([]);
    api
      .conversation(conversationId)
      .then((d) => !cancelled && setMessages(d.messages))
      .catch(() => {
        if (cancelled) return;
        currentId.current = null;
        navigate('/', { replace: true });
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  // Keep the newest message in view.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  async function send(text, attachments = []) {
    if (busy) return;
    const token = ++streamToken.current;
    const controller = new AbortController();
    abortRef.current = controller;
    const userMsg = {
      id: `u-${token}`,
      role: 'user',
      content: text,
      meta: attachments.length ? { attachments } : null,
    };
    const botId = `a-${token}`;
    setMessages((ms) => [...ms.filter((m) => m.role !== 'error'), userMsg]);
    setBusy(true);
    timers.current = [setTimeout(() => setPhase(1), 6000), setTimeout(() => setPhase(2), 20000)];

    let removed = false;
    try {
      await streamChat(
        {
          conversationId: currentId.current,
          message: text,
          attachmentIds: attachments.map((a) => a.id),
          uiLang: lang,
        },
        {
          signal: controller.signal,
          onEvent: (event, data) => {
            if (token !== streamToken.current) return;
            if (event === 'start') {
              const c = data.conversation;
              if (c.isNew) {
                currentId.current = c.id;
                navigate(`/c/${c.id}`, { replace: true });
                upsertChat({ id: c.id, title: c.title, updatedAt: null, preview: '' });
              }
            } else if (event === 'delta') {
              stopWaiting();
              setMessages((ms) =>
                ms.some((m) => m.id === botId)
                  ? ms.map((m) => (m.id === botId ? { ...m, content: m.content + data.t } : m))
                  : [...ms, { id: botId, role: 'assistant', content: data.t, streaming: true }],
              );
            } else if (event === 'done') {
              setMessages((ms) => [...ms.filter((m) => m.id !== botId), data.message]);
              refreshChats();
            } else if (event === 'error') {
              removed = data.conversationRemoved;
              throw new Error(data.error);
            }
          },
        },
      );
    } catch (err) {
      if (err.name === 'AbortError' || token !== streamToken.current) return;
      if (removed) {
        currentId.current = null;
        navigate('/', { replace: true });
        refreshChats();
      }
      setMessages((ms) => [
        ...ms.filter((m) => m.id !== botId && m.id !== userMsg.id),
        userMsg,
        { id: `e-${token}`, role: 'error', code: err.status === 429 ? 'tooMany' : 'error', retry: { text, attachments } },
      ]);
    } finally {
      if (token === streamToken.current) {
        stopWaiting();
        setBusy(false);
      }
    }
  }

  function retry(m) {
    setMessages((ms) => ms.filter((x) => x.id !== m.id && x.id !== `u-${m.id.slice(2)}`));
    send(m.retry.text, m.retry.attachments);
  }

  const showWelcome = !loading && messages.length === 0 && !busy;

  return (
    <div
      className={`chat ${dragging ? 'is-dragging' : ''}`}
      onDragOver={(e) => {
        if ([...(e.dataTransfer?.types || [])].includes('Files')) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer?.files?.length) composerRef.current?.addFiles(e.dataTransfer.files);
      }}
    >
      <div className="messages" ref={listRef} aria-live="polite">
        <div className="messages-inner">
          {showWelcome && <Welcome onAsk={(q) => send(q)} />}
          {loading && <div className="loading-chat" aria-hidden="true" />}
          {messages.map((m) => {
            if (m.role === 'user') {
              return (
                <div className="row row-user" key={m.id}>
                  <div className="user-msg">
                    <Attachments items={m.meta?.attachments} />
                    {m.content && <div className="bubble-user">{m.content}</div>}
                  </div>
                </div>
              );
            }
            if (m.role === 'error') {
              return (
                <div className="row row-bot" key={m.id}>
                  <Avatar />
                  <div className="error-box" role="alert">
                    <span>{L[m.code]}</span>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => retry(m)}>
                      {L.retry}
                    </button>
                  </div>
                </div>
              );
            }
            return <BotMessage key={m.id} m={m} conversationId={currentId.current} />;
          })}
          {busy && !messages.some((m) => m.streaming) && <Waiting phase={phase} />}
        </div>
      </div>

      {dragging && (
        <div className="drop-hint" aria-hidden="true">
          <PaperclipIcon width={28} height={28} />
          {L.dropHere}
        </div>
      )}

      <Composer ref={composerRef} busy={busy} onSend={send} />
    </div>
  );
}
