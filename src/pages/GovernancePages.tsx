import { useState, type FormEvent } from 'react';
import { useAuth } from '../app/AuthContext.js';
import { Page } from '../components/Page.js';
import { StepUpDialog } from '../components/StepUpDialog.js';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '../components/States.js';
import { api, type AccessReview, type Approval, type EmergencyAccess } from '../core/api.js';
import { formatDate, titleCase } from '../core/format.js';
import { useAsync } from '../core/useAsync.js';

const errorMessage = (cause: unknown) =>
  cause instanceof Error ? cause.message : 'The action failed';

export function ApprovalsPage() {
  const auth = useAuth();
  const data = useAsync(api.approvals, []);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<Approval>();
  const [stepUp, setStepUp] = useState(false);
  const [error, setError] = useState('');
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const payloadText = String(form.get('payload') || '{}');
      await api.requestApproval({
        action: String(form.get('action')),
        riskLevel: String(form.get('riskLevel')) as 'HIGH' | 'CRITICAL',
        reason: String(form.get('reason')),
        payload: JSON.parse(payloadText) as Record<string, unknown>,
        approvalsRequired: Number(form.get('approvalsRequired')),
        expiresAt: new Date(Date.now() + Number(form.get('duration')) * 60_000).toISOString(),
      });
      setCreating(false);
      await data.reload();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };
  return (
    <Page
      eyebrow="Governance"
      title="Approvals"
      description="Two-person control for privilege escalation, critical platform work, and credential changes."
      action={
        <div className="inline-actions">
          <button className="button secondary" onClick={() => setStepUp(true)}>
            Verify MFA
          </button>
          {auth.can('admin.approvals.request') && (
            <button className="button primary" onClick={() => setCreating(true)}>
              Request approval
            </button>
          )}
        </div>
      }
    >
      {data.loading ? (
        <LoadingState />
      ) : data.error ? (
        <ErrorState error={data.error} retry={data.reload} />
      ) : !data.data?.length ? (
        <EmptyState
          title="No approval requests"
          description="Critical actions awaiting independent review appear here."
        />
      ) : (
        <div className="table-panel">
          <table>
            <thead>
              <tr>
                <th>Action</th>
                <th>Requester</th>
                <th>Risk</th>
                <th>Status</th>
                <th>Expires</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.data.map((approval) => (
                <tr key={approval.id}>
                  <td>
                    <strong>{titleCase(approval.action)}</strong>
                    <small>{approval.platform?.name ?? 'Control plane'}</small>
                  </td>
                  <td>{approval.requester.name}</td>
                  <td>
                    <StatusBadge value={approval.riskLevel} />
                  </td>
                  <td>
                    <StatusBadge value={approval.status} />
                  </td>
                  <td>{formatDate(approval.expiresAt)}</td>
                  <td>
                    <button className="text-link" onClick={() => setSelected(approval)}>
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating && (
        <div className="modal-backdrop">
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Request approval"
            onSubmit={create}
          >
            <header>
              <div>
                <p className="eyebrow">Sensitive action</p>
                <h2>Request independent approval</h2>
              </div>
              <button type="button" className="icon-control" onClick={() => setCreating(false)}>
                ×
              </button>
            </header>
            {error && <div className="form-error">{error}</div>}
            <label>
              Action
              <select name="action">
                <option value="role.assign">Assign critical role</option>
                <option value="role.define">Define critical role</option>
                <option value="operation.execute">Execute critical operation</option>
                <option value="platform.credentials.rotate">Rotate platform credentials</option>
              </select>
            </label>
            <label>
              Risk
              <select name="riskLevel">
                <option>CRITICAL</option>
                <option>HIGH</option>
              </select>
            </label>
            <label>
              Approvers required
              <select name="approvalsRequired">
                <option value="1">1</option>
                <option value="2">2</option>
              </select>
            </label>
            <label>
              Expires in
              <select name="duration">
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="240">4 hours</option>
              </select>
            </label>
            <label>
              Payload (JSON)
              <textarea name="payload" defaultValue="{}" />
            </label>
            <label>
              Business reason
              <textarea name="reason" minLength={8} required />
            </label>
            <footer>
              <button className="button primary">Submit request</button>
            </footer>
          </form>
        </div>
      )}
      {selected && (
        <ApprovalDecision
          approval={selected}
          close={() => setSelected(undefined)}
          completed={data.reload}
          canApprove={auth.can('admin.approvals.manage')}
          currentUserId={auth.session!.user.id}
        />
      )}
      {stepUp && <StepUpDialog close={() => setStepUp(false)} />}
    </Page>
  );
}

function ApprovalDecision({
  approval,
  close,
  completed,
  canApprove,
  currentUserId,
}: {
  approval: Approval;
  close(): void;
  completed(): Promise<void>;
  canApprove: boolean;
  currentUserId: string;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const act = async (action: () => Promise<unknown>) => {
    if (reason.trim().length < 8) return setError('Enter a reason of at least 8 characters.');
    try {
      await action();
      close();
      await completed();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-label="Review approval">
        <header>
          <div>
            <p className="eyebrow">{approval.riskLevel} risk</p>
            <h2>{titleCase(approval.action)}</h2>
          </div>
          <button className="icon-control" onClick={close}>
            ×
          </button>
        </header>
        <p>{approval.reason}</p>
        <pre className="payload-preview">{JSON.stringify(approval.payload, null, 2)}</pre>
        {error && <div className="form-error">{error}</div>}
        <label>
          Decision reason
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        <footer>
          {approval.status === 'PENDING' && approval.requester.id === currentUserId && (
            <button
              className="button secondary"
              onClick={() => void act(() => api.cancelApproval(approval.id, reason))}
            >
              Cancel request
            </button>
          )}
          {approval.status === 'PENDING' &&
            canApprove &&
            approval.requester.id !== currentUserId && (
              <>
                <button
                  className="button danger"
                  onClick={() => void act(() => api.decideApproval(approval.id, 'REJECT', reason))}
                >
                  Reject
                </button>
                <button
                  className="button primary"
                  onClick={() => void act(() => api.decideApproval(approval.id, 'APPROVE', reason))}
                >
                  Approve
                </button>
              </>
            )}
        </footer>
      </div>
    </div>
  );
}

export function AccessReviewsPage() {
  const auth = useAuth();
  const data = useAsync(api.accessReviews, []);
  const platforms = useAsync(api.platforms, []);
  const [creating, setCreating] = useState(false);
  const [stepUp, setStepUp] = useState(false);
  const [item, setItem] = useState<{ review: AccessReview; item: AccessReview['items'][number] }>();
  const [error, setError] = useState('');
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api.createAccessReview({
        platformId: String(form.get('platformId')),
        name: String(form.get('name')),
        dueAt: new Date(String(form.get('dueAt'))).toISOString(),
      });
      setCreating(false);
      await data.reload();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };
  return (
    <Page
      eyebrow="Access certification"
      title="Access reviews"
      description="Periodically certify every active platform assignment and revoke stale access immediately."
      action={
        <div className="inline-actions">
          <button className="button secondary" onClick={() => setStepUp(true)}>
            Verify MFA
          </button>
          {auth.can('admin.reviews.manage') && (
            <button className="button primary" onClick={() => setCreating(true)}>
              Start review
            </button>
          )}
        </div>
      }
    >
      {data.loading ? (
        <LoadingState />
      ) : data.error ? (
        <ErrorState error={data.error} retry={data.reload} />
      ) : !data.data?.length ? (
        <EmptyState
          title="No review campaigns"
          description="Start a campaign to certify current platform access."
        />
      ) : (
        <div className="review-grid">
          {data.data.map((review) => (
            <article className="panel" key={review.id}>
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">{review.platform.name}</p>
                  <h2>{review.name}</h2>
                </div>
                <StatusBadge value={review.status} />
              </div>
              <p>
                Due {formatDate(review.dueAt)} ·{' '}
                {review.items.filter(({ decision }) => decision).length}/{review.items.length}{' '}
                reviewed
              </p>
              <div className="review-items">
                {review.items.map((reviewItem) => (
                  <button
                    key={reviewItem.id}
                    disabled={Boolean(reviewItem.decision)}
                    onClick={() => setItem({ review, item: reviewItem })}
                  >
                    <span>
                      <strong>{reviewItem.user.name}</strong>
                      <small>{reviewItem.assignment.role.name}</small>
                    </span>
                    {reviewItem.decision ? (
                      <StatusBadge value={reviewItem.decision} />
                    ) : (
                      <span>Review →</span>
                    )}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
      {creating && (
        <div className="modal-backdrop">
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Create access review"
            onSubmit={create}
          >
            <header>
              <h2>Start access review</h2>
              <button type="button" className="icon-control" onClick={() => setCreating(false)}>
                ×
              </button>
            </header>
            {error && <div className="form-error">{error}</div>}
            <label>
              Campaign name
              <input name="name" required minLength={3} />
            </label>
            <label>
              Platform
              <select name="platformId" required>
                <option value="">Select</option>
                {platforms.data?.map((platform) => (
                  <option key={platform.id} value={platform.id}>
                    {platform.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Due date
              <input name="dueAt" type="datetime-local" required />
            </label>
            <footer>
              <button className="button primary">Start campaign</button>
            </footer>
          </form>
        </div>
      )}
      {item && (
        <ReviewDecision selection={item} close={() => setItem(undefined)} completed={data.reload} />
      )}
      {stepUp && <StepUpDialog close={() => setStepUp(false)} />}
    </Page>
  );
}

function ReviewDecision({
  selection,
  close,
  completed,
}: {
  selection: { review: AccessReview; item: AccessReview['items'][number] };
  close(): void;
  completed(): Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const decide = async (decision: 'KEEP' | 'REVOKE') => {
    if (reason.trim().length < 8) return setError('Enter an evidence-based reason.');
    try {
      await api.decideReviewItem(selection.review.id, selection.item.id, decision, reason);
      close();
      await completed();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-label="Review access assignments">
        <header>
          <div>
            <p className="eyebrow">Assignment certification</p>
            <h2>{selection.item.user.name}</h2>
          </div>
          <button className="icon-control" onClick={close}>
            ×
          </button>
        </header>
        <p>
          {selection.item.assignment.role.name} · {selection.review.platform.name}
        </p>
        {error && <div className="form-error">{error}</div>}
        <label>
          Review evidence
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        <footer>
          <button className="button danger" onClick={() => void decide('REVOKE')}>
            Revoke access
          </button>
          <button className="button primary" onClick={() => void decide('KEEP')}>
            Keep access
          </button>
        </footer>
      </div>
    </div>
  );
}

export function EmergencyAccessPage() {
  const auth = useAuth();
  const data = useAsync(api.emergencyAccess, []);
  const admins = useAsync(api.administrators, []);
  const platforms = useAsync(api.platforms, []);
  const [platformId, setPlatformId] = useState('');
  const permissions = useAsync(() => api.permissions(platformId || undefined), [platformId]);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<EmergencyAccess>();
  const [stepUp, setStepUp] = useState(false);
  const [error, setError] = useState('');
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api.requestEmergencyAccess({
        adminUserId: String(form.get('adminUserId')),
        platformId,
        permissions: form.getAll('permissions').map(String),
        incidentId: String(form.get('incidentId')),
        reason: String(form.get('reason')),
        expiresAt: new Date(Date.now() + Number(form.get('duration')) * 60_000).toISOString(),
      });
      setCreating(false);
      await data.reload();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };
  return (
    <Page
      eyebrow="Break glass"
      title="Emergency access"
      description="Time-bound, independently approved production access tied to a declared incident."
      action={
        <div className="inline-actions">
          <button className="button secondary" onClick={() => setStepUp(true)}>
            Verify MFA
          </button>
          {auth.can('admin.emergency.request') && (
            <button className="button danger" onClick={() => setCreating(true)}>
              Request emergency access
            </button>
          )}
        </div>
      }
    >
      {data.loading ? (
        <LoadingState />
      ) : data.error ? (
        <ErrorState error={data.error} retry={data.reload} />
      ) : !data.data?.length ? (
        <EmptyState
          title="No emergency access"
          description="Break-glass requests and grants appear here."
        />
      ) : (
        <div className="table-panel">
          <table>
            <thead>
              <tr>
                <th>Recipient</th>
                <th>Platform</th>
                <th>Incident</th>
                <th>Status</th>
                <th>Expires</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.data.map((grant) => (
                <tr key={grant.id}>
                  <td>
                    <strong>{grant.user.name}</strong>
                    <small>{grant.user.email}</small>
                  </td>
                  <td>{grant.platform.name}</td>
                  <td>{grant.incidentId}</td>
                  <td>
                    <StatusBadge value={grant.status} />
                  </td>
                  <td>{formatDate(grant.expiresAt)}</td>
                  <td>
                    <button className="text-link" onClick={() => setSelected(grant)}>
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {creating && (
        <div className="modal-backdrop">
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Request emergency access"
            onSubmit={create}
          >
            <header>
              <div>
                <p className="eyebrow">Break-glass request</p>
                <h2>Request emergency access</h2>
              </div>
              <button type="button" className="icon-control" onClick={() => setCreating(false)}>
                ×
              </button>
            </header>
            {error && <div className="form-error">{error}</div>}
            <label>
              Recipient
              <select name="adminUserId" required>
                <option value="">Select</option>
                {admins.data?.map((admin) => (
                  <option key={admin.id} value={admin.id}>
                    {admin.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Platform
              <select
                required
                value={platformId}
                onChange={(event) => setPlatformId(event.target.value)}
              >
                <option value="">Select</option>
                {platforms.data?.map((platform) => (
                  <option key={platform.id} value={platform.id}>
                    {platform.name}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="permission-picker">
              <legend>Permissions</legend>
              {permissions.data?.map((permission) => (
                <label key={permission.id}>
                  <input type="checkbox" name="permissions" value={permission.key} />
                  {permission.key}
                </label>
              ))}
            </fieldset>
            <label>
              Incident ID
              <input name="incidentId" required />
            </label>
            <label>
              Duration
              <select name="duration">
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
              </select>
            </label>
            <label>
              Reason
              <textarea name="reason" required minLength={8} />
            </label>
            <footer>
              <button className="button danger">Submit break-glass request</button>
            </footer>
          </form>
        </div>
      )}
      {selected && (
        <EmergencyDecision
          grant={selected}
          close={() => setSelected(undefined)}
          completed={data.reload}
          canApprove={auth.can('admin.emergency.approve')}
          currentUserId={auth.session!.user.id}
        />
      )}
      {stepUp && <StepUpDialog close={() => setStepUp(false)} />}
    </Page>
  );
}

function EmergencyDecision({
  grant,
  close,
  completed,
  canApprove,
  currentUserId,
}: {
  grant: EmergencyAccess;
  close(): void;
  completed(): Promise<void>;
  canApprove: boolean;
  currentUserId: string;
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const act = async (action: () => Promise<unknown>) => {
    if (reason.trim().length < 8) return setError('Enter a reason of at least 8 characters.');
    try {
      await action();
      close();
      await completed();
    } catch (cause) {
      setError(errorMessage(cause));
    }
  };
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-label="Review emergency access">
        <header>
          <div>
            <p className="eyebrow">Incident {grant.incidentId}</p>
            <h2>{grant.user.name}</h2>
          </div>
          <button className="icon-control" onClick={close}>
            ×
          </button>
        </header>
        <p>
          {grant.platform.name} · {grant.permissions.join(', ')}
        </p>
        <p>{grant.reason}</p>
        {error && <div className="form-error">{error}</div>}
        <label>
          Decision reason
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        <footer>
          {grant.status === 'PENDING' && canApprove && grant.requester.id !== currentUserId && (
            <>
              <button
                className="button danger"
                onClick={() => void act(() => api.decideEmergencyAccess(grant.id, false, reason))}
              >
                Reject
              </button>
              <button
                className="button primary"
                onClick={() => void act(() => api.decideEmergencyAccess(grant.id, true, reason))}
              >
                Approve
              </button>
            </>
          )}
          {grant.status === 'ACTIVE' && canApprove && (
            <button
              className="button danger"
              onClick={() => void act(() => api.revokeEmergencyAccess(grant.id, reason))}
            >
              Revoke now
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
