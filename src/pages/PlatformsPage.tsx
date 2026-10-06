import { useState, type FormEvent, type ReactNode } from 'react';
import { useAuth } from '../app/AuthContext.js';
import { Page } from '../components/Page.js';
import { StepUpDialog } from '../components/StepUpDialog.js';
import { ErrorState, LoadingState, StatusBadge } from '../components/States.js';
import { api, type Platform } from '../core/api.js';
import { useAsync } from '../core/useAsync.js';

const message = (cause: unknown) => (cause instanceof Error ? cause.message : 'The action failed');

export function PlatformsPage() {
  const auth = useAuth();
  const platforms = useAsync(api.platforms, []);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Platform>();
  const [rotating, setRotating] = useState<Platform>();
  const [stepUp, setStepUp] = useState(false);
  if (platforms.loading) return <LoadingState label="Loading platforms" />;
  if (platforms.error) return <ErrorState error={platforms.error} retry={platforms.reload} />;
  return (
    <Page
      eyebrow="Registry"
      title="Connected platforms"
      description="Independent Pepsa products connected through versioned, signed integration contracts. Staging vs production isolation is by deploy host."
      action={
        auth.can('admin.platforms.manage') ? (
          <div className="inline-actions">
            <button className="button secondary" onClick={() => setStepUp(true)}>
              Verify MFA
            </button>
            <button className="button primary" onClick={() => setCreating(true)}>
              Register platform
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="platform-grid">
        {platforms.data?.map((platform) => (
          <PlatformCard
            key={platform.id}
            platform={platform}
            manage={auth.can('admin.platforms.manage')}
            edit={() => setEditing(platform)}
            rotateCredentials={() => setRotating(platform)}
            completed={platforms.reload}
            requestStepUp={() => setStepUp(true)}
          />
        ))}
      </div>
      {creating && <CreatePlatform close={() => setCreating(false)} completed={platforms.reload} />}
      {editing && (
        <EditPlatform
          platform={editing}
          close={() => setEditing(undefined)}
          completed={platforms.reload}
        />
      )}
      {rotating && (
        <RotateCredentials
          platform={rotating}
          close={() => setRotating(undefined)}
          completed={platforms.reload}
        />
      )}
      {stepUp && <StepUpDialog close={() => setStepUp(false)} />}
    </Page>
  );
}

function PlatformCard({
  platform,
  manage,
  edit,
  rotateCredentials,
  completed,
  requestStepUp,
}: {
  platform: Platform;
  manage: boolean;
  edit(): void;
  rotateCredentials(): void;
  completed(): Promise<void>;
  requestStepUp(): void;
}) {
  const production = platform.environments.find(({ key }) => key === 'production');
  const health = useAsync(
    () =>
      production?.status === 'ACTIVE'
        ? api.platformHealth(platform.key)
        : Promise.resolve({ status: 'disabled', checkedAt: new Date().toISOString() }),
    [platform.key, production?.status],
  );
  const setEnv = async (status: 'ACTIVE' | 'DISABLED') => {
    try {
      await api.setPlatformEnvironmentStatus(platform.id, 'production', {
        status,
        reason:
          status === 'ACTIVE'
            ? 'Enable platform UI and control-plane operations for this deploy lane'
            : 'Disable platform control-plane access for this deploy lane',
      });
      await completed();
    } catch (cause) {
      const text = message(cause);
      if (/step.?up|MFA|428/i.test(text)) requestStepUp();
      window.alert(text);
    }
  };
  return (
    <article className="platform-card">
      <header>
        <img src="/pepsa-mark.svg" alt="" />
        <StatusBadge value={health.data?.status ?? (health.loading ? 'checking' : 'unavailable')} />
      </header>
      <h2>{platform.name}</h2>
      <p>{platform.description}</p>
      <dl>
        <div>
          <dt>Status</dt>
          <dd>{platform.status}</dd>
        </div>
        <div>
          <dt>Adapter</dt>
          <dd>Versioned HTTP · v1</dd>
        </div>
        <div>
          <dt>Deploy environment</dt>
          <dd>
            {platform.environments.length
              ? platform.environments.map(({ key, status }) => `${key}: ${status}`).join(' · ')
              : 'missing'}{' '}
            (host-scoped)
          </dd>
        </div>
        <div>
          <dt>Isolation</dt>
          <dd>Staging vs production by separate admin deploy</dd>
        </div>
      </dl>
      {manage && (
        <footer className="inline-actions">
          <button className="button secondary" onClick={edit}>
            Edit
          </button>
          <button className="button secondary" onClick={rotateCredentials}>
            Rotate credentials
          </button>
          {production && production.status !== 'ACTIVE' ? (
            <button className="button primary" onClick={() => void setEnv('ACTIVE')}>
              Enable production env
            </button>
          ) : null}
          {production?.status === 'ACTIVE' &&
          (platform.key === 'pepsa-order' || platform.key === 'pepsa-payment') ? (
            <button className="button danger" onClick={() => void setEnv('DISABLED')}>
              Disable production env
            </button>
          ) : null}
        </footer>
      )}
    </article>
  );
}

function ModalForm({
  title,
  eyebrow,
  close,
  submit,
  children,
}: {
  title: string;
  eyebrow: string;
  close(): void;
  submit(event: FormEvent<HTMLFormElement>): void;
  children: ReactNode;
}) {
  return (
    <div className="modal-backdrop">
      <form className="modal" role="dialog" aria-modal="true" aria-label={title} onSubmit={submit}>
        <header>
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
          </div>
          <button type="button" className="icon-control" onClick={close}>
            ×
          </button>
        </header>
        {children}
      </form>
    </div>
  );
}

function CreatePlatform({ close, completed }: { close(): void; completed(): Promise<void> }) {
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError('');
    try {
      await api.createPlatform({
        key: String(form.get('key')),
        name: String(form.get('name')),
        description: String(form.get('description') || ''),
        adapterType: String(form.get('adapterType')),
        reason: String(form.get('reason')),
      });
      close();
      await completed();
    } catch (cause) {
      setError(message(cause));
    }
  };
  return (
    <ModalForm title="Register platform" eyebrow="Platform registry" close={close} submit={submit}>
      {error && <div className="form-error">{error}</div>}
      <label>
        Platform key
        <input name="key" pattern="[a-z0-9-]+" placeholder="business-as-a-service" required />
      </label>
      <label>
        Name
        <input name="name" required />
      </label>
      <label>
        Description
        <textarea name="description" />
      </label>
      <label>
        Adapter type
        <input name="adapterType" defaultValue="bas-http-v1" required />
      </label>
      <label>
        Business reason
        <textarea name="reason" minLength={8} required />
      </label>
      <footer>
        <button className="button primary">Register</button>
      </footer>
    </ModalForm>
  );
}

function EditPlatform({
  platform,
  close,
  completed,
}: {
  platform: Platform;
  close(): void;
  completed(): Promise<void>;
}) {
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError('');
    try {
      await api.updatePlatform(platform.id, {
        name: String(form.get('name')),
        description: String(form.get('description') || ''),
        status: String(form.get('status')),
        reason: String(form.get('reason')),
      });
      close();
      await completed();
    } catch (cause) {
      setError(message(cause));
    }
  };
  return (
    <ModalForm
      title={`Edit ${platform.name}`}
      eyebrow="Platform registry"
      close={close}
      submit={submit}
    >
      {error && <div className="form-error">{error}</div>}
      <label>
        Name
        <input name="name" defaultValue={platform.name} required />
      </label>
      <label>
        Description
        <textarea name="description" defaultValue={platform.description} />
      </label>
      <label>
        Status
        <select name="status" defaultValue={platform.status}>
          <option>ACTIVE</option>
          <option>DEGRADED</option>
          <option>DISABLED</option>
        </select>
      </label>
      <label>
        Business reason
        <textarea name="reason" minLength={8} required />
      </label>
      <footer>
        <button className="button primary">Save changes</button>
      </footer>
    </ModalForm>
  );
}

