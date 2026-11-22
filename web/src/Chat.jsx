import { useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { t, fmtDate, fmtMonth } from './i18n.js';
import { getSessionId } from './storage.js';
import { InfoIcon, LogoutIcon, RefreshIcon, SendIcon } from './icons.jsx';

// "**bold**" inside a line.
function Inline({ text }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.length > 4 && part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}

// Paragraphs, plus "- " lines grouped into lists.
function Rich({ text }) {
  const blocks = [];
  let list = null;
  for (const line of text.split('\n')) {
    const item = line.match(/^\s*[-•*]\s+(.*)$/);
    if (item) {
      if (!list) {
        list = [];
        blocks.push({ type: 'ul', items: list });
      }
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

function StudentStrip({ student, lang, L, onSignOut }) {
  const month = new Date().toISOString().slice(0, 7);
  const pay = student.payments?.find((p) => p.month === month) || student.payments?.at(-1);
  const payDue = pay?.status !== 'paid';
  return (
    <div className="student-strip">
      <div className="student-who">
        <span className="student-avatar" aria-hidden="true">
          {(student.firstName?.[lang] || '?').slice(0, 1)}
        </span>
        <div>
          <div className="student-name">
            {student.name?.[lang]} <span className="badge">{L.demo}</span>
          </div>
          <div className="student-sub">
            {student.program} · {student.group}
          </div>
        </div>
      </div>
      <dl className="stats">
        <div className="stat">
          <dt>{L.attendance}</dt>
          <dd>{student.attendance?.percent}%</dd>
        </div>
        <div className="stat">
          <dt>{L.nextExam}</dt>
          <dd>{fmtDate(student.nextExam?.date, lang)}</dd>
        </div>
        {pay && (
          <div className={`stat ${payDue ? 'stat-warn' : 'stat-ok'}`}>
            <dt>
              {L.payment} · {fmtMonth(pay.month, lang)}
            </dt>
            <dd>{payDue ? L.dueBy(fmtDate(pay.dueDate, lang)) : L.paid}</dd>
          </div>
        )}
      </dl>
      <button type="button" className="icon-btn strip-out" onClick={onSignOut} aria-label={L.signOut} title={L.signOut}>
        <LogoutIcon />
      </button>
    </div>
  );
}

export default function Chat({ lang, student, onOpen, onSignOut }) {
  const L = t(lang);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const idRef = useRef(0);
  const nextId = () => ++idRef.current;

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const full = el.scrollHeight + (el.offsetHeight - el.clientHeight); // include borders
    el.style.height = `${Math.min(full, 160)}px`;
    el.style.overflowY = full > 160 ? 'auto' : 'hidden';
  }, [input]);

  async function ask(text, base) {
    const history = [...base, { role: 'user', content: text }].map(({ role, content }) => ({ role, content }));
    setLoading(true);
    setSlow(false);
    const timer = setTimeout(() => setSlow(true), 6000);
    try {
      const res = await api.chat({
        sessionId: getSessionId(),
        uiLang: lang,
        studentCode: student?.code,
        messages: history,
      });
      setMessages((prev) => [...prev, { id: nextId(), role: 'assistant', content: res.answer, meta: res }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'error', content: text, code: err.status === 429 ? 'tooMany' : 'error' },
      ]);
    } finally {
      clearTimeout(timer);
      setLoading(false);
      setSlow(false);
    }
  }

  function send(raw) {
    const text = (raw ?? input).trim();
    if (!text || loading) return;
    const base = messages.filter((m) => m.role !== 'error');
    setMessages([...base, { id: nextId(), role: 'user', content: text }]);
    setInput('');
    ask(text, base);
  }

  function retry() {
    const base = messages.filter((m) => m.role !== 'error');
    const lastUser = base.map((m) => m.role).lastIndexOf('user');
    if (lastUser === -1) return;
    setMessages(base);
    ask(base[lastUser].content, base.slice(0, lastUser));
  }

  function newChat() {
    setMessages([]);
    getSessionId(true);
    inputRef.current?.focus();
  }

  const suggestions = student ? L.suggestStudent : L.suggestGuest;

  return (
    <section className="chat-card" aria-label="Academy Concierge">
      {student && <StudentStrip student={student} lang={lang} L={L} onSignOut={onSignOut} />}

      <div className="messages" ref={listRef} aria-live="polite">
        {messages.length === 0 && (
          <div className="welcome">
            <h1>{student ? L.studentGreeting(student.firstName?.[lang]) : L.greetingTitle}</h1>
            <p>{student ? L.studentGreetingText : L.greeting}</p>
            <div className="suggest-label">{L.tryAsking}</div>
            <div className="suggestions">
              {suggestions.map((q) => (
                <button type="button" key={q} className="suggestion" onClick={() => send(q)}>
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => {
          if (m.role === 'user') {
            return (
              <div className="row row-user" key={m.id}>
                <div className="bubble-user">{m.content}</div>
              </div>
            );
          }
          if (m.role === 'error') {
            return (
              <div className="row row-bot" key={m.id}>
                <span className="avatar" aria-hidden="true">
                  Ա
                </span>
                <div className="error-box" role="alert">
                  <span>{L[m.code]}</span>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={retry}>
                    {L.retry}
                  </button>
                </div>
              </div>
            );
          }
          const M = t(m.meta?.lang || lang);
          return (
            <div className="row row-bot" key={m.id}>
              <span className="avatar" aria-hidden="true">
                Ա
              </span>
              <div className="bot">
                <div className="rich">
                  <Rich text={m.content} />
                </div>
                {m.meta?.handoff && (
                  <div className="handoff">
                    <InfoIcon />
                    <span>{M.handoff}</span>
                  </div>
                )}
                {m.meta?.action === 'lead_form' && (
                  <button type="button" className="btn btn-primary btn-sm action" onClick={() => onOpen('lead')}>
                    {M.leadCta}
                  </button>
                )}
                {m.meta?.action === 'excuse_form' && student && (
                  <button type="button" className="btn btn-primary btn-sm action" onClick={() => onOpen('excuse')}>
                    {M.excuseCta}
                  </button>
                )}
                {m.meta?.sources?.length > 0 && (
                  <div className="sources">
                    {m.meta.sources.map((s) => (
                      <span className="source" key={s}>
                        <span className="source-k">{M.source}</span> {M.sourceNames[s] || s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="row row-bot">
            <span className="avatar" aria-hidden="true">
              Ա
            </span>
            <div className="typing">
              <span className="dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              {slow && <span className="typing-note">{L.slow}</span>}
            </div>
          </div>
        )}
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        {messages.length > 0 && (
          <button type="button" className="icon-btn" onClick={newChat} aria-label={L.newChat} title={L.newChat}>
            <RefreshIcon />
          </button>
        )}
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          maxLength={1000}
          placeholder={L.placeholder}
          aria-label={L.placeholder}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button className="send-btn" disabled={!input.trim() || loading} aria-label={L.send} title={L.send}>
          <SendIcon />
        </button>
      </form>
    </section>
  );
}
