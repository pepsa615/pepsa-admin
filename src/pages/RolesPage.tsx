import { useState, type FormEvent } from 'react';
import { useAuth } from '../app/AuthContext.js';
import { Page } from '../components/Page.js';
import { ErrorState, LoadingState } from '../components/States.js';
import { api } from '../core/api.js';
import { titleCase } from '../core/format.js';
import { useAsync } from '../core/useAsync.js';

export function RolesPage() {
  const auth = useAuth();
  const data = useAsync(async () => {
    const platforms = await api.platforms();
    const groups = await Promise.all([
      api.roles(),
      ...platforms.map((platform) => api.roles(platform.id)),
    ]);
    return { platforms, roles: groups.flat() };
  }, []);
  const [creating, setCreating] = useState(false);
  return (
    <Page
      eyebrow="Policy catalogue"
      title="Roles and permissions"
      description="Capabilities are named for actions, enforced by both the control plane and destination platform."
      action={
        auth.can('admin.roles.manage') ? (
          <button className="button primary" onClick={() => setCreating(true)}>
            Create custom role
          </button>
        ) : undefined
      }
    >
      {data.loading ? (
        <LoadingState />
      ) : data.error ? (
        <ErrorState error={data.error} retry={data.reload} />
      ) : (
        <div className="role-grid">
          {data.data?.roles.map((role) => (
            <article className="panel role-card" key={role.id}>
              <p className="eyebrow">
                {role.key.startsWith('admin') ||
                ['super-admin', 'access-manager', 'security-auditor'].includes(role.key)
                  ? 'Global role'
                  : 'Platform role'}
              </p>
              <h2>{role.name}</h2>
              <p>{role.description ?? 'System-managed role'}</p>
              <div className="permission-list">
                {role.permissions.map(({ permission }) => (
                  <span key={permission.key}>
                    <b>{titleCase(permission.key)}</b>
                    <small>{permission.riskLevel} risk</small>
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
      {creating && data.data && (
        <CreateRole
          platforms={data.data.platforms}
          close={() => setCreating(false)}
          completed={data.reload}
        />
      )}
    </Page>
  );
}

function CreateRole({
  platforms,
  close,
  completed,
}: {
  platforms: Awaited<ReturnType<typeof api.platforms>>;
  close(): void;
  completed(): Promise<void>;
}) {
  const permissions = useAsync(api.permissions, []);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError('');
    try {
      await api.createRole({
        platformId: String(form.get('platformId') || '') || undefined,
        key: String(form.get('key')),
        name: String(form.get('name')),
        description: String(form.get('description') || ''),
        permissionIds: form.getAll('permissionIds').map(String),
        approvalId: String(form.get('approvalId') || '') || undefined,
        reason: String(form.get('reason')),
      });
      close();
      await completed();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The action failed');
    }
  };
  return (
    <div className="modal-backdrop">
      <form
        className="modal modal-wide"
        role="dialog"
        aria-modal="true"
        aria-label="Create custom role"
        onSubmit={submit}
      >
        <header>
          <div>
            <p className="eyebrow">Least privilege</p>
            <h2>Create custom role</h2>
          </div>
          <button type="button" className="icon-control" onClick={close}>
            ×
          </button>
        </header>
        {error && <div className="form-error">{error}</div>}
        <label>
          Scope
          <select name="platformId">
            <option value="">Global control plane</option>
            {platforms.map((platform) => (
              <option key={platform.id} value={platform.id}>
                {platform.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Role key
          <input name="key" pattern="[a-z0-9.-]+" required />
        </label>
        <label>
          Name
          <input name="name" required />
        </label>
        <label>
          Description
          <textarea name="description" />
        </label>
        <fieldset>
          <legend>Permissions</legend>
          <div className="permission-picker">
            {permissions.loading ? (
              <LoadingState />
            ) : (
              permissions.data?.map((permission) => (
                <label key={permission.id}>
                  <input type="checkbox" name="permissionIds" value={permission.id} />{' '}
                  <span>
                    {permission.key}
                    <small>
                      {permission.riskLevel} risk ·{' '}
                      {permission.delegatable ? 'delegatable' : 'restricted'}
                    </small>
                  </span>
                </label>
              ))
            )}
          </div>
        </fieldset>
        <label>
          Approval reference <small>Required when any selected permission is critical.</small>
          <input name="approvalId" />
        </label>
        <label>
          Business reason
          <textarea name="reason" minLength={8} required />
        </label>
        <footer>
          <button className="button primary">Create role</button>
        </footer>
      </form>
    </div>
  );
}
