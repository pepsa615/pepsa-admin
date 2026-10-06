import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../app/AuthContext.js';
import { Page } from '../components/Page.js';
import { StepUpDialog } from '../components/StepUpDialog.js';
import {
  DetailPanel,
  ReasonModal,
  asRecords,
  formatMaybeDate,
  pickString,
  scalar,
  type JsonRecord,
} from '../components/OpsUi.js';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '../components/States.js';
import { api } from '../core/api.js';
import { criticalRequestMessage, executeCriticalOperation } from '../core/criticalOperation.js';
import { useAsync } from '../core/useAsync.js';

const PLATFORM = 'pepsa-payment';

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
              {scalar(
                svaRows[0]?.status ?? svaRows[0]?.state ?? (svaRows.length ? 'loaded' : 'empty'),
              )}
            </strong>
            <small>First row status</small>
          </article>
          <article className="metric">
            <span>Checkout sample</span>
            <strong>
              {scalar(
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
  const navigate = useNavigate();
  const list = useAsync(() => api.operation<unknown>(PLATFORM, 'platforms-list'), []);
  const [selectedId, setSelectedId] = useState('');
  const [onboardName, setOnboardName] = useState('');
  const [statusValue, setStatusValue] = useState('suspended');
  const [action, setAction] = useState<'onboard' | 'status' | 'rotate'>();
  const [stepUp, setStepUp] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [oneTimeKey, setOneTimeKey] = useState('');
  const rows = asRecords(list.data);

  return (
    <Page
      eyebrow="Pepsa Payment"
      title="Platforms"
      description="Browse payment platforms, onboard tenants, change status, and rotate API keys."
      action={
        <div className="inline-actions">
          {auth.can('payment.platforms.keys.rotate') || auth.can('payment.platforms.status') ? (
            <button className="button secondary" onClick={() => setStepUp(true)}>
              Verify MFA
            </button>
          ) : null}
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
        </div>
      }
    >
      {message ? <p className="banner success">{message}</p> : null}
      {oneTimeKey ? (
        <p className="banner success" role="status">
          One-time API key (copy now): <code>{oneTimeKey}</code>
        </p>
      ) : null}
      {list.loading ? (
        <LoadingState />
      ) : list.error ? (
        <ErrorState error={list.error} retry={list.reload} />
      ) : !rows.length ? (
        <EmptyState
          title="No payment platforms"
          description="Onboard a platform to create the first tenant. Keys are shown once on create or rotate."
        />
      ) : (
        <div className="table-panel">
          <table aria-label="Payment platforms">
            <thead>
              <tr>
                <th>Name</th>
                <th>Platform ID</th>
                <th>Status</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const id = pickString(row, 'platform_id', 'platformId', 'id') ?? '';
                const name = pickString(row, 'name') ?? '—';
                const status = pickString(row, 'status') ?? 'unknown';
                return (
                  <tr key={id || name}>
                    <td>{name}</td>
                    <td>
                      <code>{id || '—'}</code>
                    </td>
                    <td>
                      <StatusBadge value={status} />
                    </td>
                    <td>{formatMaybeDate(row.created_at ?? row.createdAt)}</td>
                    <td>
                      <div className="inline-actions">
                        <button
                          className="text-link"
                          type="button"
                          onClick={() =>
                            navigate(
                              `/p/pepsa-payment/settings?platformId=${encodeURIComponent(id)}`,
                            )
                          }
                          disabled={!id}
                        >
                          Settings
                        </button>
                        {auth.can('payment.platforms.status') ? (
                          <button
                            className="text-link"
                            type="button"
                            onClick={() => {
                              setSelectedId(id);
                              setError('');
                              setAction('status');
                            }}
                            disabled={!id}
                          >
                            Status
                          </button>
                        ) : null}
                        {auth.can('payment.platforms.keys.rotate') ? (
                          <button
                            className="text-link"
                            type="button"
                            onClick={() => {
                              setSelectedId(id);
                              setError('');
                              setAction('rotate');
                            }}
                            disabled={!id}
                          >
                            Rotate key
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
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
              await list.reload();
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
          description={`Set status for platform ${selectedId}.`}
          confirmLabel="Update status"
          error={error}
          onClose={() => setAction(undefined)}
          onSubmit={async (reason) => {
            try {
              const outcome = await executeCriticalOperation({
                platformKey: PLATFORM,
                operation: 'platforms-status',
                reason,
                payload: { platformId: selectedId, status: statusValue },
                requesterId: auth.session?.user.id,
              });
              if (outcome.status === 'requested') {
                setMessage(criticalRequestMessage('platforms-status'));
                setAction(undefined);
                return;
              }
              setAction(undefined);
              setMessage('Platform status update submitted.');
              await list.reload();
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
              <option value="active">active</option>
              <option value="suspended">suspended</option>
              <option value="revoked">revoked</option>
            </select>
          </label>
        </ReasonModal>
      ) : null}
      {action === 'rotate' ? (
        <ReasonModal
          title="Rotate platform API key"
          description={`Rotate the API key for ${selectedId}. The previous key is invalidated. Dual approval required.`}
          confirmLabel="Rotate key"
          error={error}
          onClose={() => setAction(undefined)}
          onSubmit={async (reason) => {
            try {
              const outcome = await executeCriticalOperation({
                platformKey: PLATFORM,
                operation: 'platforms-rotate-key',
                reason,
                payload: { platformId: selectedId },
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
              await list.reload();
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

function SettingsFormFields(props: {
  kind: 'transfer' | 'vas' | 'settlement';
  values: Record<string, string | boolean>;
  onChange: (key: string, value: string | boolean) => void;
}) {
  if (props.kind === 'transfer')
    return (
      <>
        {(
          [
            ['internal_transfer_fee', 'Internal transfer fee'],
            ['external_transfer_fee', 'External transfer fee'],
            ['stamp_duty_amount', 'Stamp duty amount'],
            ['stamp_duty_minimum_threshold', 'Stamp duty minimum'],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              aria-label={label}
              value={String(props.values[key] ?? '')}
              onChange={(event) => props.onChange(key, event.target.value)}
            />
          </label>
        ))}
        <label>
          Active
          <select
            aria-label="Transfer settings active"
            value={props.values.active ? 'true' : 'false'}
            onChange={(event) => props.onChange('active', event.target.value === 'true')}
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        </label>
      </>
    );
  if (props.kind === 'vas')
    return (
      <>
        {(
          [
            ['airtime_fee', 'Airtime fee'],
            ['data_fee', 'Data fee'],
            ['electricity_fee', 'Electricity fee'],
            ['cable_tv_fee', 'Cable TV fee'],
            ['other_fee', 'Other fee'],
          ] as const
        ).map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              aria-label={label}
              value={String(props.values[key] ?? '')}
              onChange={(event) => props.onChange(key, event.target.value)}
            />
          </label>
        ))}
        <label>
          Active
          <select
            aria-label="VAS settings active"
            value={props.values.active ? 'true' : 'false'}
            onChange={(event) => props.onChange('active', event.target.value === 'true')}
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        </label>
      </>
    );
  return (
    <>
      <label>
        Escrow hold hours
        <input
          aria-label="Escrow hold hours"
          type="number"
          min={1}
          max={168}
          value={String(props.values.escrow_hold_hours ?? '')}
          onChange={(event) => props.onChange('escrow_hold_hours', event.target.value)}
        />
      </label>
      <label>
        Checkout expiry hours
        <input
          aria-label="Checkout expiry hours"
          type="number"
          min={1}
          max={24}
          value={String(props.values.checkout_expiry_hours ?? '')}
          onChange={(event) => props.onChange('checkout_expiry_hours', event.target.value)}
        />
      </label>
      <label>
        Active
        <select
          aria-label="Settlement settings active"
          value={props.values.active ? 'true' : 'false'}
          onChange={(event) => props.onChange('active', event.target.value === 'true')}
        >
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      </label>
    </>
  );
}

function settingsFromRecord(
  kind: 'transfer' | 'vas' | 'settlement',
  data: JsonRecord | undefined,
): Record<string, string | boolean> {
  if (kind === 'transfer')
    return {
      internal_transfer_fee: String(data?.internal_transfer_fee ?? '0.00'),
      external_transfer_fee: String(data?.external_transfer_fee ?? '0.00'),
      stamp_duty_amount: String(data?.stamp_duty_amount ?? '0.00'),
      stamp_duty_minimum_threshold: String(data?.stamp_duty_minimum_threshold ?? '0.00'),
      active: data?.active !== false,
    };
  if (kind === 'vas')
    return {
      airtime_fee: String(data?.airtime_fee ?? '0.00'),
      data_fee: String(data?.data_fee ?? '0.00'),
      electricity_fee: String(data?.electricity_fee ?? '0.00'),
      cable_tv_fee: String(data?.cable_tv_fee ?? '0.00'),
      other_fee: String(data?.other_fee ?? '0.00'),
      active: data?.active !== false,
    };
  return {
    escrow_hold_hours: String(data?.escrow_hold_hours ?? 24),
    checkout_expiry_hours: String(data?.checkout_expiry_hours ?? 1),
    active: data?.active !== false,
  };
}

export function PaymentSettingsPage() {
  const auth = useAuth();
  const [searchParams] = useSearchParams();
  const platforms = useAsync(() => api.operation<unknown>(PLATFORM, 'platforms-list'), []);
  const [platformId, setPlatformId] = useState(searchParams.get('platformId') ?? '');
  const [loadedId, setLoadedId] = useState(searchParams.get('platformId') ?? '');
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
  const [draft, setDraft] = useState<Record<string, string | boolean>>({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [stepUp, setStepUp] = useState(false);
  const platformOptions = asRecords(platforms.data);

  useEffect(() => {
    if (!patch) return;
    const source =
      patch === 'transfer' ? transfer.data : patch === 'vas' ? vas.data : settlement.data;
    setDraft(settingsFromRecord(patch, source));
  }, [patch, transfer.data, vas.data, settlement.data]);

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
          Platform
          <select
            aria-label="Settings platform"
            value={platformId}
            onChange={(event) => setPlatformId(event.target.value)}
          >
            <option value="">Select platform</option>
            {platformOptions.map((row) => {
              const id = pickString(row, 'platform_id', 'platformId', 'id') ?? '';
              const name = pickString(row, 'name') ?? id;
              return (
                <option key={id} value={id}>
                  {name}
                </option>
              );
            })}
          </select>
        </label>
        <label>
          Or platform ID
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
          description="Choose a platform from the directory or paste an ID, then load settings."
        />
      ) : transfer.loading || vas.loading || settlement.loading ? (
        <LoadingState />
      ) : transfer.error || vas.error || settlement.error ? (
        <ErrorState
          error={transfer.error || vas.error || settlement.error || new Error('Load failed')}
          retry={() => {
            void transfer.reload();
            void vas.reload();
            void settlement.reload();
          }}
        />
      ) : (
        <>
          <h2 className="section-title">Transfer</h2>
          <DetailPanel
            entries={[
              {
                label: 'Internal fee',
                value: scalar(transfer.data?.internal_transfer_fee),
              },
              {
                label: 'External fee',
                value: scalar(transfer.data?.external_transfer_fee),
              },
              { label: 'Stamp duty', value: scalar(transfer.data?.stamp_duty_amount) },
              {
                label: 'Stamp duty minimum',
                value: scalar(transfer.data?.stamp_duty_minimum_threshold),
              },
              {
                label: 'Active',
                value: <StatusBadge value={String(transfer.data?.active ?? false)} />,
              },
            ]}
          />
          {auth.can('payment.settings.transfer') ? (
            <button className="button secondary" onClick={() => setPatch('transfer')}>
              Edit transfer settings
            </button>
          ) : null}
          <h2 className="section-title">VAS</h2>
          <DetailPanel
            entries={[
              { label: 'Airtime fee', value: scalar(vas.data?.airtime_fee) },
              { label: 'Data fee', value: scalar(vas.data?.data_fee) },
              { label: 'Electricity fee', value: scalar(vas.data?.electricity_fee) },
              { label: 'Cable TV fee', value: scalar(vas.data?.cable_tv_fee) },
              { label: 'Other fee', value: scalar(vas.data?.other_fee) },
              {
                label: 'Active',
                value: <StatusBadge value={String(vas.data?.active ?? false)} />,
              },
            ]}
          />
          {auth.can('payment.settings.vas') ? (
            <button className="button secondary" onClick={() => setPatch('vas')}>
              Edit VAS settings
            </button>
          ) : null}
          <h2 className="section-title">Settlement</h2>
          <DetailPanel
            entries={[
              {
                label: 'Escrow hold hours',
                value: scalar(settlement.data?.escrow_hold_hours),
              },
              {
                label: 'Checkout expiry hours',
                value: scalar(settlement.data?.checkout_expiry_hours),
              },
              {
                label: 'Active',
                value: <StatusBadge value={String(settlement.data?.active ?? false)} />,
              },
            ]}
          />
          {auth.can('payment.settings.settlement') ? (
            <button className="button secondary" onClick={() => setPatch('settlement')}>
              Edit settlement settings
            </button>
          ) : null}
        </>
      )}
      {error ? <p className="form-error">{error}</p> : null}
      {patch ? (
        <ReasonModal
          title={`Update ${patch} settings`}
          description="Attributed settings mutations require a business reason."
          confirmLabel="Submit update"
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
              const payload: JsonRecord = { platformId: loadedId, ...draft };
              if (patch === 'settlement') {
                payload.escrow_hold_hours = Number(draft.escrow_hold_hours);
                payload.checkout_expiry_hours = Number(draft.checkout_expiry_hours);
              }
              await api.mutate(PLATFORM, operation, reason, payload);
              setPatch(undefined);
              setMessage(`${patch} settings update submitted.`);
              void transfer.reload();
              void vas.reload();
              void settlement.reload();
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Update failed');
            }
          }}
        >
          <SettingsFormFields
            kind={patch}
            values={draft}
            onChange={(key, value) => setDraft((current) => ({ ...current, [key]: value }))}
          />
        </ReasonModal>
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
              row[props.idKey] ??
                row.user_id ??
                row.checkout_id ??
                row.id ??
                row.userId ??
                row.checkoutId ??
                index,
            );
            return (
              <tr key={id}>
                <td>
                  <code>{id}</code>
                </td>
                <td>
                  <StatusBadge value={String(row.status ?? row.state ?? 'UNKNOWN')} />
                </td>
                <td>
                  {scalar(row.providerStatus ?? row.last_error ?? row.note ?? row.type ?? '—')}
                </td>
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
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [bankName, setBankName] = useState('');
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
              const payload: JsonRecord = {
                userId: userId.trim(),
                action,
              };
              if (action === 'activate') {
                payload.account_number = accountNumber.trim();
                payload.account_name = accountName.trim();
                payload.bank_name = bankName.trim();
              }
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
          {action === 'activate' ? (
            <>
              <label>
                Account number
                <input
                  aria-label="SVA account number"
                  value={accountNumber}
                  onChange={(event) => setAccountNumber(event.target.value)}
                />
              </label>
              <label>
                Account name
                <input
                  aria-label="SVA account name"
                  value={accountName}
                  onChange={(event) => setAccountName(event.target.value)}
                />
              </label>
              <label>
                Bank name
                <input
                  aria-label="SVA bank name"
                  value={bankName}
                  onChange={(event) => setBankName(event.target.value)}
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
          {auth.can('payment.kyc.encryption.rotate') ? (
            <button
              className="button danger"
              onClick={() => {
                setError('');
                setOpen(true);
              }}
            >
              Rotate encryption
            </button>
          ) : null}
        </div>
      }
    >
      {message ? <p className="banner success">{message}</p> : null}
      {result ? (
        <DetailPanel
          title="Last rotation"
          entries={[
            {
              label: 'Active key',
              value: scalar(result.active_key_id ?? result.activeKeyId),
            },
            {
              label: 'Profiles rotated',
              value: scalar(result.profiles_rotated ?? result.profilesRotated),
            },
          ]}
        />
      ) : (
        <EmptyState
          title="High-risk control"
          description="Re-encrypts NIN/BVN under the active KYC encryption key. Verify MFA before rotating."
        />
      )}
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
