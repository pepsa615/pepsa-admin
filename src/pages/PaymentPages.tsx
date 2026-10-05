import { useState, type ReactNode } from 'react';
import { useAuth } from '../app/AuthContext.js';
import { Page } from '../components/Page.js';
import { StepUpDialog } from '../components/StepUpDialog.js';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '../components/States.js';
import { api } from '../core/api.js';
import { criticalRequestMessage, executeCriticalOperation } from '../core/criticalOperation.js';
import { useAsync } from '../core/useAsync.js';

const PLATFORM = 'pepsa-payment';

type JsonRecord = Record<string, unknown>;

function asRecords(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value as JsonRecord[];
  if (value && typeof value === 'object') {
    const record = value as JsonRecord;
    for (const key of ['items', 'data', 'results', 'rows', 'records']) {
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
        aria-labelledby="payment-reason-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="payment-reason-title">{props.title}</h2>
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

export function PaymentOverviewPage() {
  const sva = useAsync(() => api.operation<unknown>(PLATFORM, 'sva-provisioning-list'), []);
  const checkout = useAsync(
    () => api.operation<unknown>(PLATFORM, 'checkout-provisioning-list'),
    [],
  );
  const loading = sva.loading || checkout.loading;
  const error = sva.error || checkout.error;
  const svaRows = asRecords(sva.data);
  const checkoutRows = asRecords(checkout.data);
  return (
    <Page
      eyebrow="Pepsa Payment"
      title="Payment overview"
      description="SVA and checkout provisioning posture through the pepsa-payment admin contract."
    >
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState
          error={error}
          retry={() => {
            void sva.reload();
            void checkout.reload();
          }}
        />
      ) : (
        <div className="metric-grid">
          <article className="metric">
            <span>SVA provisioning</span>
            <strong>{svaRows.length}</strong>
            <small>Visible queue rows</small>
          </article>
          <article className="metric">
            <span>Checkout / DVA</span>
            <strong>{checkoutRows.length}</strong>
            <small>Visible queue rows</small>
          </article>
          <article className="metric">
            <span>SVA sample</span>
            <strong>
              {display(svaRows[0]?.status ?? svaRows[0]?.state ?? (svaRows.length ? 'loaded' : 'empty'))}
            </strong>
            <small>First row status</small>
          </article>
          <article className="metric">
            <span>Checkout sample</span>
            <strong>
              {display(
                checkoutRows[0]?.status ??
                  checkoutRows[0]?.state ??
                  (checkoutRows.length ? 'loaded' : 'empty'),
              )}
            </strong>
            <small>First row status</small>
          </article>
        </div>
      )}
    </Page>
  );
}

export function PaymentPlatformsPage() {
  const auth = useAuth();
  const [platformId, setPlatformId] = useState('');
  const [onboardName, setOnboardName] = useState('');
  const [statusValue, setStatusValue] = useState('SUSPENDED');
  const [action, setAction] = useState<'onboard' | 'status' | 'rotate'>();
  const [stepUp, setStepUp] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [oneTimeKey, setOneTimeKey] = useState('');
  return (
    <Page
      eyebrow="Pepsa Payment"
      title="Platforms"
      description="Onboard platforms, change status, and rotate API keys. Keys are shown once."
      action={
        auth.can('payment.platforms.keys.rotate') ? (
          <button className="button secondary" onClick={() => setStepUp(true)}>
            Verify MFA
          </button>
        ) : undefined
      }
    >
      {message ? <p className="banner success">{message}</p> : null}
      {oneTimeKey ? (
        <p className="banner success" role="status">
          One-time API key (copy now): <code>{oneTimeKey}</code>
        </p>
      ) : null}
      <div className="filter-bar">
        <label>
          Platform ID
          <input
            aria-label="Platform ID"
            value={platformId}
            onChange={(event) => setPlatformId(event.target.value)}
            placeholder="Platform UUID"
          />
        </label>
        {auth.can('payment.platforms.write') ? (
          <button
            className="button primary"
            onClick={() => {
              setError('');
              setAction('onboard');
            }}
          >
            Onboard platform
          </button>
        ) : null}
        {auth.can('payment.platforms.status') ? (
          <button
            className="button secondary"
            disabled={!platformId.trim()}
            onClick={() => {
              setError('');
              setAction('status');
            }}
          >
            Update status
          </button>
        ) : null}
        {auth.can('payment.platforms.keys.rotate') ? (
          <button
            className="button danger"
            disabled={!platformId.trim()}
            onClick={() => {
              setError('');
              setAction('rotate');
            }}
          >
            Rotate API key
          </button>
        ) : null}
      </div>
      {action === 'onboard' ? (
        <ReasonModal
          title="Onboard platform"
          description="Create a payment platform record. A one-time API key may be returned."
          confirmLabel="Onboard"
          error={error}
          onClose={() => setAction(undefined)}
          onSubmit={async (reason) => {
            try {
              const result = await api.mutate<JsonRecord>(PLATFORM, 'platforms-onboard', reason, {
                name: onboardName.trim() || 'Sandbox platform',
              });
              const key = result?.apiKey ?? result?.api_key ?? result?.key;
              if (typeof key === 'string') setOneTimeKey(key);
              setAction(undefined);
              setOnboardName('');
              setMessage('Platform onboard submitted.');
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Onboard failed');
            }
          }}
        >
          <label>
            Platform name
            <input
              aria-label="Platform name"
              value={onboardName}
              onChange={(event) => setOnboardName(event.target.value)}
              placeholder="Acme Payments"
            />
          </label>
        </ReasonModal>
      ) : null}
      {action === 'status' ? (
        <ReasonModal
          title="Update platform status"
          description={`Set status for platform ${platformId}.`}
          confirmLabel="Update status"
          error={error}
          onClose={() => setAction(undefined)}
          onSubmit={async (reason) => {
            try {
              const payload = {
                platformId: platformId.trim(),
                status: statusValue,
              };
              const outcome = await executeCriticalOperation({
                platformKey: PLATFORM,
                operation: 'platforms-status',
                reason,
                payload,
                requesterId: auth.session?.user.id,
              });
              if (outcome.status === 'requested') {
                setMessage(criticalRequestMessage('platforms-status'));
                setAction(undefined);
                return;
              }
              setAction(undefined);
              setMessage('Platform status update submitted.');
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Status update failed');
            }
          }}
        >
          <label>
            Status
            <select
              aria-label="Platform status"
              value={statusValue}
              onChange={(event) => setStatusValue(event.target.value)}
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="REVOKED">REVOKED</option>
            </select>
          </label>
        </ReasonModal>
      ) : null}
      {action === 'rotate' ? (
        <ReasonModal
          title="Rotate platform API key"
          description={`Rotate the API key for ${platformId}. The previous key is invalidated. Dual approval required.`}
          confirmLabel="Rotate key"
          error={error}
          onClose={() => setAction(undefined)}
          onSubmit={async (reason) => {
            try {
              const payload = { platformId: platformId.trim() };
              const outcome = await executeCriticalOperation({
                platformKey: PLATFORM,
                operation: 'platforms-rotate-key',
                reason,
                payload,
                requesterId: auth.session?.user.id,
              });
              if (outcome.status === 'requested') {
                setMessage(criticalRequestMessage('platforms-rotate-key'));
                setAction(undefined);
                return;
              }
              const result = outcome.result as JsonRecord;
              const key = result?.apiKey ?? result?.api_key ?? result?.key;
              if (typeof key === 'string') setOneTimeKey(key);
              setAction(undefined);
              setMessage('API key rotation submitted.');
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Rotate failed');
            }
          }}
        />
      ) : null}
      {stepUp ? <StepUpDialog close={() => setStepUp(false)} /> : null}
    </Page>
  );
}

export function PaymentSettingsPage() {
  const auth = useAuth();
  const [platformId, setPlatformId] = useState('');
  const [loadedId, setLoadedId] = useState('');
  const transfer = useAsync(
    () =>
      loadedId
        ? api.operation<JsonRecord>(
            PLATFORM,
            'transfer-settings-get',
            `?${new URLSearchParams({ platformId: loadedId })}`,
          )
        : Promise.resolve(undefined),
    [loadedId],
  );
  const vas = useAsync(
    () =>
      loadedId
        ? api.operation<JsonRecord>(
            PLATFORM,
            'vas-settings-get',
            `?${new URLSearchParams({ platformId: loadedId })}`,
          )
        : Promise.resolve(undefined),
    [loadedId],
  );
  const settlement = useAsync(
    () =>
      loadedId
        ? api.operation<JsonRecord>(
            PLATFORM,
            'settlement-settings-get',
            `?${new URLSearchParams({ platformId: loadedId })}`,
          )
        : Promise.resolve(undefined),
    [loadedId],
  );
  const [patch, setPatch] = useState<'transfer' | 'vas' | 'settlement'>();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [stepUp, setStepUp] = useState(false);
  return (
    <Page
      eyebrow="Pepsa Payment"
      title="Settings"
      description="Transfer, VAS, and settlement policy for a payment platform."
      action={
        <button className="button secondary" onClick={() => setStepUp(true)}>
          Verify MFA
        </button>
      }
    >
      {message ? <p className="banner success">{message}</p> : null}
      <div className="filter-bar">
        <label>
          Platform ID
          <input
            aria-label="Settings platform ID"
            value={platformId}
            onChange={(event) => setPlatformId(event.target.value)}
            placeholder="Platform UUID"
          />
        </label>
        <button
          className="button secondary"
          disabled={!platformId.trim()}
          onClick={() => {
            setError('');
            setLoadedId(platformId.trim());
          }}
        >
          Load settings
        </button>
      </div>
      {!loadedId ? (
        <EmptyState
          title="Select a platform"
          description="Enter a platform ID and load transfer, VAS, and settlement settings."
        />
      ) : transfer.loading || vas.loading || settlement.loading ? (
        <LoadingState />
      ) : transfer.error || vas.error || settlement.error ? (
        <ErrorState
          error={
            transfer.error ||
            vas.error ||
            settlement.error ||
            new Error('Load failed')
          }
          retry={() => {
            void transfer.reload();
            void vas.reload();
            void settlement.reload();
          }}
        />
      ) : (
        <>
          <h2 className="section-title">Transfer</h2>
          <pre className="code-block">{JSON.stringify(transfer.data ?? {}, null, 2)}</pre>
          {auth.can('payment.settings.transfer') ? (
            <button className="button secondary" onClick={() => setPatch('transfer')}>
              Patch transfer settings
            </button>
          ) : null}
          <h2 className="section-title">VAS</h2>
          <pre className="code-block">{JSON.stringify(vas.data ?? {}, null, 2)}</pre>
          {auth.can('payment.settings.vas') ? (
            <button className="button secondary" onClick={() => setPatch('vas')}>
              Patch VAS settings
            </button>
          ) : null}
          <h2 className="section-title">Settlement</h2>
          <pre className="code-block">{JSON.stringify(settlement.data ?? {}, null, 2)}</pre>
          {auth.can('payment.settings.settlement') ? (
            <button className="button secondary" onClick={() => setPatch('settlement')}>
              Patch settlement settings
            </button>
          ) : null}
        </>
      )}
      {error ? <p className="form-error">{error}</p> : null}
      {patch ? (
        <ReasonModal
          title={`Patch ${patch} settings`}
          description="Attributed settings mutations require a business reason. Empty patch body refreshes audit trail only when destination allows."
          confirmLabel="Submit patch"
          error={error}
          onClose={() => setPatch(undefined)}
          onSubmit={async (reason) => {
            try {
              const operation =
                patch === 'transfer'
                  ? 'transfer-settings-patch'
                  : patch === 'vas'
                    ? 'vas-settings-patch'
                    : 'settlement-settings-patch';
              await api.mutate(PLATFORM, operation, reason, { platformId: loadedId });
              setPatch(undefined);
              setMessage(`${patch} settings patch submitted.`);
              void transfer.reload();
              void vas.reload();
              void settlement.reload();
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Patch failed');
            }
          }}
        />
      ) : null}
      {stepUp ? <StepUpDialog close={() => setStepUp(false)} /> : null}
    </Page>
  );
}

function ProvisioningTable(props: {
  rows: JsonRecord[];
  idKey: 'userId' | 'checkoutId';
  canReconcile: boolean;
  onReconcile: (id: string) => void;
}) {
  if (!props.rows.length)
    return (
      <EmptyState title="No provisioning rows" description="Queue entries will appear here." />
    );
  return (
    <div className="table-panel">
      <table aria-label="Provisioning queue">
        <thead>
          <tr>
            <th>ID</th>
            <th>Status</th>
            <th>Detail</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row, index) => {
            const id = String(
              row[props.idKey] ?? row.id ?? row.userId ?? row.checkoutId ?? index,
            );
            return (
              <tr key={id}>
                <td>
                  <code>{id}</code>
                </td>
                <td>
                  <StatusBadge value={String(row.status ?? row.state ?? 'UNKNOWN')} />
                </td>
                <td>{display(row.providerStatus ?? row.note ?? row.type ?? '—')}</td>
                <td>
                  {props.canReconcile ? (
                    <button className="text-link" onClick={() => props.onReconcile(id)}>
                      Reconcile
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function PaymentSvaPage() {
  const auth = useAuth();
  const list = useAsync(() => api.operation<unknown>(PLATFORM, 'sva-provisioning-list'), []);
  const [userId, setUserId] = useState('');
  const [action, setAction] = useState('retry');
  const [open, setOpen] = useState(false);
  const [stepUp, setStepUp] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const rows = asRecords(list.data);
  return (
    <Page
      eyebrow="Pepsa Payment"
      title="SVA provisioning"
      description="Inspect SVA provisioning and reconcile stuck rows with attributed actions."
      action={
        auth.can('payment.sva.provisioning.reconcile') ? (
          <button className="button secondary" onClick={() => setStepUp(true)}>
            Verify MFA
          </button>
        ) : undefined
      }
    >
      {message ? <p className="banner success">{message}</p> : null}
      {list.loading ? (
        <LoadingState />
      ) : list.error ? (
        <ErrorState error={list.error} retry={list.reload} />
      ) : (
        <ProvisioningTable
          rows={rows}
          idKey="userId"
          canReconcile={auth.can('payment.sva.provisioning.reconcile')}
          onReconcile={(id) => {
            setUserId(id);
            setError('');
            setOpen(true);
          }}
        />
      )}
      {open ? (
        <ReasonModal
          title="Reconcile SVA provisioning"
          description={`Reconcile user ${userId}. Destination requires a note (mapped from reason if omitted).`}
          confirmLabel="Reconcile"
          error={error}
          onClose={() => setOpen(false)}
          onSubmit={async (reason) => {
            try {
              const payload = {
                userId: userId.trim(),
                action,
              };
              const outcome = await executeCriticalOperation({
                platformKey: PLATFORM,
                operation: 'sva-provisioning-reconcile',
                reason,
                payload,
                requesterId: auth.session?.user.id,
              });
              if (outcome.status === 'requested') {
                setMessage(criticalRequestMessage('sva-provisioning-reconcile'));
                setOpen(false);
                return;
              }
              setOpen(false);
              setMessage('SVA reconcile submitted.');
              await list.reload();
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Reconcile failed');
            }
          }}
        >
          <label>
            Action
            <select
              aria-label="SVA reconcile action"
              value={action}
              onChange={(event) => setAction(event.target.value)}
            >
              <option value="retry">retry</option>
              <option value="activate">activate</option>
              <option value="mark_failed">mark_failed</option>
            </select>
          </label>
        </ReasonModal>
      ) : null}
      {stepUp ? <StepUpDialog close={() => setStepUp(false)} /> : null}
    </Page>
  );
}

export function PaymentCheckoutPage() {
  const auth = useAuth();
  const list = useAsync(() => api.operation<unknown>(PLATFORM, 'checkout-provisioning-list'), []);
  const [checkoutId, setCheckoutId] = useState('');
  const [action, setAction] = useState('retry');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [open, setOpen] = useState(false);
  const [stepUp, setStepUp] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const rows = asRecords(list.data);
  return (
    <Page
      eyebrow="Pepsa Payment"
      title="Checkout / DVA provisioning"
      description="Inspect checkout DVA provisioning and reconcile with provider evidence."
      action={
        auth.can('payment.checkout.provisioning.reconcile') ? (
          <button className="button secondary" onClick={() => setStepUp(true)}>
            Verify MFA
          </button>
        ) : undefined
      }
    >
      {message ? <p className="banner success">{message}</p> : null}
      {list.loading ? (
        <LoadingState />
      ) : list.error ? (
        <ErrorState error={list.error} retry={list.reload} />
      ) : (
        <ProvisioningTable
          rows={rows}
          idKey="checkoutId"
          canReconcile={auth.can('payment.checkout.provisioning.reconcile')}
          onReconcile={(id) => {
            setCheckoutId(id);
            setError('');
            setOpen(true);
          }}
        />
      )}
      {open ? (
        <ReasonModal
          title="Reconcile checkout provisioning"
          description={`Reconcile checkout ${checkoutId}. Activate requires account evidence.`}
          confirmLabel="Reconcile"
          error={error}
          onClose={() => setOpen(false)}
          onSubmit={async (reason) => {
            try {
              const payload = {
                checkoutId: checkoutId.trim(),
                action,
                ...(action === 'activate'
                  ? {
                      account_number: accountNumber.trim(),
                      bank_name: bankName.trim(),
                      expires_at: expiresAt.trim(),
                    }
                  : {}),
              };
              const outcome = await executeCriticalOperation({
                platformKey: PLATFORM,
                operation: 'checkout-provisioning-reconcile',
                reason,
                payload,
                requesterId: auth.session?.user.id,
              });
              if (outcome.status === 'requested') {
                setMessage(criticalRequestMessage('checkout-provisioning-reconcile'));
                setOpen(false);
                return;
              }
              setOpen(false);
              setMessage('Checkout reconcile submitted.');
              await list.reload();
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Reconcile failed');
            }
          }}
        >
          <label>
            Action
            <select
              aria-label="Checkout reconcile action"
              value={action}
              onChange={(event) => setAction(event.target.value)}
            >
              <option value="retry">retry</option>
              <option value="activate">activate</option>
              <option value="mark_failed">mark_failed</option>
            </select>
          </label>
          {action === 'activate' ? (
            <>
              <label>
                Account number
                <input
                  aria-label="Account number"
                  value={accountNumber}
                  onChange={(event) => setAccountNumber(event.target.value)}
                />
              </label>
              <label>
                Bank name
                <input
                  aria-label="Bank name"
                  value={bankName}
                  onChange={(event) => setBankName(event.target.value)}
                />
              </label>
              <label>
                Expires at
                <input
                  aria-label="Expires at"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                  placeholder="ISO-8601"
                />
              </label>
            </>
          ) : null}
        </ReasonModal>
      ) : null}
      {stepUp ? <StepUpDialog close={() => setStepUp(false)} /> : null}
    </Page>
  );
}

export function PaymentKycPage() {
  const auth = useAuth();
  const [open, setOpen] = useState(false);
  const [stepUp, setStepUp] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<JsonRecord>();
  return (
    <Page
      eyebrow="Pepsa Payment"
      title="KYC encryption"
      description="Rotate KYC field encryption under the active key. MFA step-up is required."
      action={
        <div className="inline-actions">
          <button className="button secondary" onClick={() => setStepUp(true)}>
            Verify MFA
          </button>
          <button
            className="button danger"
            onClick={() => {
              setError('');
              setOpen(true);
            }}
          >
            Rotate encryption
          </button>
        </div>
      }
    >
      {message ? <p className="banner success">{message}</p> : null}
      {result ? <pre className="code-block">{JSON.stringify(result, null, 2)}</pre> : null}
      <EmptyState
        title="High-risk control"
        description="Re-encrypts NIN/BVN under the active KYC encryption key. Verify MFA before rotating."
      />
      {open ? (
        <ReasonModal
          title="Rotate KYC encryption"
          description="Re-encrypt stored KYC fields under the active key. This cannot be undone casually."
          confirmLabel="Rotate encryption"
          error={error}
          onClose={() => setOpen(false)}
          onSubmit={async (reason) => {
            try {
              const outcome = await executeCriticalOperation({
                platformKey: PLATFORM,
                operation: 'kyc-rotate-encryption',
                reason,
                payload: {},
                requesterId: auth.session?.user.id,
              });
              if (outcome.status === 'requested') {
                setMessage(criticalRequestMessage('kyc-rotate-encryption'));
                setOpen(false);
                return;
              }
              setResult(outcome.result as JsonRecord);
              setOpen(false);
              setMessage('KYC encryption rotation submitted.');
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Rotation failed');
            }
          }}
        />
      ) : null}
      {stepUp ? <StepUpDialog close={() => setStepUp(false)} /> : null}
    </Page>
  );
}
