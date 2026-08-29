import { useState, type FormEvent } from 'react';
import { Page } from '../components/Page.js';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '../components/States.js';
import { api, type Administrator } from '../core/api.js';
import { formatDate } from '../core/format.js';
import { useAsync } from '../core/useAsync.js';
import { useAuth } from '../app/AuthContext.js';
import { StepUpDialog } from '../components/StepUpDialog.js';

export function AdministratorsPage() {
  const auth = useAuth();
  const administrators = useAsync(api.administrators, []);
  const [inviting, setInviting] = useState(false);
  const [managing, setManaging] = useState<Administrator>();
  const [error, setError] = useState('');
  const [developmentToken, setDevelopmentToken] = useState('');
  const [stepUp, setStepUp] = useState(false);
  const resend = async (administrator: Administrator) => {
    const reason = window.prompt('Business reason for resending this invitation:');
    if (!reason) return;
    setError('');
    try {
      const result = await api.resendInvitation(administrator.id, reason);
      setDevelopmentToken(result.developmentToken ?? '');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not resend invitation');
    }
  };
  const invite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const invited = await api.invite({
        name: String(form.get('name')),
        email: String(form.get('email')),
        reason: String(form.get('reason')),
      });
      setDevelopmentToken(invited.developmentToken ?? '');
      setInviting(false);
      await administrators.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Invitation failed');
    }
  };
  return (
    <Page
      eyebrow="Identity & access"
      title="Administrators"
      description="Every administrator has explicit, expiring, platform-scoped access."
      action={
        <div className="inline-actions">
          {auth.can('admin.access.manage') && (
            <button className="button secondary" onClick={() => setStepUp(true)}>
              Verify MFA
            </button>
          )}
          {auth.can('admin.users.manage') && (
            <button className="button primary" onClick={() => setInviting(true)}>
              Invite administrator
            </button>
          )}
        </div>
      }
    >
      {developmentToken && (
        <div className="state-card" role="status">
          <strong>Development invitation token</strong>
          <code>{developmentToken}</code>
          <span>Production sends this token through the configured verified delivery service.</span>
        </div>
      )}
      {administrators.loading ? (
        <LoadingState />
      ) : administrators.error ? (
        <ErrorState error={administrators.error} retry={administrators.reload} />
      ) : !administrators.data?.length ? (
        <EmptyState
          title="No administrators"
          description="Invite your first internal administrator."
        />
      ) : (
        <div className="table-panel">
          <table aria-label="Administrator directory">
            <thead>
              <tr>
                <th>Administrator</th>
                <th>Status</th>
                <th>Platforms</th>
                <th>Roles</th>
                <th>Last sign-in</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {administrators.data.map((admin) => (
                <tr key={admin.id}>
                  <td>
                    <strong>{admin.name}</strong>
                    <small>{admin.email}</small>
                  </td>
                  <td>
                    <StatusBadge value={admin.status} />
                    <small>MFA {admin.mfaStatus.toLowerCase()}</small>
                  </td>
                  <td>
                    {admin.memberships.map(({ platform }) => platform.name).join(', ') || 'None'}
                  </td>
                  <td>{admin.assignments.map(({ role }) => role.name).join(', ') || 'None'}</td>
                  <td>{formatDate(admin.lastLoginAt)}</td>
                  <td>
                    {admin.status === 'INVITED' && auth.can('admin.users.manage') && (
                      <button className="text-link" onClick={() => void resend(admin)}>
                        Resend invite
                      </button>
                    )}
                    {auth.can('admin.access.manage') && (
                      <button className="text-link" onClick={() => setManaging(admin)}>
                        Manage
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {inviting && (
        <div className="modal-backdrop" role="presentation">
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Invite administrator"
            onSubmit={invite}
          >
            <header>
              <div>
                <p className="eyebrow">New administrator</p>
                <h2>Invite secure access</h2>
              </div>
              <button type="button" className="icon-control" onClick={() => setInviting(false)}>
                ×
              </button>
            </header>
            {error && <div className="form-error">{error}</div>}
            <label>
              Full name
              <input name="name" required minLength={2} />
            </label>
            <label>
              Work email
              <input name="email" type="email" required />
            </label>
            <label>
              Business reason
              <textarea name="reason" minLength={8} required />
            </label>
            <footer>
              <button type="button" className="button secondary" onClick={() => setInviting(false)}>
                Cancel
              </button>
              <button className="button primary">Send invitation</button>
            </footer>
          </form>
        </div>
      )}
      {managing && (
        <ManageAccessDialog
          administrator={managing}
          close={() => setManaging(undefined)}
          completed={async () => {
            setManaging(undefined);
            await administrators.reload();
          }}
        />
      )}
      {stepUp && <StepUpDialog close={() => setStepUp(false)} />}
    </Page>
  );
}

function ManageAccessDialog({
  administrator,
  close,
  completed,
}: {
  administrator: Administrator;
  close(): void;
  completed(): Promise<void>;
}) {
  const platforms = useAsync(api.platforms, []);
  const [platformId, setPlatformId] = useState(administrator.memberships[0]?.platform.id ?? '');
  const roles = useAsync(() => api.roles(platformId || undefined), [platformId]);
  const [roleId, setRoleId] = useState('');
  const [environmentId, setEnvironmentId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [membershipExpiresAt, setMembershipExpiresAt] = useState('');
  const [resourceScope, setResourceScope] = useState('');
  const [approvalId, setApprovalId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const act = async (operation: () => Promise<unknown>) => {
    if (reason.trim().length < 8)
      return setError('Enter a business reason of at least 8 characters.');
    setError('');
    try {
      await operation();
      await completed();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Access change failed');
    }
  };
  return (
    <div className="modal-backdrop">
      <div
        className="modal access-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Manage administrator access"
      >
        <header>
          <div>
            <p className="eyebrow">Access lifecycle</p>
            <h2>Manage {administrator.name}</h2>
          </div>
          <button type="button" className="icon-control" onClick={close}>
            ×
          </button>
        </header>
        {error && <div className="form-error">{error}</div>}
        <label>
          Required reason for every change
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            minLength={8}
          />
        </label>
        <section className="access-section">
          <strong>Account status</strong>
          <div className="inline-actions">
            <button
              className="button secondary"
              onClick={() =>
                void act(() => api.updateAdministratorStatus(administrator.id, 'ACTIVE', reason))
              }
            >
              Activate
            </button>
            <button
              className="button danger"
              onClick={() =>
                void act(() => api.updateAdministratorStatus(administrator.id, 'SUSPENDED', reason))
              }
            >
              Suspend
            </button>
          </div>
        </section>
        <section className="access-section">
          <strong>Platform membership and role</strong>
          <select
            value={platformId}
            onChange={(event) => {
              setPlatformId(event.target.value);
              setRoleId('');
              setEnvironmentId('');
            }}
          >
            <option value="">Select platform</option>
            {platforms.data?.map((platform) => (
              <option key={platform.id} value={platform.id}>
                {platform.name}
              </option>
            ))}
          </select>
          <div className="inline-actions">
            <button
              className="button secondary"
              disabled={!platformId}
              onClick={() =>
                void act(() =>
                  api.setMembership(
                    administrator.id,
                    platformId,
                    'ACTIVE',
                    reason,
                    membershipExpiresAt ? new Date(membershipExpiresAt).toISOString() : undefined,
                  ),
                )
              }
            >
              Grant membership
            </button>
            <button
              className="button danger"
              disabled={!platformId}
              onClick={() =>
                void act(() => api.setMembership(administrator.id, platformId, 'REVOKED', reason))
              }
            >
              Revoke membership
            </button>
          </div>
          <label>
            Membership expires <small>Leave blank for no expiry.</small>
            <input
              type="datetime-local"
              value={membershipExpiresAt}
              onChange={(event) => setMembershipExpiresAt(event.target.value)}
            />
          </label>
          <label>
            Assignment expires <small>Leave blank for no expiry.</small>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
            />
          </label>
          {platformId && (
            <label>
              Environment scope
              <select
                value={environmentId}
                onChange={(event) => setEnvironmentId(event.target.value)}
              >
                <option value="">All assigned environments</option>
                {platforms.data
                  ?.find(({ id }) => id === platformId)
                  ?.environments.map((environment) => (
                    <option key={environment.id} value={environment.id}>
                      {environment.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <label>
            Resource scope (JSON) <small>Optional destination-owned constraint.</small>
            <textarea
              value={resourceScope}
              onChange={(event) => setResourceScope(event.target.value)}
              placeholder={'{"businessId":"…"}'}
            />
          </label>
          <label>
            Approval reference <small>Required for a critical role.</small>
            <input value={approvalId} onChange={(event) => setApprovalId(event.target.value)} />
          </label>
          <select value={roleId} onChange={(event) => setRoleId(event.target.value)}>
            <option value="">Select role</option>
            {roles.data?.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
          <button
            className="button primary"
            disabled={!roleId}
            onClick={() =>
              void act(() =>
                api.assignRole(administrator.id, {
                  roleId,
                  platformId: platformId || undefined,
                  environmentId: environmentId || undefined,
                  resourceScope: resourceScope
                    ? (JSON.parse(resourceScope) as Record<string, unknown>)
                    : undefined,
                  expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
                  approvalId: approvalId || undefined,
                  reason,
                }),
              )
            }
          >
            Assign role
          </button>
        </section>
        {administrator.assignments.length > 0 && (
          <section className="access-section">
            <strong>Active assignments</strong>
            {administrator.assignments.map((assignment) => (
              <div className="assignment-row" key={assignment.id}>
                <span>
                  {assignment.role.name}
                  <small>{assignment.platform?.name ?? 'Global'}</small>
                </span>
                <button
                  className="text-link"
                  onClick={() => void act(() => api.revokeAssignment(assignment.id, reason))}
                >
                  Revoke
                </button>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