function RotateCredentials({
  platform,
  close,
  completed,
}: {
  platform: Platform;
  close(): void;
  completed(): Promise<void>;
}) {
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError('');
    try {
      await api.rotatePlatformCredentials(platform.id, {
        configurationReference: String(form.get('configurationReference')),
        approvalId: String(form.get('approvalId')),
        reason: String(form.get('reason')),
      });
      close();
      await completed();
    } catch (cause) {
      setError(message(cause));
    }
  };
  return (
    <ModalForm
      title={`Rotate ${platform.name} credentials`}
      eyebrow="Dual-control operation"
      close={close}
      submit={submit}
    >
      {error && <div className="form-error">{error}</div>}
      <p className="muted">
        Create and obtain approval for action <code>platform.credentials.rotate</code> with a
        payload containing this exact secret reference. Raw credentials are never accepted.
      </p>
      <label>
        New secret-manager reference
        <input
          name="configurationReference"
          placeholder="vault://admin/platforms/bas"
          pattern="^(vault|aws-sm|gcp-sm|azure-kv)://.*"
          required
        />
      </label>
      <label>
        Approved request ID
        <input name="approvalId" type="text" required />
      </label>
      <label>
        Business reason
        <textarea name="reason" minLength={8} required />
      </label>
      <footer>
        <button className="button primary">Rotate reference</button>
      </footer>
    </ModalForm>
  );
}
