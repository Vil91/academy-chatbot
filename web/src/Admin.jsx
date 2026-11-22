import { useEffect, useState } from 'react';
import { api } from './api.js';
import { sessionGet, sessionSet } from './storage.js';
import { RefreshIcon } from './icons.jsx';

function Table({ title, rows, columns, empty }) {
  return (
    <section className="admin-block">
      <h2>
        {title} <span className="admin-count">{rows.length}</span>
      </h2>
      {rows.length === 0 ? (
        <p className="admin-empty">{empty}</p>
      ) : (
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
                    <td key={c.key}>{r[c.key] ?? '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function Admin() {
  const [key, setKey] = useState(() => sessionGet('ac_admin') || '');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load(k = key) {
    if (!k) return;
    setBusy(true);
    setError('');
    try {
      const d = await api.admin(k);
      setData(d);
      sessionSet('ac_admin', k);
    } catch (err) {
      setData(null);
      setError(err.status === 401 ? 'Wrong admin key.' : 'Could not load the data.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (key) load(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data) {
    return (
      <div className="admin admin-login">
        <a className="admin-back" href="/">
          ← Academy Concierge
        </a>
        <h1>Coordinator panel</h1>
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
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button className="btn btn-primary" disabled={busy || !key}>
              Open
            </button>
          </div>
        </form>
      </div>
    );
  }

  const { counts } = data;
  return (
    <div className="admin">
      <div className="admin-top">
        <div>
          <a className="admin-back" href="/">
            ← Academy Concierge
          </a>
          <h1>Coordinator panel</h1>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => load()} disabled={busy}>
          <RefreshIcon /> Refresh
        </button>
      </div>

      <div className="tiles">
        <div className="tile">
          <span>Leads</span>
          <strong>{counts.leads}</strong>
        </div>
        <div className="tile tile-warn">
          <span>Open handoffs</span>
          <strong>{counts.openHandoffs}</strong>
        </div>
        <div className="tile">
          <span>Absence notes</span>
          <strong>{counts.excuses}</strong>
        </div>
        <div className="tile">
          <span>Questions asked</span>
          <strong>{counts.questions}</strong>
        </div>
      </div>

      <Table
        title="Handoffs to a coordinator"
        rows={data.handoffs}
        empty="No questions needed a person yet."
        columns={[
          { key: 'created_at', label: 'Time (UTC)' },
          { key: 'lang', label: 'Lang' },
          { key: 'question', label: 'Question' },
          { key: 'status', label: 'Status' },
        ]}
      />
      <Table
        title="Leads (entry test requests)"
        rows={data.leads}
        empty="No requests yet."
        columns={[
          { key: 'created_at', label: 'Time (UTC)' },
          { key: 'name', label: 'Name' },
          { key: 'contact', label: 'Contact' },
          { key: 'interest', label: 'Program' },
          { key: 'preferred_time', label: 'Preferred time' },
          { key: 'lang', label: 'Lang' },
        ]}
      />
      <Table
        title="Absence notes"
        rows={data.excuses}
        empty="No absence notes yet."
        columns={[
          { key: 'created_at', label: 'Sent (UTC)' },
          { key: 'student_code', label: 'Student' },
          { key: 'date', label: 'Date' },
          { key: 'reason', label: 'Reason' },
        ]}
      />
      <Table
        title="Recent questions"
        rows={data.questions}
        empty="No questions yet."
        columns={[
          { key: 'created_at', label: 'Time (UTC)' },
          { key: 'lang', label: 'Lang' },
          { key: 'content', label: 'Question' },
        ]}
      />
    </div>
  );
}
