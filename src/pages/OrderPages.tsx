import { useState, type ReactNode } from 'react';
import { useAuth } from '../app/AuthContext.js';
import { Page } from '../components/Page.js';
import { StepUpDialog } from '../components/StepUpDialog.js';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '../components/States.js';
import { api } from '../core/api.js';
import { criticalRequestMessage, executeCriticalOperation } from '../core/criticalOperation.js';
import { formatDate } from '../core/format.js';
import { useAsync } from '../core/useAsync.js';

const PLATFORM = 'pepsa-order';

type JsonRecord = Record<string, unknown>;

function asRecords(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value as JsonRecord[];
  if (value && typeof value === 'object') {
    const record = value as JsonRecord;
    for (const key of ['items', 'data', 'results', 'riders', 'tasks', 'integrations', 'events']) {
      if (Array.isArray(record[key])) return record[key] as JsonRecord[];
    }
  }
  return [];
}

function display(value: unknown) {
  if (value == null) return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  return JSON.stringify(value);
}

function ReasonModal(props: {
  title: string;
  description: string;
  confirmLabel: string;
  busy?: boolean;
  error?: string;
  children?: ReactNode;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  return (
    <div className="modal-backdrop" role="presentation" onClick={props.onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-reason-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="order-reason-title">{props.title}</h2>
        </header>
        <p>{props.description}</p>
        {props.children}
        <label>
          Business reason
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            placeholder="Explain why this change is required"
          />
        </label>
        {props.error ? <p className="form-error">{props.error}</p> : null}
        <footer>
          <button className="button secondary" type="button" onClick={props.onClose}>
            Cancel
          </button>
          <button
            className="button primary"
            type="button"
            disabled={submitting || props.busy || reason.trim().length < 8}
            onClick={() => {
              setSubmitting(true);
              void props.onSubmit(reason.trim()).finally(() => setSubmitting(false));
            }}
          >
            {props.confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}

export function OrderOverviewPage() {
  const health = useAsync(() => api.operation<JsonRecord>(PLATFORM, 'fleet-health'), []);
  const pool = useAsync(() => api.operation<unknown>(PLATFORM, 'processing-pool'), []);
  const tasks = useAsync(() => api.operation<unknown>(PLATFORM, 'dispatch-tasks'), []);
  const metrics = useAsync(() => api.operation<unknown>(PLATFORM, 'metrics-read'), []);
  const loading = health.loading || pool.loading || tasks.loading || metrics.loading;
  const error = health.error || pool.error || tasks.error || metrics.error;
  const poolCount = asRecords(pool.data).length;
  const taskCount = asRecords(tasks.data).length;
  return (
    <Page
      eyebrow="Pepsa Order"
      title="Order overview"
      description="Fleet, processing, and dispatch posture through the pepsa-order admin contract."
    >
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState
          error={error}
          retry={() => {
            void health.reload();
            void pool.reload();
            void tasks.reload();
            void metrics.reload();
          }}
        />
      ) : (
        <div className="metric-grid">
          <article className="metric">
            <span>Fleet health</span>
            <strong>{display(health.data?.status ?? health.data?.state ?? 'ok')}</strong>
            <small>Latest probe</small>
          </article>
          <article className="metric">
            <span>Processing pool</span>
            <strong>{poolCount}</strong>
            <small>Visible pool rows</small>
          </article>
          <article className="metric">
            <span>Dispatch tasks</span>
            <strong>{taskCount}</strong>
            <small>Visible tasks</small>
          </article>
          <article className="metric">
            <span>Metrics</span>
            <strong>{typeof metrics.data === 'string' ? 'stream' : 'ready'}</strong>
            <small>Operations metrics endpoint</small>
          </article>
        </div>
      )}
    </Page>
  );
}

export function OrderPartnersPage() {
  const auth = useAuth();
  const catalog = useAsync(() => api.operation<JsonRecord>(PLATFORM, 'catalog-read'), []);
  const [createOpen, setCreateOpen] = useState(false);
  const [credential, setCredential] = useState<'issue' | 'revoke'>();
  const [partnerId, setPartnerId] = useState('');
  const [credentialId, setCredentialId] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [error, setError] = useState('');
  const [stepUp, setStepUp] = useState(false);
  const [message, setMessage] = useState('');
  return (
    <Page
      eyebrow="Pepsa Order"
      title="Partners and credentials"
      description="Partner lifecycle, catalog reference, and credential issue or revoke with attributed reasons."
      action={
        <div className="inline-actions">
          {auth.can('order.credentials.issue') || auth.can('order.credentials.revoke') ? (
            <button className="button secondary" onClick={() => setStepUp(true)}>
              Verify MFA
            </button>
          ) : null}
          {auth.can('order.partners.write') ? (
            <button className="button primary" onClick={() => setCreateOpen(true)}>
              Create partner
            </button>
          ) : null}
        </div>
      }
    >
      {message ? <p className="banner success">{message}</p> : null}
      <h2>Catalog</h2>
      {catalog.loading ? (
        <LoadingState />
      ) : catalog.error ? (
        <ErrorState error={catalog.error} retry={catalog.reload} />
      ) : (
        <pre className="code-block">{JSON.stringify(catalog.data ?? {}, null, 2)}</pre>
      )}
      <h2 className="section-title">Credentials</h2>
      <div className="filter-bar">
        <label>
          Partner ID
          <input
            value={partnerId}
            onChange={(event) => setPartnerId(event.target.value)}
            placeholder="Partner UUID"
          />
        </label>
        <label>
          Credential ID
          <input
            value={credentialId}
            onChange={(event) => setCredentialId(event.target.value)}
            placeholder="Credential UUID"
          />
        </label>
        {auth.can('order.credentials.issue') ? (
          <button
            className="button secondary"
            disabled={!partnerId.trim()}
            onClick={() => {
              setError('');
              setCredential('issue');
            }}
          >
            Issue credential
          </button>
        ) : null}
        {auth.can('order.credentials.revoke') ? (
          <button
            className="button danger"
            disabled={!credentialId.trim()}
            onClick={() => {
              setError('');
              setCredential('revoke');
            }}
          >
            Revoke credential
          </button>
        ) : null}
      </div>
      {createOpen ? (
        <ReasonModal
          title="Create partner"
          description="Provision a partner record in pepsa-order."
          confirmLabel="Create partner"
          error={error}
          onClose={() => {
            setCreateOpen(false);
            setPartnerName('');
            setError('');
          }}
          onSubmit={async (reason) => {
            try {
              await api.mutate(PLATFORM, 'partners-create', reason, {
                name: partnerName.trim() || 'New partner',
              });
              setCreateOpen(false);
              setPartnerName('');
              setMessage('Partner create submitted.');
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Create failed');
            }
          }}
        >
          <label>
            Partner name
            <input
              aria-label="Partner name"
              value={partnerName}
              onChange={(event) => setPartnerName(event.target.value)}
              placeholder="Acme Logistics"
            />
          </label>
        </ReasonModal>
      ) : null}
      {credential === 'issue' ? (
        <ReasonModal
          title="Issue partner credential"
          description={`Issue a credential for partner ${partnerId}. Plaintext is returned once.`}
          confirmLabel="Issue credential"
          error={error}
          onClose={() => setCredential(undefined)}
          onSubmit={async (reason) => {
            try {
              const payload = {
                partnerId: partnerId.trim(),
                scopes: ['orders:create', 'orders:read'],
              };
              const outcome = await executeCriticalOperation({
                platformKey: PLATFORM,
                operation: 'credentials-issue',
                reason,
                payload,
                requesterId: auth.session?.user.id,
              });
              if (outcome.status === 'requested') {
                setMessage(criticalRequestMessage('credentials-issue'));
                setCredential(undefined);
                return;
              }
              setCredential(undefined);
              setMessage('Credential issue submitted.');
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Issue failed');
            }
          }}
        />
      ) : null}
      {credential === 'revoke' ? (
        <ReasonModal
          title="Revoke partner credential"
          description={`Immediately revoke credential ${credentialId}.`}
          confirmLabel="Revoke credential"
          error={error}
          onClose={() => setCredential(undefined)}
          onSubmit={async (reason) => {
            try {
              const payload = { credentialId: credentialId.trim() };
              const outcome = await executeCriticalOperation({
                platformKey: PLATFORM,
                operation: 'credentials-revoke',
                reason,
                payload,
                requesterId: auth.session?.user.id,
              });
              if (outcome.status === 'requested') {
                setMessage(criticalRequestMessage('credentials-revoke'));
                setCredential(undefined);
                return;
              }
              setCredential(undefined);
              setMessage('Credential revoke submitted.');
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Revoke failed');
            }
          }}
        />
      ) : null}
      {stepUp ? <StepUpDialog close={() => setStepUp(false)} /> : null}
    </Page>
  );
}

export function OrderFleetPage() {
  const auth = useAuth();
  const health = useAsync(() => api.operation<JsonRecord>(PLATFORM, 'fleet-health'), []);
  const riders = useAsync(() => api.operation<unknown>(PLATFORM, 'fleet-riders'), []);
  const [evaluateResult, setEvaluateResult] = useState<JsonRecord>();
  const [mobility, setMobility] = useState('BIKE');
  const [load, setLoad] = useState('1');
  const [error, setError] = useState('');
  const [refreshOpen, setRefreshOpen] = useState(false);
  const riderRows = asRecords(riders.data);
  return (
    <Page
      eyebrow="Pepsa Order"
      title="Fleet"
      description="Fleet health, rider inventory, evaluate capacity, and refresh sync."
      action={
        auth.can('order.fleet.sync') ? (
          <button className="button primary" onClick={() => setRefreshOpen(true)}>
            Refresh fleet
          </button>
        ) : undefined
      }
    >
      {health.loading ? (
        <LoadingState />
      ) : health.error ? (
        <ErrorState error={health.error} retry={health.reload} />
      ) : (
        <div className="metric-grid">
          <article className="metric">
            <span>Health</span>
            <strong>{display(health.data?.status ?? health.data?.state ?? 'unknown')}</strong>
            <small>Fleet probe</small>
          </article>
        </div>
      )}
      <h2 className="section-title">Riders</h2>
      {riders.loading ? (
        <LoadingState />
      ) : riders.error ? (
        <ErrorState error={riders.error} retry={riders.reload} />
      ) : !riderRows.length ? (
        <EmptyState title="No riders" description="Fleet riders will appear after a successful sync." />
      ) : (
        <div className="table-panel">
          <table aria-label="Fleet riders">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name / external</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {riderRows.map((rider, index) => (
                <tr key={String(rider.id ?? rider.externalId ?? index)}>
                  <td>
                    <code>{display(rider.id ?? rider.externalId)}</code>
                  </td>
                  <td>{display(rider.name ?? rider.displayName ?? rider.externalId)}</td>
                  <td>
                    <StatusBadge value={String(rider.status ?? rider.state ?? 'UNKNOWN')} />
                  </td>
                  <td>
                    {rider.updatedAt || rider.syncedAt
                      ? formatDate(String(rider.updatedAt ?? rider.syncedAt))
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h2 className="section-title">Evaluate</h2>
      <div className="filter-bar">
        <label>
          Required mobility
          <input value={mobility} onChange={(event) => setMobility(event.target.value)} />
        </label>
        <label>
          Additional load
          <input value={load} onChange={(event) => setLoad(event.target.value)} />
        </label>
        <button
          className="button secondary"
          onClick={() => {
            setError('');
            void api
              .mutate(PLATFORM, 'fleet-evaluate', 'Evaluate fleet capacity for operations', {
                requiredMobility: mobility,
                additionalLoad: Number(load) || 0,
              })
              .then((result) => setEvaluateResult(result as JsonRecord))
              .catch((cause) =>
                setError(cause instanceof Error ? cause.message : 'Evaluate failed'),
              );
          }}
        >
          Evaluate
        </button>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {evaluateResult ? (
        <pre className="code-block">{JSON.stringify(evaluateResult, null, 2)}</pre>
      ) : null}
      {refreshOpen ? (
        <ReasonModal
          title="Refresh fleet"
          description="Pull the latest fleet snapshot from the configured provider."
          confirmLabel="Refresh"
          error={error}
          onClose={() => setRefreshOpen(false)}
          onSubmit={async (reason) => {
            try {
              await api.mutate(PLATFORM, 'fleet-refresh', reason, {});
              setRefreshOpen(false);
              await Promise.all([health.reload(), riders.reload()]);
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Refresh failed');
            }
          }}
        />
      ) : null}
    </Page>
  );
}

export function OrderProcessingPage() {
  const auth = useAuth();
  const pool = useAsync(() => api.operation<unknown>(PLATFORM, 'processing-pool'), []);
  const [runId, setRunId] = useState('');
  const [batchId, setBatchId] = useState('');
  const [detail, setDetail] = useState<JsonRecord>();
  const [action, setAction] = useState<'automatic' | 'optimize' | 'manual'>();
  const [error, setError] = useState('');
  const rows = asRecords(pool.data);
  return (
    <Page
      eyebrow="Pepsa Order"
      title="Processing"
      description="Inspect the processing pool and start automatic, optimize, or manual runs."
      action={
        <div className="inline-actions">
          {auth.can('order.processing.run') ? (
            <>
              <button className="button secondary" onClick={() => setAction('automatic')}>
                Run automatic
              </button>
              <button className="button secondary" onClick={() => setAction('optimize')}>
                Run optimize
              </button>
            </>
          ) : null}
          {auth.can('order.processing.manual') ? (
            <button className="button primary" onClick={() => setAction('manual')}>
              Run manual
            </button>
          ) : null}
        </div>
      }
    >
      {pool.loading ? (
        <LoadingState />
      ) : pool.error ? (
        <ErrorState error={pool.error} retry={pool.reload} />
      ) : !rows.length ? (
        <EmptyState title="Empty pool" description="No processing pool rows in this environment." />
      ) : (
        <div className="table-panel">
          <table aria-label="Processing pool">
            <thead>
              <tr>
                <th>ID</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={String(row.id ?? index)}>
                  <td>
                    <code>{display(row.id ?? row.runId ?? row.batchId)}</code>
                  </td>
                  <td>
                    <StatusBadge value={String(row.status ?? 'UNKNOWN')} />
                  </td>
                  <td>{display(row.summary ?? row.type ?? row.partnerId)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h2 className="section-title">Inspect</h2>
      <div className="filter-bar">
        <label>
          Run ID
          <input value={runId} onChange={(event) => setRunId(event.target.value)} />
        </label>
        <button
          className="button secondary"
          disabled={!runId.trim()}
          onClick={() => {
            setError('');
            void api
              .operation<JsonRecord>(
                PLATFORM,
                'processing-run-get',
                `?${new URLSearchParams({ runId: runId.trim() })}`,
              )
              .then(setDetail)
              .catch((cause) => setError(cause instanceof Error ? cause.message : 'Load failed'));
          }}
        >
          Load run
        </button>
        <label>
          Batch ID
          <input value={batchId} onChange={(event) => setBatchId(event.target.value)} />
        </label>
        <button
          className="button secondary"
          disabled={!batchId.trim()}
          onClick={() => {
            void api
              .operation<JsonRecord>(
                PLATFORM,
                'processing-batch-get',
                `?${new URLSearchParams({ batchId: batchId.trim() })}`,
              )
              .then(setDetail)
              .catch((cause) => setError(cause instanceof Error ? cause.message : 'Load failed'));
          }}
        >
          Load batch
        </button>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {detail ? <pre className="code-block">{JSON.stringify(detail, null, 2)}</pre> : null}
      {action ? (
        <ReasonModal
          title={`Start ${action} run`}
          description="Attributed processing mutations require a business reason."
          confirmLabel="Start run"
          error={error}
          onClose={() => setAction(undefined)}
          onSubmit={async (reason) => {
            try {
              const operation =
                action === 'automatic'
                  ? 'processing-run-automatic'
                  : action === 'optimize'
                    ? 'processing-run-optimize'
                    : 'processing-run-manual';
              await api.mutate(PLATFORM, operation, reason, {});
              setAction(undefined);
              await pool.reload();
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Run failed');
            }
          }}
        />
      ) : null}
    </Page>
  );
}

export function OrderDispatchPage() {
  const auth = useAuth();
  const tasks = useAsync(() => api.operation<unknown>(PLATFORM, 'dispatch-tasks'), []);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [refundId, setRefundId] = useState('');
  const [detail, setDetail] = useState<JsonRecord>();
  const [offerOpen, setOfferOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [stepUp, setStepUp] = useState(false);
  const [error, setError] = useState('');
  const rows = asRecords(tasks.data);
  return (
    <Page
      eyebrow="Pepsa Order"
      title="Dispatch"
      description="Inspect dispatch tasks, create replacement offers, and retry refunds."
      action={
        auth.can('order.dispatch.refund') ? (
          <button className="button secondary" onClick={() => setStepUp(true)}>
            Verify MFA
          </button>
        ) : undefined
      }
    >
      {tasks.loading ? (
        <LoadingState />
      ) : tasks.error ? (
        <ErrorState error={tasks.error} retry={tasks.reload} />
      ) : !rows.length ? (
        <EmptyState title="No dispatch tasks" description="Tasks will appear as orders enter dispatch." />
      ) : (
        <div className="table-panel">
          <table aria-label="Dispatch tasks">
            <thead>
              <tr>
                <th>Task</th>
                <th>Status</th>
                <th>Shipment</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((task, index) => {
                const taskId = String(task.id ?? task.taskId ?? index);
                return (
                  <tr key={taskId}>
                    <td>
                      <code>{taskId}</code>
                    </td>
                    <td>
                      <StatusBadge value={String(task.status ?? 'UNKNOWN')} />
                    </td>
                    <td>{display(task.shipmentId ?? task.orderId)}</td>
                    <td>
                      <button
                        className="text-link"
                        onClick={() => {
                          setSelectedTaskId(taskId);
                          void api
                            .operation<JsonRecord>(
                              PLATFORM,
                              'dispatch-task-get',
                              `?${new URLSearchParams({ taskId })}`,
                            )
                            .then(setDetail)
                            .catch((cause) =>
                              setError(cause instanceof Error ? cause.message : 'Load failed'),
                            );
                        }}
                      >
                        Open
                      </button>
                      {auth.can('order.dispatch.write') ? (
                        <button
                          className="text-link"
                          onClick={() => {
                            setSelectedTaskId(taskId);
                            setError('');
                            setOfferOpen(true);
                          }}
                        >
                          Offer / reassign
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {detail ? <pre className="code-block">{JSON.stringify(detail, null, 2)}</pre> : null}
      <h2 className="section-title">Refund retry</h2>
      <div className="filter-bar">
        <label>
          Refund ID
          <input value={refundId} onChange={(event) => setRefundId(event.target.value)} />
        </label>
        {auth.can('order.dispatch.refund') ? (
          <button
            className="button danger"
            disabled={!refundId.trim()}
            onClick={() => {
              setError('');
              setRefundOpen(true);
            }}
          >
            Retry refund
          </button>
        ) : null}
      </div>
      {offerOpen ? (
        <ReasonModal
          title="Create dispatch offer"
          description={`Create or reassign an offer for task ${selectedTaskId}.`}
          confirmLabel="Create offer"
          error={error}
          onClose={() => setOfferOpen(false)}
          onSubmit={async (reason) => {
            try {
              await api.mutate(PLATFORM, 'dispatch-offer', reason, {
                taskId: selectedTaskId,
              });
              setOfferOpen(false);
              await tasks.reload();
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Offer failed');
            }
          }}
        />
      ) : null}
      {refundOpen ? (
        <ReasonModal
          title="Retry refund"
          description={`Retry refund reconciliation for ${refundId}.`}
          confirmLabel="Retry refund"
          error={error}
          onClose={() => setRefundOpen(false)}
          onSubmit={async (reason) => {
            try {
              const payload = { refundId: refundId.trim() };
              const outcome = await executeCriticalOperation({
                platformKey: PLATFORM,
                operation: 'dispatch-refund-retry',
                reason,
                payload,
                requesterId: auth.session?.user.id,
              });
              if (outcome.status === 'requested') {
                setError(criticalRequestMessage('dispatch-refund-retry'));
                setRefundOpen(false);
                return;
              }
              setRefundOpen(false);
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Refund retry failed');
            }
          }}
        />
      ) : null}
      {stepUp ? <StepUpDialog close={() => setStepUp(false)} /> : null}
    </Page>
  );
}

export function OrderPoliciesPage() {
  const auth = useAuth();
  const active = useAsync(() => api.operation<JsonRecord>(PLATFORM, 'policies-active'), []);
  const [version, setVersion] = useState('');
  const [historical, setHistorical] = useState<JsonRecord>();
  const [publishOpen, setPublishOpen] = useState(false);
  const [policyBody, setPolicyBody] = useState('{}');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [stepUp, setStepUp] = useState(false);
  return (
    <Page
      eyebrow="Pepsa Order"
      title="Operations policies"
      description="Inspect the active policy version and publish a new attributed policy."
      action={
        <div className="inline-actions">
          {auth.can('order.operations.policies.write') ? (
            <>
              <button className="button secondary" onClick={() => setStepUp(true)}>
                Verify MFA
              </button>
              <button className="button primary" onClick={() => setPublishOpen(true)}>
                Publish policy
              </button>
            </>
          ) : undefined}
        </div>
      }
    >
      {message ? <p className="banner success">{message}</p> : null}
      {active.loading ? (
        <LoadingState />
      ) : active.error ? (
        <ErrorState error={active.error} retry={active.reload} />
      ) : (
        <pre className="code-block">{JSON.stringify(active.data ?? {}, null, 2)}</pre>
      )}
      <h2 className="section-title">Historical version</h2>
      <div className="filter-bar">
        <label>
          Version
          <input value={version} onChange={(event) => setVersion(event.target.value)} />
        </label>
        <button
          className="button secondary"
          disabled={!version.trim()}
          onClick={() => {
            void api
              .operation<JsonRecord>(
                PLATFORM,
                'policies-version',
                `?${new URLSearchParams({ version: version.trim() })}`,
              )
              .then(setHistorical)
              .catch((cause) => setError(cause instanceof Error ? cause.message : 'Load failed'));
          }}
        >
          Load version
        </button>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      {historical ? <pre className="code-block">{JSON.stringify(historical, null, 2)}</pre> : null}
      {publishOpen ? (
        <>
          <label>
            Policy JSON body
            <textarea
              aria-label="Policy JSON body"
              rows={6}
              value={policyBody}
              onChange={(event) => setPolicyBody(event.target.value)}
            />
          </label>
          <ReasonModal
            title="Publish operations policy"
            description="Publishing activates a new immutable policy version. Dual approval is required."
            confirmLabel="Publish"
            error={error}
            onClose={() => setPublishOpen(false)}
            onSubmit={async (reason) => {
              try {
                const payload = JSON.parse(policyBody) as JsonRecord;
                const outcome = await executeCriticalOperation({
                  platformKey: PLATFORM,
                  operation: 'policies-publish',
                  reason,
                  payload,
                  requesterId: auth.session?.user.id,
                });
                if (outcome.status === 'requested') {
                  setMessage(criticalRequestMessage('policies-publish'));
                  setPublishOpen(false);
                  return;
                }
                setPublishOpen(false);
                setMessage('Policy publish submitted.');
                await active.reload();
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : 'Publish failed');
              }
            }}
          />
        </>
      ) : null}
      {stepUp ? <StepUpDialog close={() => setStepUp(false)} /> : null}
    </Page>
  );
}

export function OrderEventsPage() {
  const auth = useAuth();
  const [partnerId, setPartnerId] = useState('');
  const query = partnerId.trim()
    ? `?${new URLSearchParams({ partnerId: partnerId.trim() })}`
    : '';
  const events = useAsync(
    () =>
      partnerId.trim()
        ? api.operation<unknown>(PLATFORM, 'events-list', query)
        : Promise.resolve([]),
    [partnerId],
  );
  const audits = useAsync(
    () =>
      partnerId.trim()
        ? api.operation<unknown>(PLATFORM, 'audits-list', query)
        : Promise.resolve([]),
    [partnerId],
  );
  const failures = useAsync(() => api.operation<unknown>(PLATFORM, 'provider-failures'), []);
  const [replay, setReplay] = useState<{ type: 'webhook' | 'notification'; id: string }>();
  const [callbackOpen, setCallbackOpen] = useState(false);
  const [error, setError] = useState('');
  return (
    <Page
      eyebrow="Pepsa Order"
      title="Events and recovery"
      description="Partner events, audits, provider failures, delivery replay, and BAS callback provisioning."
      action={
        auth.can('order.events.operate') ? (
          <button className="button secondary" onClick={() => setCallbackOpen(true)}>
            Provision BAS callback
          </button>
        ) : undefined
      }
    >
      <div className="filter-bar">
        <label>
          Partner ID
          <input
            aria-label="Partner ID for events"
            value={partnerId}
            onChange={(event) => setPartnerId(event.target.value)}
            placeholder="Required for events and audits"
          />
        </label>
      </div>
      <h2>Provider failures</h2>
      {failures.loading ? (
        <LoadingState />
      ) : failures.error ? (
        <ErrorState error={failures.error} retry={failures.reload} />
      ) : (
        <pre className="code-block">{JSON.stringify(failures.data ?? [], null, 2)}</pre>
      )}
      <h2 className="section-title">Events</h2>
      {!partnerId.trim() ? (
        <EmptyState title="Partner required" description="Enter a partner ID to list events." />
      ) : events.loading ? (
        <LoadingState />
      ) : events.error ? (
        <ErrorState error={events.error} retry={events.reload} />
      ) : (
        <pre className="code-block">{JSON.stringify(events.data ?? [], null, 2)}</pre>
      )}
      <h2 className="section-title">Audits</h2>
      {!partnerId.trim() ? (
        <EmptyState title="Partner required" description="Enter a partner ID to list audits." />
      ) : audits.loading ? (
        <LoadingState />
      ) : audits.error ? (
        <ErrorState error={audits.error} retry={audits.reload} />
      ) : (
        <pre className="code-block">{JSON.stringify(audits.data ?? [], null, 2)}</pre>
      )}
      {auth.can('order.events.operate') ? (
        <div className="filter-bar">
          <button
            className="button secondary"
            onClick={() => setReplay({ type: 'webhook', id: window.prompt('Webhook delivery ID') ?? '' })}
          >
            Replay webhook
          </button>
          <button
            className="button secondary"
            onClick={() =>
              setReplay({ type: 'notification', id: window.prompt('Notification delivery ID') ?? '' })
            }
          >
            Replay notification
          </button>
        </div>
      ) : null}
      {replay?.id ? (
        <ReasonModal
          title={`Replay ${replay.type}`}
          description={`Replay delivery ${replay.id}.`}
          confirmLabel="Replay"
          error={error}
          onClose={() => setReplay(undefined)}
          onSubmit={async (reason) => {
            try {
              await api.mutate(
                PLATFORM,
                replay.type === 'webhook' ? 'webhook-replay' : 'notification-replay',
                reason,
                { id: replay.id },
              );
              setReplay(undefined);
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Replay failed');
            }
          }}
        />
      ) : null}
      {callbackOpen ? (
        <ReasonModal
          title="Provision BAS callback"
          description="Create a BAS callback subscription in pepsa-order."
          confirmLabel="Provision"
          error={error}
          onClose={() => setCallbackOpen(false)}
          onSubmit={async (reason) => {
            try {
              await api.mutate(PLATFORM, 'bas-callbacks-provision', reason, {});
              setCallbackOpen(false);
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Provision failed');
            }
          }}
        />
      ) : null}
    </Page>
  );
}

export function OrderIntegrationsPage() {
  const auth = useAuth();
  const list = useAsync(() => api.operation<unknown>(PLATFORM, 'integrations-list'), []);
  const [stepUp, setStepUp] = useState(false);
  const [action, setAction] = useState<{
    operation: 'integrations-upsert' | 'integrations-disable' | 'integrations-rotate';
    id?: string;
  }>();
  const [error, setError] = useState('');
  const rows = asRecords(list.data);
  return (
    <Page
      eyebrow="Pepsa Order"
      title="Integrations"
      description="Safe integration registry metadata. Secrets are never returned."
      action={
        <div className="inline-actions">
          {auth.can('order.integrations.write') ? (
            <>
              <button className="button secondary" onClick={() => setStepUp(true)}>
                Verify MFA
              </button>
              <button
                className="button primary"
                onClick={() => setAction({ operation: 'integrations-upsert' })}
              >
                Upsert integration
              </button>
            </>
          ) : null}
        </div>
      }
    >
      {list.loading ? (
        <LoadingState />
      ) : list.error ? (
        <ErrorState error={list.error} retry={list.reload} />
      ) : !rows.length ? (
        <EmptyState title="No integrations" description="Registry entries will appear here." />
      ) : (
        <div className="table-panel">
          <table aria-label="Integrations">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((item, index) => {
                const id = String(item.id ?? index);
                return (
                  <tr key={id}>
                    <td>
                      <code>{id}</code>
                    </td>
                    <td>{display(item.name ?? item.key ?? item.type)}</td>
                    <td>
                      <StatusBadge value={String(item.status ?? item.state ?? 'UNKNOWN')} />
                    </td>
                    <td>
                      {auth.can('order.integrations.write') ? (
                        <>
                          <button
                            className="text-link"
                            onClick={() => setAction({ operation: 'integrations-disable', id })}
                          >
                            Disable
                          </button>
                          <button
                            className="text-link danger-link"
                            onClick={() => setAction({ operation: 'integrations-rotate', id })}
                          >
                            Rotate
                          </button>
                        </>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {action ? (
        <ReasonModal
          title={
            action.operation === 'integrations-upsert'
              ? 'Upsert integration'
              : action.operation === 'integrations-disable'
                ? 'Disable integration'
                : 'Rotate integration'
          }
          description="Attributed integration mutations require a business reason."
          confirmLabel="Confirm"
          error={error}
          onClose={() => setAction(undefined)}
          onSubmit={async (reason) => {
            try {
              const payload = action.id ? { id: action.id } : { name: 'integration' };
              if (action.operation === 'integrations-rotate') {
                const outcome = await executeCriticalOperation({
                  platformKey: PLATFORM,
                  operation: action.operation,
                  reason,
                  payload,
                  requesterId: auth.session?.user.id,
                });
                if (outcome.status === 'requested') {
                  setError(criticalRequestMessage('integrations-rotate'));
                  setAction(undefined);
                  return;
                }
              } else {
                await api.mutate(PLATFORM, action.operation, reason, payload);
              }
              setAction(undefined);
              await list.reload();
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Mutation failed');
            }
          }}
        />
      ) : null}
      {stepUp ? <StepUpDialog close={() => setStepUp(false)} /> : null}
    </Page>
  );
}
