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
  const [environmentFor, setEnvironmentFor] = useState<Platform>();
  const [rotating, setRotating] = useState<Platform>();
  const [stepUp, setStepUp] = useState(false);
  if (platforms.loading) return <LoadingState label="Loading platforms" />;
  if (platforms.error) return <ErrorState error={platforms.error} retry={platforms.reload} />;
  return (
    <Page
      eyebrow="Registry"
      title="Connected platforms"
      description="Independent Pepsa products connected through versioned, signed integration contracts."
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
            addEnvironment={() => setEnvironmentFor(platform)}
            rotateCredentials={() => setRotating(platform)}
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
      {environmentFor && (
        <AddEnvironment
          platform={environmentFor}
          close={() => setEnvironmentFor(undefined)}
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
  addEnvironment,
  rotateCredentials,
}: {
  platform: Platform;
  manage: boolean;
  edit(): void;
  addEnvironment(): void;
  rotateCredentials(): void;
}) {
  const health = useAsync(() => api.platformHealth(platform.key), [platform.key]);
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
          <dt>Environments</dt>
          <dd>{platform.environments.map(({ name }) => name).join(', ') || 'None'}</dd>
        </div>
        <div>
          <dt>Isolation</dt>
          <dd>Independent deployment</dd>
        </div>
      </dl>
      {manage && (
        <footer className="inline-actions">
          <button className="button secondary" onClick={edit}>
            Edit
          </button>
          <button className="button secondary" onClick={addEnvironment}>
            Add environment
          </button>
          <button className="button secondary" onClick={rotateCredentials}>
            Rotate credentials
          </button>
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

function AddEnvironment({
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
      await api.addPlatformEnvironment(platform.id, {
        key: String(form.get('key')),
        name: String(form.get('name')),
        endpointReference: String(form.get('endpointReference') || '') || undefined,
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
      title={`Add ${platform.name} environment`}
      eyebrow="Environment isolation"
      close={close}
      submit={submit}
    >
      {error && <div className="form-error">{error}</div>}
      <label>
        Environment key
        <input name="key" pattern="[a-z0-9-]+" placeholder="production" required />
      </label>
      <label>
        Name
        <input name="name" placeholder="Production" required />
      </label>
      <label>
        Endpoint secret reference
        <input name="endpointReference" placeholder="vault://admin/platforms/bas/production" />
      </label>
      <label>
        Business reason
        <textarea name="reason" minLength={8} required />
      </label>
      <footer>
        <button className="button primary">Add environment</button>
      </footer>
    </ModalForm>
  );
}
