import { useState, type FormEvent } from 'react';
import { useAuth } from '../app/AuthContext.js';

export function StepUpDialog({ close, completed }: { close(): void; completed?(): void }) {
  const auth = useAuth();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await auth.stepUp(String(new FormData(event.currentTarget).get('code')));
      completed?.();
      close();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Verification failed');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-backdrop">
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Step-up authentication"
        onSubmit={submit}
      >
        <header>
          <div>
            <p className="eyebrow">Step-up authentication</p>
            <h2>Verify sensitive action</h2>
          </div>
          <button type="button" className="icon-control" onClick={close}>
            ×
          </button>
        </header>
        <p className="page-description">
          Enter the current code from your authenticator. Verification remains valid for five
          minutes.
        </p>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <label>
          Authenticator code
          <input
            name="code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            autoFocus
            required
          />
        </label>
        <footer>
          <button type="button" className="button secondary" onClick={close}>
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? 'Verifying…' : 'Verify'}
          </button>
        </footer>
      </form>
    </div>
  );
}
