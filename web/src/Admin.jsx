import { useEffect, useState } from 'react';
import { api } from './api.js';
import { fmtAmount } from './i18n.js';
import { CheckIcon, CloseIcon, CopyIcon, DownloadIcon, RefreshIcon } from './icons.jsx';
import { sessionGet, sessionSet } from './storage.js';

const TABS = [
  ['payments', 'Payments'],
  ['handoffs', 'Handoffs'],
  ['inbox', 'Inbox assistant'],
  ['analytics', 'Analytics'],
  ['leads', 'Leads'],
  ['absences', 'Absences'],
  ['users', 'Users'],
];

function Analytics({ analytics }) {
  if (!analytics) return <p className="admin-empty">No analytics yet.</p>;
  const langTotal = Math.max(1, (analytics.byLang?.hy || 0) + (analytics.byLang?.ru || 0) + (analytics.byLang?.en || 0));
  const maxSrc = Math.max(1, ...(analytics.topSources || []).map((s) => s.count));
  const langs = [
    ['ՀԱՅ (Armenian)', analytics.byLang?.hy || 0],
    ['РУС (Russian)', analytics.byLang?.ru || 0],
    ['ENG (English)', analytics.byLang?.en || 0],
  ];
  return (
    <div className="analytics-wrap">
      <div className="tiles">
        <div className="tile">
          <small>AI Deflection Rate</small>
          <b>{analytics.deflectionRate}%</b>
        </div>
        <div className="tile">
          <small>Avg Confidence</small>
          <b>{analytics.avgConfidence}%</b>
        </div>
        <div className="tile">
          <small>Web / Telegram Chats</small>
          <b>
            {analytics.channels?.web ?? 0} / {analytics.channels?.telegram ?? 0}
          </b>
        </div>
        <div className="tile">
          <small>Channels & Auth</small>
          <span className="status-pills">
            <span className={`pill pill-${analytics.telegramActive ? 'paid' : 'pending'}`}>
              Telegram {analytics.telegramActive ? 'ON' : 'Ready'}
            </span>
            <span className={`pill pill-${analytics.googleAuthActive ? 'paid' : 'pending'}`}>
              Google {analytics.googleAuthActive ? 'ON' : 'Ready'}
            </span>
          </span>
        </div>
      </div>

      <div className="analytics-grid">
        <div className="analytics-card">
          <h3>Questions by language</h3>
          <div className="bar-list">
            {langs.map(([label, n]) => (
              <div key={label} className="bar-row">
                <div className="bar-head">
                  <span>{label}</span>
                  <b>{n}</b>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${Math.round((n / langTotal) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="analytics-card">
          <h3>Top knowledge sources cited</h3>
          {analytics.topSources?.length ? (
            <div className="bar-list">
              {analytics.topSources.map((s) => (
                <div key={s.id} className="bar-row">
                  <div className="bar-head">
                    <span>{s.id}</span>
                    <b>{s.count}</b>
                  </div>
                  <div className="bar-track">
                    <div className="bar-fill bar-fill-aqua" style={{ width: `${Math.round((s.count / maxSrc) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted small">No answers recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Table({ rows, columns, empty }) {
  if (!rows.length) return <p className="admin-empty">{empty}</p>;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id ?? i}>
              {columns.map((c) => (
                <td key={c.key}>{c.render ? c.render(r) : (r[c.key] ?? '—')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProofImage({ adminKey, id }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let url;
    api.admin
      .attachmentBlob(adminKey, id)
      .then((u) => setSrc((url = u)))
      .catch(() => setSrc(null));
    return () => url && URL.revokeObjectURL(url);
  }, [adminKey, id]);
  return src ? (
    <a href={src} target="_blank" rel="noreferrer" className="proof-img">
      <img src={src} alt="Receipt" />
    </a>
  ) : (
    <div className="proof-img proof-img-empty" />
  );
}

function Conversation({ adminKey, id, onClose }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.admin.conversation(adminKey, id).then(setData).catch(() => setData({ messages: [] }));
  }, [adminKey, id]);
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog dialog-wide" role="dialog" aria-modal="true">
        <div className="dialog-head">
          <h2>{data?.conversation?.title || 'Conversation'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="convo">
          {data?.messages?.map((m) => (
            <div key={m.id} className={`convo-msg convo-${m.role}`}>
              <small>{m.role === 'user' ? 'Student' : 'Concierge'}</small>
              {m.content && <p>{m.content.replace(/\*\*(.+?)\*\*/g, '$1')}</p>}
              {m.meta?.attachments?.length > 0 && (
                <p className="muted small">📎 {m.meta.attachments.map((a) => a.name).join(', ')}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Inbox({ adminKey }) {
  const [email, setEmail] = useState('');
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  async function run(e) {
    e.preventDefault();
    if (email.trim().length < 10) return;
    setBusy(true);
    setError('');
    setDraft(null);
    try {
      setDraft(await api.admin.emailDraft(adminKey, email));
    } catch {
      setError('Could not draft a reply. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inbox">
      <form className="form" onSubmit={run}>
        <label className="field">
          <span>Student email</span>
          <textarea
            rows={7}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Paste an email from a student or applicant (Armenian, Russian or English)…"
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-brand" disabled={busy || email.trim().length < 10}>
          {busy ? 'Drafting…' : 'Draft a reply'}
        </button>
      </form>
      <div className="inbox-draft">
        {draft ? (
          <>
            <div className="draft-head">
              <b>{draft.subject || 'Draft'}</b>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  navigator.clipboard?.writeText(`${draft.subject ? `${draft.subject}\n\n` : ''}${draft.reply}`);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                <CopyIcon /> {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="draft-body">{draft.reply}</pre>
            {draft.missing?.length > 0 && (
              <p className="draft-missing">
                <b>Fill in before sending:</b> {draft.missing.join(' · ')}
              </p>
            )}
            {draft.sources?.length > 0 && <p className="muted small">Based on: {draft.sources.join(', ')}</p>}
          </>
        ) : (
          <p className="muted">
            The assistant drafts a reply from the approved knowledge base. Facts it does not have are left as [placeholders] for you to fill in.
          </p>
        )}
      </div>
    </div>
  );
}

export default function Admin() {
  const [key, setKey] = useState(() => sessionGet('ac_admin') || '');
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('payments');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [openConvo, setOpenConvo] = useState(null);

  async function load(k = key) {
    if (!k) return;
    setBusy(true);
    setError('');
    try {
      setData(await api.admin.summary(k));
      sessionSet('ac_admin', k);
    } catch (err) {
      setData(null);
      setError(err.status === 401 ? 'Wrong admin key.' : 'Could not load the data.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    document.documentElement.lang = 'en';
    if (key) load(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function review(id, status) {
    await api.admin.setProof(key, id, status);
    load();
  }

  async function closeHandoff(id, status) {
    await api.admin.setHandoff(key, id, status);
    load();
  }

  if (!data) {
    return (
      <div className="admin admin-login">
        <img src="/brand/cube-256.png" alt="" width="64" height="59" />
        <h1>Coordinator panel</h1>
        <p className="muted">Academy Concierge · Picsart Academy</p>
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            load();
          }}
        >
          <label className="field">
            <span>Admin key</span>
            <input type="password" value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off" />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="btn btn-brand btn-block" disabled={busy || !key}>
            Open
          </button>
        </form>
        <a className="admin-back" href="/">
          ← Back to the chat
        </a>
      </div>
    );
  }

  const c = data.counts;
  const tiles = [
    ['Pending payments', c.pendingPayments, 'payments', c.pendingPayments > 0],
    ['Open handoffs', c.openHandoffs, 'handoffs', c.openHandoffs > 0],
    ['Leads', c.leads, 'leads'],
    ['Absence notes', c.excuses, 'absences'],
    ['Students', c.users, 'users'],
    ['Conversations', c.conversations],
  ];

  return (
    <div className="admin">
      <header className="admin-top">
        <div className="admin-brand">
          <img src="/brand/cube-128.png" alt="" width="40" height="37" />
          <div>
            <h1>Coordinator panel</h1>
            <p className="muted small">Academy Concierge · {c.demoSessions} demo sessions · {c.questions} questions asked</p>
          </div>
        </div>
        <div className="admin-actions">
          <a className="btn btn-ghost" href="/">
            Open chat
          </a>
          <button type="button" className="btn btn-ghost" onClick={() => load()} disabled={busy}>
            <RefreshIcon /> Refresh
          </button>
        </div>
      </header>

      <div className="tiles">
        {tiles.map(([label, value, target, hot]) => (
          <button
            type="button"
            key={label}
            className={`tile ${hot ? 'tile-hot' : ''} ${target === tab ? 'on' : ''}`}
            onClick={() => target && setTab(target)}
            disabled={!target}
          >
            <span>{label}</span>
            <strong>{value}</strong>
          </button>
        ))}
      </div>

      <div className="admin-tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'payments' &&
        (data.paymentProofs.length ? (
          <div className="proof-grid">
            {data.paymentProofs.map((p) => (
              <article key={p.id} className={`proof-card status-${p.status}`}>
                {p.attachment_id ? <ProofImage adminKey={key} id={p.attachment_id} /> : <div className="proof-img proof-img-empty" />}
                <div className="proof-body">
                  <div className="proof-top">
                    <b>{p.user_name}</b>
                    <span className={`pill pill-${p.status === 'approved' ? 'paid' : p.status === 'rejected' ? 'rejected' : 'pending'}`}>{p.status}</span>
                  </div>
                  <dl>
                    <dt>Amount</dt>
                    <dd>{fmtAmount(p.amount, p.currency) || '—'}</dd>
                    <dt>For month</dt>
                    <dd>{p.month || '—'}</dd>
                    <dt>Paid on</dt>
                    <dd>{p.paid_date || '—'}</dd>
                    <dt>Reference</dt>
                    <dd>{p.reference || '—'}</dd>
                    <dt>Student</dt>
                    <dd>{p.user_code}</dd>
                  </dl>
                  {p.status === 'pending' && (
                    <div className="proof-actions">
                      <button type="button" className="btn btn-brand btn-sm" onClick={() => review(p.id, 'approved')}>
                        <CheckIcon /> Confirm
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => review(p.id, 'rejected')}>
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="admin-empty">No receipts yet. Students send them in the chat or from their account.</p>
        ))}

      {tab === 'handoffs' && (
        <Table
          rows={data.handoffs}
          empty="No questions needed a person yet."
          columns={[
            { key: 'created_at', label: 'Time (UTC)' },
            { key: 'lang', label: 'Lang' },
            { key: 'question', label: 'Question' },
            {
              key: 'actions',
              label: '',
              render: (h) => (
                <span className="row-actions">
                  {h.conversation_id && (
                    <button type="button" className="link-btn" onClick={() => setOpenConvo(h.conversation_id)}>
                      View chat
                    </button>
                  )}
                  <button type="button" className="link-btn" onClick={() => closeHandoff(h.id, h.status === 'open' ? 'closed' : 'open')}>
                    {h.status === 'open' ? 'Mark done' : 'Reopen'}
                  </button>
                </span>
              ),
            },
            { key: 'status', label: 'Status', render: (h) => <span className={`pill pill-${h.status === 'open' ? 'pending' : 'paid'}`}>{h.status}</span> },
          ]}
        />
      )}

      {tab === 'inbox' && <Inbox adminKey={key} />}

      {tab === 'analytics' && <Analytics analytics={data.analytics} />}

      {tab === 'leads' && (
        <>
          <div className="tab-toolbar">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!data.leads.length}
              onClick={async () => {
                const blob = await api.admin.exportLeadsCsv(key);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'academy-leads.csv';
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              <DownloadIcon width={15} height={15} /> Export CSV
            </button>
          </div>
          <Table
            rows={data.leads}
            empty="No entry test requests yet."
            columns={[
              { key: 'created_at', label: 'Time (UTC)' },
              { key: 'name', label: 'Name' },
              { key: 'contact', label: 'Contact' },
              { key: 'interest', label: 'Program' },
              { key: 'preferred_time', label: 'Preferred time' },
              { key: 'lang', label: 'Lang' },
              {
                key: 'chat',
                label: '',
                render: (l) =>
                  l.conversation_id ? (
                    <button type="button" className="link-btn" onClick={() => setOpenConvo(l.conversation_id)}>
                      View chat
                    </button>
                  ) : null,
              },
            ]}
          />
        </>
      )}

      {tab === 'absences' && (
        <Table
          rows={data.excuses}
          empty="No absence notes yet."
          columns={[
            { key: 'created_at', label: 'Sent (UTC)' },
            { key: 'user_name', label: 'Student' },
            { key: 'user_code', label: 'Code' },
            { key: 'date', label: 'Date' },
            { key: 'reason', label: 'Reason' },
          ]}
        />
      )}

      {tab === 'users' && (
        <Table
          rows={data.users}
          empty="No accounts yet."
          columns={[
            { key: 'created_at', label: 'Created (UTC)' },
            { key: 'name', label: 'Name' },
            { key: 'code', label: 'Code' },
            { key: 'email', label: 'Email', render: (u) => (u.is_demo ? <span className="muted">demo</span> : u.email) },
            { key: 'program', label: 'Program' },
          ]}
        />
      )}

      {openConvo && <Conversation adminKey={key} id={openConvo} onClose={() => setOpenConvo(null)} />}
    </div>
  );
}
