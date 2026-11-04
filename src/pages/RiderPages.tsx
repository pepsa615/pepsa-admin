import { useState } from 'react';
import { useAuth } from '../app/AuthContext.js';
import { Page } from '../components/Page.js';
import { StepUpDialog } from '../components/StepUpDialog.js';
import { asRecords, formatMaybeDate, pickString } from '../components/OpsUi.js';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '../components/States.js';
import { api } from '../core/api.js';
import { criticalRequestMessage, executeCriticalOperation } from '../core/criticalOperation.js';
import { useAsync } from '../core/useAsync.js';

const PLATFORM = 'rider';

function Controls({ onStepUp }: { onStepUp: () => void }) {
  return <button className="button secondary" onClick={onStepUp}>Verify MFA</button>;
}

export function RiderWalletProvisioningPage() {
  const auth = useAuth();
  const list = useAsync(() => api.operation<unknown>(PLATFORM, 'wallet-provisioning-list'), []);
  const [stepUp, setStepUp] = useState(false);
  const [message, setMessage] = useState('');
  const rows = asRecords(list.data);
  const reconcile = async (jobId: string, action: 'RETRY' | 'LINK_VERIFIED') => {
    const reason = window.prompt('Operational reason for this reconciliation');
    if (!reason?.trim()) return;
    const outcome = await executeCriticalOperation({ platformKey: PLATFORM, operation: 'wallet-provisioning-reconcile', reason, payload: { jobId, action }, requesterId: auth.session?.user.id });
    setMessage(outcome.status === 'requested' ? criticalRequestMessage('wallet-provisioning-reconcile') : 'Wallet reconciliation completed.');
    if (outcome.status === 'executed') await list.reload();
  };
  return <Page eyebrow="Rider" title="Wallet provisioning" description="Review durable rider wallet jobs and safely reconcile known failures or operator-verified links." action={<Controls onStepUp={() => setStepUp(true)} />}>
    {message ? <p className="banner success">{message}</p> : null}
    {list.loading ? <LoadingState /> : list.error ? <ErrorState error={list.error} retry={list.reload} /> : !rows.length ? <EmptyState title="No provisioning exceptions" description="The rider wallet queue is clear." /> : <div className="table-panel"><table><thead><tr><th>Rider</th><th>Status</th><th>Attempts</th><th>Updated</th><th /></tr></thead><tbody>{rows.map((row) => { const id = pickString(row, 'id') ?? ''; return <tr key={id}><td>{pickString(row, 'riderId', 'rider_id') ?? '—'}</td><td><StatusBadge value={pickString(row, 'status') ?? 'unknown'} /></td><td>{String(row.attempts ?? '—')}</td><td>{formatMaybeDate(row.updatedAt ?? row.updated_at)}</td><td><div className="inline-actions"><button className="text-link" disabled={!auth.can('rider.provisioning.manage')} onClick={() => void reconcile(id, 'RETRY')}>Retry</button></div></td></tr>; })}</tbody></table></div>}
    {stepUp ? <StepUpDialog close={() => setStepUp(false)} /> : null}
  </Page>;
}

export function RiderInsuranceClaimsPage() {
  const auth = useAuth();
  const list = useAsync(() => api.operation<unknown>(PLATFORM, 'insurance-claims-list'), []);
  const [stepUp, setStepUp] = useState(false);
  const [message, setMessage] = useState('');
  const rows = asRecords(list.data);
  const review = async (claimId: string, decision: 'APPROVED' | 'REJECTED') => {
    const reason = window.prompt(`Reason for ${decision.toLowerCase()} decision`);
    if (!reason?.trim()) return;
    const outcome = await executeCriticalOperation({ platformKey: PLATFORM, operation: 'insurance-claim-review', reason, payload: { claimId, decision, reason }, requesterId: auth.session?.user.id });
    setMessage(outcome.status === 'requested' ? criticalRequestMessage('insurance-claim-review') : 'Claim review completed. No payout was initiated.');
    if (outcome.status === 'executed') await list.reload();
  };
  return <Page eyebrow="Rider" title="Insurance claims" description="Govern append-only rider claim requests. Approval records a review decision only and never initiates payout." action={<Controls onStepUp={() => setStepUp(true)} />}>
    {message ? <p className="banner success">{message}</p> : null}
    {list.loading ? <LoadingState /> : list.error ? <ErrorState error={list.error} retry={list.reload} /> : !rows.length ? <EmptyState title="No insurance claims" description="No rider claims await review." /> : <div className="table-panel"><table><thead><tr><th>Rider</th><th>Reason</th><th>Status</th><th>Submitted</th><th /></tr></thead><tbody>{rows.map((row) => { const id = pickString(row, 'id') ?? ''; const rider = row.rider && typeof row.rider === 'object' ? row.rider as Record<string, unknown> : {}; return <tr key={id}><td>{pickString(rider, 'name') ?? pickString(row, 'riderId') ?? '—'}</td><td>{pickString(row, 'reason') ?? '—'}</td><td><StatusBadge value={pickString(row, 'status') ?? 'unknown'} /></td><td>{formatMaybeDate(row.createdAt ?? row.created_at)}</td><td><div className="inline-actions"><button className="text-link" disabled={!auth.can('rider.insurance.manage')} onClick={() => void review(id, 'APPROVED')}>Approve</button><button className="text-link" disabled={!auth.can('rider.insurance.manage')} onClick={() => void review(id, 'REJECTED')}>Reject</button></div></td></tr>; })}</tbody></table></div>}
    {stepUp ? <StepUpDialog close={() => setStepUp(false)} /> : null}
  </Page>;
}
