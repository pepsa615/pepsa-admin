import { useState, type FormEvent } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../app/AuthContext.js';
import { QrCode } from '../components/QrCode.js';
import { api } from '../core/api.js';

export function LoginPage() {
  const auth = useAuth();
  const [search] = useSearchParams();
  const initialResetToken = search.get('reset') ?? '';
  const [stage, setStage] = useState<'password' | 'mfa' | 'codes' | 'recovery' | 'reset'>(
    initialResetToken ? 'reset' : 'password',
  );
  const [resetToken, setResetToken] = useState(initialResetToken);
  const [usingRecovery, setUsingRecovery] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [enrollment, setEnrollment] = useState<{ secret: string; uri: string }>();
  if (auth.session && stage !== 'codes') return <Navigate to="/overview" replace />;
  const completeEnrollment = async () => {
    setBusy(true);
    setError('');
    try {
      await auth.completeMfaEnrollment();
      setStage('password');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not complete MFA enrollment');
    } finally {
      setBusy(false);
    }
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      if (stage === 'password') {
        const result = await auth.login(String(form.get('email')), String(form.get('password')));
        setEnrollment(result.enrollment);
        setStage('mfa');
      } else if (stage === 'mfa') {
        const codes = await auth.verifyMfa(String(form.get('code')), usingRecovery);
        if (codes.length) {
          setRecoveryCodes(codes);
          setStage('codes');
        }
      } else if (stage === 'recovery') {
        const result = await api.requestPasswordRecovery(String(form.get('email')));
        setResetToken(result.developmentToken ?? '');
        setStage('reset');
      } else if (stage === 'reset') {
        await api.resetPassword(
          String(form.get('token')),
          String(form.get('password')),
          String(form.get('mfaCode')),
        );
        setStage('password');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="auth-layout">
      <section className="auth-story">
        <div className="brand-lockup">
          <img src="/pepsa-mark.svg" alt="" />
          <div>
            <strong>Pepsa</strong>
            <span>Administration</span>
          </div>
        </div>
        <div>
          <p className="eyebrow">Secure control plane</p>
          <h1>One trusted place to operate every Pepsa platform.</h1>
          <p>
            Platform-scoped access, correlated audit records, and enterprise-grade operational
            control.
          </p>
        </div>
        <p className="auth-footnote">Authorized personnel only · All activity is monitored</p>
      </section>
      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit}>
          <div>
            <p className="eyebrow">
              {stage === 'password'
                ? 'Administrator sign in'
                : stage === 'recovery' || stage === 'reset'
                  ? 'Account recovery'
                  : stage === 'codes'
                    ? 'Recovery kit'
                    : 'Identity verification'}
            </p>
            <h2>
              {stage === 'password'
                ? 'Welcome back'
                : stage === 'recovery'
                  ? 'Recover your account'
                  : stage === 'reset'
                    ? 'Set a new password'
                    : stage === 'codes'
                      ? 'Save your recovery codes'
                      : usingRecovery
                        ? 'Use a recovery code'
                        : 'Enter your security code'}
            </h2>
            <p>
              {stage === 'password'
                ? 'Use your internal administrator credentials.'
                : stage === 'recovery'
                  ? 'We will send a short-lived recovery token to your verified work email.'
                  : stage === 'reset'
                    ? 'Confirm the recovery token and current authenticator code.'
                    : stage === 'codes'
                      ? 'Store these single-use codes in your approved password manager. They will not be shown again.'
                      : 'Open your authenticator app and enter the current six-digit code.'}
            </p>
          </div>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          {stage === 'password' ? (
            <>
              <label>
                Email address
                <input name="email" type="email" autoComplete="username" required />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  minLength={12}
                  autoComplete="current-password"
                  required
                />
              </label>
            </>
          ) : stage === 'recovery' ? (
            <label>
              Email address
              <input name="email" type="email" autoComplete="username" required />
            </label>
          ) : stage === 'reset' ? (
            <>
              <label>
                Recovery token
                <input
                  name="token"
                  value={resetToken}
                  onChange={(event) => setResetToken(event.target.value)}
                  required
                />
              </label>
              <label>
                New password
                <input
                  name="password"
                  type="password"
                  minLength={14}
                  autoComplete="new-password"
                  required
                />
              </label>
              <label>
                Authenticator code
                <input
                  name="mfaCode"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                />
              </label>
            </>
          ) : stage === 'mfa' ? (
            <>
              <label>
                {usingRecovery ? 'Recovery code' : 'Authenticator code'}
                <input
                  name="code"
                  inputMode={usingRecovery ? 'text' : 'numeric'}
                  pattern={
                    usingRecovery ? '[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}' : '[0-9]{6}'
                  }
                  maxLength={usingRecovery ? 14 : 6}
                  autoComplete="one-time-code"
                  autoFocus
                  required
                />
              </label>
              {enrollment && (
                <div className="enrollment">
                  <strong>First-time setup</strong>
                  <p>Scan this QR code with your authenticator, then enter its six-digit code.</p>
                  <QrCode value={enrollment.uri} label="Authenticator enrollment QR code" />
                  <details>
                    <summary>Enter a setup key instead</summary>
                    <code>{enrollment.secret}</code>
                  </details>
                </div>
              )}
              {!enrollment && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setUsingRecovery((value) => !value)}
                >
                  {usingRecovery ? 'Use authenticator code' : 'Use a recovery code'}
                </button>
              )}
            </>
          ) : (
            <div className="recovery-codes">
              {recoveryCodes.map((code) => (
                <code key={code}>{code}</code>
              ))}
            </div>
          )}
          {stage === 'codes' ? (
            <button
              type="button"
              className="button primary"
              disabled={busy}
              onClick={() => void completeEnrollment()}
            >
              {busy ? 'Finishing…' : 'I saved these codes'}
            </button>
          ) : (
            <button className="button primary" disabled={busy}>
              {busy
                ? 'Verifying…'
                : stage === 'password'
                  ? 'Continue securely'
                  : stage === 'recovery'
                    ? 'Send recovery token'
                    : stage === 'reset'
                      ? 'Reset password'
                      : 'Verify and sign in'}
            </button>
          )}
          {stage === 'mfa' && (
            <button type="button" className="text-button" onClick={() => setStage('password')}>
              Use a different account
            </button>
          )}
          {stage === 'password' && (
            <button type="button" className="text-button" onClick={() => setStage('recovery')}>
              Forgot your password?
            </button>
          )}
          {(stage === 'recovery' || stage === 'reset') && (
            <button type="button" className="text-button" onClick={() => setStage('password')}>
              Back to sign in
            </button>
          )}
        </form>
      </section>
    </main>
  );
}
