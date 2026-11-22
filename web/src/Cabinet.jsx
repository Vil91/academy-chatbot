import { useCallback, useEffect, useRef, useState } from 'react';
import { api, attachmentUrl } from './api.js';
import { useApp } from './context.jsx';
import { fmtAmount, fmtDate, fmtMonth } from './i18n.js';
import { prepareFile } from './images.js';
import { CalendarIcon, ChatIcon, LogoutIcon, ReceiptIcon } from './icons.jsx';
import { navigate } from './router.js';

const WEEK_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function Card({ title, icon, action, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      <div className="card-head">
        <h2>
          {icon}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function Cabinet() {
  const { L, lang, user, userLoaded, openModal, signOut } = useApp();
  const [data, setData] = useState(null);
  const [upload, setUpload] = useState({ month: null, busy: false, error: '' });
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    try {
      setData(await api.cabinet());
    } catch {
      setData(null);
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (!userLoaded) return <div className="page" />;
  if (!user) {
    return (
      <div className="page page-center">
        <img src="/brand/cube-256.png" alt="" width="84" height="78" />
        <h1>{L.cabinet}</h1>
        <p className="muted">{L.cabinetSignInHint}</p>
        <button type="button" className="btn btn-brand" onClick={() => openModal('auth')}>
          {L.signIn}
        </button>
      </div>
    );
  }

  const p = (data?.user || user).profile;
  const pick = (v) => (v && typeof v === 'object' ? v[lang] || v.en || Object.values(v)[0] : v);
  const name = pick(p.name) || user.name;
  const att = p.attendance || {};
  const proofs = data?.paymentProofs || [];
  const pendingFor = (month) => proofs.find((x) => x.month === month && x.status === 'pending');

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUpload((u) => ({ ...u, busy: true, error: '' }));
    try {
      const prepared = await prepareFile(file);
      if (!prepared.type.startsWith('image/')) throw Object.assign(new Error(), { code: 'image_only' });
      const saved = await api.upload(prepared);
      await api.paymentProof({ attachmentId: saved.id, month: upload.month });
      await load();
      setUpload({ month: null, busy: false, error: '' });
    } catch (err) {
      setUpload((u) => ({ ...u, busy: false, error: L.uploadErrors[err.code] || L.uploadErrors.error }));
    }
  }

  function pickReceipt(month) {
    setUpload({ month, busy: false, error: '' });
    fileRef.current?.click();
  }

  const schedule = [...(p.schedule || [])].sort((a, b) => WEEK_ORDER.indexOf(a.day) - WEEK_ORDER.indexOf(b.day));
  const thisMonth = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Yerevan', year: 'numeric', month: '2-digit' }).format(new Date());
  const current = p.payments?.find((x) => x.month === thisMonth) || p.payments?.at(-1);

  return (
    <div className="page">
      <div className="page-inner">
        <header className="profile">
          <span className="profile-avatar">{name.slice(0, 1).toUpperCase()}</span>
          <div className="profile-text">
            <h1>
              {name}
              {user.isDemo && <span className="badge">{L.demo}</span>}
            </h1>
            <p>
              {p.program} · {pick(p.group)}
            </p>
            <p className="muted small">
              {L.code}: <b>{user.code}</b>
              {user.email ? ` · ${user.email}` : ''}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={async () => {
              await signOut();
              navigate('/');
            }}
          >
            <LogoutIcon /> <span className="hide-mobile">{L.signOut}</span>
          </button>
        </header>

        {user.isDemo && <p className="demo-note">{L.demoNote}</p>}

        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">{L.attendance}</span>
            <strong>{att.percent != null ? `${att.percent}%` : '—'}</strong>
            <div className="meter" aria-hidden="true">
              <i style={{ width: `${att.percent || 0}%` }} />
            </div>
            <span className="stat-sub">{att.total ? L.classesOf(att.attended, att.total) : L.noClassesYet}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">{L.nextExam}</span>
            <strong>{p.nextExam ? fmtDate(p.nextExam.date, lang) : '—'}</strong>
            <span className="stat-sub">{p.nextExam ? pick(p.nextExam.topic) : L.noExam}</span>
          </div>
          {current && (
            <div
              className={`stat-card ${current.status === 'paid' ? 'stat-ok' : pendingFor(current.month) ? 'stat-pending' : 'stat-warn'}`}
            >
              <span className="stat-label">
                {L.payment} · {fmtMonth(current.month, lang)}
              </span>
              <strong>{current.status === 'paid' ? L.paid : pendingFor(current.month) ? L.pending : L.dueBy(fmtDate(current.dueDate, lang))}</strong>
              {current.status !== 'paid' && !pendingFor(current.month) && (
                <button type="button" className="btn btn-dark btn-sm" onClick={() => pickReceipt(current.month)} disabled={upload.busy}>
                  <ReceiptIcon /> {L.uploadReceipt}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="cards">
          <Card title={L.schedule} icon={<CalendarIcon />} className="card-schedule">
            <ul className="schedule">
              {schedule.map((s, i) => (
                <li key={i}>
                  <span className="sched-day">{L.weekdays[s.day] || s.day}</span>
                  <span className="sched-time">{s.time}</span>
                  <span className="sched-topic">
                    {pick(s.topic)}
                    <small>{pick(s.room)}</small>
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title={L.payments} icon={<ReceiptIcon />}>
            <ul className="pay-list">
              {[...(p.payments || [])].reverse().map((pay) => {
                const pending = pendingFor(pay.month);
                const state = pay.status === 'paid' ? 'paid' : pending ? 'pending' : 'due';
                return (
                  <li key={pay.month}>
                    <span className="pay-month">{fmtMonth(pay.month, lang)}</span>
                    <span className={`pill pill-${state}`}>
                      {state === 'paid' ? L.paid : state === 'pending' ? L.pending : L.dueBy(fmtDate(pay.dueDate, lang))}
                    </span>
                    {state === 'due' && (
                      <button type="button" className="link-btn" onClick={() => pickReceipt(pay.month)} disabled={upload.busy}>
                        {L.uploadReceipt}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            {upload.busy && <p className="muted small">{L.reading}</p>}
            {upload.error && <p className="form-error">{upload.error}</p>}
            <p className="muted small">{L.receiptHint}</p>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onFile} />

            {proofs.length > 0 && (
              <>
                <h3 className="sub-head">{L.receipts}</h3>
                <ul className="proofs">
                  {proofs.map((pr) => (
                    <li key={pr.id}>
                      {pr.attachment_id && (
                        <a href={attachmentUrl(pr.attachment_id)} target="_blank" rel="noreferrer" className="proof-thumb">
                          <img src={attachmentUrl(pr.attachment_id)} alt="" loading="lazy" />
                        </a>
                      )}
                      <div>
                        <b>{fmtAmount(pr.amount, pr.currency) || '—'}</b>
                        <small>
                          {fmtMonth(pr.month, lang)}
                          {pr.paid_date ? ` · ${fmtDate(pr.paid_date, lang)}` : ''}
                        </small>
                      </div>
                      <span className={`pill pill-${pr.status === 'approved' ? 'paid' : pr.status === 'rejected' ? 'rejected' : 'pending'}`}>
                        {L[pr.status]}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

          <Card
            title={L.absences}
            icon={<CalendarIcon />}
            action={
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => openModal('excuse', { onDone: load })}>
                {L.reportAbsence}
              </button>
            }
          >
            {data?.excuses?.length ? (
              <ul className="excuses">
                {data.excuses.map((x) => (
                  <li key={x.id}>
                    <b>{fmtDate(x.date, lang)}</b>
                    <span>{x.reason}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">{L.noAbsences}</p>
            )}
          </Card>

          <Card title={L.myChats} icon={<ChatIcon />}>
            <p className="muted">{L.chatsCount(data?.chats ?? 0)}</p>
            <button type="button" className="btn btn-brand btn-sm" onClick={() => navigate('/')}>
              {L.openChats}
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
}
