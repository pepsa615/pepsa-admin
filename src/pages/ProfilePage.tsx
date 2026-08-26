import { useState } from 'react';
import { useAuth } from '../app/AuthContext.js';
import { Page } from '../components/Page.js';
import { StepUpDialog } from '../components/StepUpDialog.js';
import { ErrorState, LoadingState, StatusBadge } from '../components/States.js';
import { api, type AdminSession } from '../core/api.js';
import { formatDate } from '../core/format.js';
import { useAsync } from '../core/useAsync.js';

export function ProfilePage() {
  const auth = useAuth();
  const sessions = useAsync(() => api.sessions(), []);
  const [selected, setSelected] = useState<AdminSession>();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [stepUp, setStepUp] = useState(false);
  const revoke = async () => {
    if (!selected || reason.trim().length < 8)
      return setError('Enter a reason of at least 8 characters.');
    try {
      await api.revokeSession(selected.id, reason);
      setSelected(undefined);
      await sessions.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Revocation failed');
    }
  };
  return (
    <Page
      eyebrow="Administrator profile"
      title={auth.session!.user.name}
      description={auth.session!.user.email}
      action={
        <button className="button secondary" onClick={() => setStepUp(true)}>
          Verify MFA
        </button>
      }
    >
      <div className="content-grid">
        <section className="panel panel--wide">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Security</p>
              <h2>Active sessions</h2>
            </div>
          </div>
          {sessions.loading ? (
            <LoadingState />
          ) : sessions.error ? (
            <ErrorState error={sessions.error} retry={sessions.reload} />
          ) : (
            <div className="session-list">
              {sessions.data?.map((session, index) => (
                <article key={session.id}>
                  <div>
                    <strong>
                      {index === 0 ? 'Current or recent device' : 'Administrator device'}
                    </strong>
                    <span>{session.userAgent ?? 'Unknown client'}</span>
                    <small>
                      Last active {formatDate(session.lastSeenAt)} · Expires{' '}
                      {formatDate(session.expiresAt)}
                    </small>
                  </div>
                  <StatusBadge
                    value={
                      session.revokedAt
                        ? 'revoked'
                        : new Date(session.expiresAt) > new Date()
                          ? 'active'
                          : 'expired'
                    }
                  />
                  {!session.revokedAt && (
                    <button className="text-link" onClick={() => setSelected(session)}>
                      Revoke
                    </button>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
        <aside className="panel">
          <p className="eyebrow">Effective permissions</p>
          <h2>{auth.session!.permissions.length}</h2>
          <div className="permission-summary">
            {auth.session!.permissions.map((permission) => (
              <code key={permission}>{permission}</code>
            ))}
          </div>
        </aside>
      </div>
      {selected && (
        <div className="modal-backdrop">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Revoke session">
            <header>
              <h2>Revoke session</h2>
              <button className="icon-control" onClick={() => setSelected(undefined)}>
                ×
              </button>
            </header>
            {error && <div className="form-error">{error}</div>}
            <label>
              Revocation reason
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} />
            </label>
            <footer>
              <button className="button danger" onClick={() => void revoke()}>
                Revoke session
              </button>
            </footer>
          </div>
        </div>
      )}
      {stepUp && <StepUpDialog close={() => setStepUp(false)} />}
    </Page>
  );
}
