import { useState } from 'react';
import { useAuth } from '../app/AuthContext.js';
import {
  ChipList,
  DetailPanel,
  ReasonModal,
  asFailureGroups,
  asRecords,
  formatMaybeDate,
  pickString,
  scalar,
  type JsonRecord,
} from '../components/OpsUi.js';
import { Page } from '../components/Page.js';
import { StepUpDialog } from '../components/StepUpDialog.js';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '../components/States.js';
import { api } from '../core/api.js';
import { criticalRequestMessage, executeCriticalOperation } from '../core/criticalOperation.js';
import { formatDate } from '../core/format.js';
import { useAsync } from '../core/useAsync.js';

const PLATFORM = 'pepsa-order';

const MOBILITY_TYPES = [
  'MOTORCYCLE',
  'MOTORCYCLE_CART',
  'TRICYCLE',
  'CAR',
  'VAN',
  'TRUCK',
  'LONG_TRUCK',
] as const;

function PolicyView(props: { policy: JsonRecord | undefined }) {
  const policy = props.policy;
  if (!policy) return null;
  const capacities = Array.isArray(policy.capacities) ? (policy.capacities as JsonRecord[]) : [];
  return (
    <>
      <DetailPanel
        entries={[
          { label: 'Version', value: scalar(policy.version) },
          {
            label: 'Active',
            value: <StatusBadge value={String(policy.active ?? false)} />,
          },
          { label: 'Fleet freshness (s)', value: scalar(policy.fleetFreshnessSeconds) },
          {
            label: 'Grouping proximity (m)',
            value: scalar(policy.groupingProximityMeters),
          },
          { label: 'Pickup service (s)', value: scalar(policy.pickupServiceSeconds) },
          { label: 'Delivery service (s)', value: scalar(policy.deliveryServiceSeconds) },
          { label: 'Degraded speed (kph)', value: scalar(policy.degradedSpeedKph) },
          { label: 'Created', value: formatMaybeDate(policy.createdAt) },
          { label: 'Actor', value: scalar(policy.actorId) },
        ]}
      />
      {capacities.length ? (
        <div className="table-panel">
          <table aria-label="Policy capacities">
            <thead>
              <tr>
                <th>Mobility</th>
                <th>Minimum</th>
                <th>Maximum</th>
              </tr>
            </thead>
            <tbody>
              {capacities.map((row, index) => (
                <tr key={String(row.mobilityType ?? index)}>
                  <td>{scalar(row.mobilityType)}</td>
                  <td>{scalar(row.minimum)}</td>
                  <td>{row.maximum == null ? '∞' : scalar(row.maximum)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}

function EventTable(props: { rows: JsonRecord[]; label: string }) {
  if (!props.rows.length)
    return <EmptyState title={`No ${props.label}`} description="Nothing to show yet." />;
  return (
    <div className="table-panel">
      <table aria-label={props.label}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Type / action</th>
            <th>Status</th>
            <th>When</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((row, index) => (
            <tr key={String(row.id ?? row.eventId ?? index)}>
              <td>
                <code>{scalar(row.id ?? row.eventId ?? row.deliveryId)}</code>
              </td>
              <td>{scalar(row.type ?? row.action ?? row.eventType ?? row.name)}</td>
              <td>
                <StatusBadge value={String(row.status ?? row.state ?? '—')} />
              </td>
              <td>{formatMaybeDate(row.createdAt ?? row.occurredAt ?? row.timestamp)}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
      description="Fleet, processing pool, and dispatch posture through the pepsa-order admin contract."
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
            <strong>{scalar(health.data?.status ?? health.data?.state ?? 'ok')}</strong>
            <small>healthy</small>
          </article>
          <article className="metric">
            <span>Processing pool</span>
            <strong>{poolCount}</strong>
            <small>Visible rows</small>
          </article>
          <article className="metric">
            <span>Dispatch tasks</span>
            <strong>{taskCount}</strong>
            <small>Visible rows</small>
          </article>
          <article className="metric">
            <span>Metrics</span>
            <strong>{metrics.data ? 'ready' : 'empty'}</strong>
            <small>Prometheus scrape</small>
          </article>
        </div>
      )}
    </Page>
  );
}

export function OrderPartnersPage() {
  const auth = useAuth();
  const partners = useAsync(() => api.operation<unknown>(PLATFORM, 'partners-list'), []);
  const catalog = useAsync(() => api.operation<JsonRecord>(PLATFORM, 'catalog-read'), []);
  const [selectedId, setSelectedId] = useState('');
  const detail = useAsync(
    () =>
      selectedId
        ? api.operation<JsonRecord>(
            PLATFORM,
            'partners-get',
            `?${new URLSearchParams({ partnerId: selectedId })}`,
          )
        : Promise.resolve(undefined),
    [selectedId],
  );
  const [modal, setModal] = useState<
    | 'create'
    | 'activate'
    | 'deactivate'
    | 'user'
    | 'cost-profile'
    | 'authorize'
    | 'issue'
    | 'revoke'
  >();
  const [partnerApiId, setPartnerApiId] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [subId, setSubId] = useState('');
  const [costCode, setCostCode] = useState('');
  const [costName, setCostName] = useState('');
  const [costProfileId, setCostProfileId] = useState('');
  const [credentialId, setCredentialId] = useState('');
  const [oneTimeToken, setOneTimeToken] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [stepUp, setStepUp] = useState(false);
  const rows = asRecords(partners.data);
  const catalogCategories = asRecords(catalog.data?.categories);
  const catalogScopes = asRecords(catalog.data?.deliveryScopes);
  const catalogMobility = asRecords(catalog.data?.mobilityTypes);
  const detailUsers = asRecords(detail.data?.users);
  const detailProfiles = asRecords(detail.data?.costProfiles);
  const detailCredentials = asRecords(detail.data?.credentials);

  return (
    <Page
      eyebrow="Pepsa Order"
      title="Partners and credentials"
      description="Browse partners, manage lifecycle, and issue or revoke credentials with attributed reasons."
      action={
        <div className="inline-actions">
          {auth.can('order.credentials.issue') || auth.can('order.credentials.revoke') ? (
            <button className="button secondary" onClick={() => setStepUp(true)}>
              Verify MFA
            </button>
          ) : null}
          {auth.can('order.partners.write') ? (
            <button
              className="button primary"
              onClick={() => {
                setError('');
                setModal('create');
              }}
            >
              Create partner
            </button>
          ) : null}
        </div>
      }
    >
      {message ? <p className="banner success">{message}</p> : null}
      {oneTimeToken ? (
        <p className="banner success" role="status">
          One-time credential token (copy now): <code>{oneTimeToken}</code>
        </p>
      ) : null}

      <h2>Catalog</h2>
      {catalog.loading ? (
        <LoadingState />
      ) : catalog.error ? (
        <ErrorState error={catalog.error} retry={catalog.reload} />
      ) : (
        <>
          <ChipList
            title="Categories"
            items={catalogCategories.map((item) => ({
              code: pickString(item, 'code'),
              name: pickString(item, 'name'),
            }))}
          />
          <ChipList
            title="Delivery scopes"
            items={catalogScopes.map((item) => ({
              code: pickString(item, 'code'),
              name: pickString(item, 'name'),
            }))}
          />
          <ChipList
            title="Mobility types"
            items={catalogMobility.map((item) => ({
              code: pickString(item, 'code'),
              name: pickString(item, 'name'),
            }))}
          />
        </>
      )}

      <h2 className="section-title">Partners</h2>
      {partners.loading ? (
        <LoadingState />
      ) : partners.error ? (
        <ErrorState error={partners.error} retry={partners.reload} />
      ) : !rows.length ? (
        <EmptyState
          title="No partners"
          description="Create a partner to populate the order tenant directory."
        />
      ) : (
        <div className="table-panel">
          <table aria-label="Order partners">
            <thead>
              <tr>
                <th>API ID</th>
                <th>Name</th>
                <th>Status</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const id = pickString(row, 'partnerId', 'id') ?? '';
                return (
                  <tr key={id}>
                    <td>
                      <code>{scalar(row.apiId)}</code>
                    </td>
                    <td>{scalar(row.name)}</td>
                    <td>
                      <StatusBadge value={row.active ? 'ACTIVE' : 'INACTIVE'} />
                    </td>
                    <td>{formatMaybeDate(row.createdAt)}</td>
                    <td>
                      <div className="inline-actions">
                        <button
                          className="text-link"
                          type="button"
                          onClick={() => setSelectedId(id)}
                        >
                          Open
                        </button>
                        {auth.can('order.partners.write') ? (
                          <button
                            className="text-link"
                            type="button"
                            onClick={() => {
                              setSelectedId(id);
                              setError('');
                              setModal(row.active ? 'deactivate' : 'activate');
                            }}
                          >
                            {row.active ? 'Deactivate' : 'Activate'}
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

      {selectedId ? (
        <>
          <h2 className="section-title">Partner detail</h2>
          {detail.loading ? (
            <LoadingState />
          ) : detail.error ? (
            <ErrorState error={detail.error} retry={detail.reload} />
          ) : detail.data ? (
            <>
              <DetailPanel
                entries={[
                  { label: 'Partner ID', value: <code>{selectedId}</code> },
                  { label: 'API ID', value: scalar(detail.data.apiId) },
                  { label: 'Name', value: scalar(detail.data.name) },
                  {
                    label: 'Active',
                    value: <StatusBadge value={detail.data.active ? 'ACTIVE' : 'INACTIVE'} />,
                  },
                  { label: 'Created', value: formatMaybeDate(detail.data.createdAt) },
                ]}
              />
              <div className="inline-actions">
                {auth.can('order.partners.write') ? (
                  <>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => {
                        setError('');
                        setModal('user');
                      }}
                    >
                      Add user
                    </button>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => {
                        setError('');
                        setModal('cost-profile');
                      }}
                    >
                      Create cost profile
                    </button>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => {
                        setError('');
                        setModal('authorize');
                      }}
                    >
                      Authorize cost profile
                    </button>
                  </>
                ) : null}
                {auth.can('order.credentials.issue') ? (
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => {
                      setError('');
                      setModal('issue');
                    }}
                  >
                    Issue credential
                  </button>
                ) : null}
              </div>
              <h3>Users</h3>
              {detailUsers.length ? (
                <div className="table-panel">
                  <table aria-label="Partner users">
                    <thead>
                      <tr>
                        <th>Sub ID</th>
                        <th>Status</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailUsers.map((user) => (
                        <tr key={String(user.partnerUserId ?? user.subId)}>
                          <td>{scalar(user.subId)}</td>
                          <td>
                            <StatusBadge value={user.active ? 'ACTIVE' : 'INACTIVE'} />
                          </td>
                          <td>{formatMaybeDate(user.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title="No users" description="Register a partner sub-user mapping." />
              )}
              <h3>Cost profiles</h3>
              {detailProfiles.length ? (
                <div className="table-panel">
                  <table aria-label="Partner cost profiles">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Name</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailProfiles.map((profile) => (
                        <tr key={String(profile.costProfileId)}>
                          <td>
                            <code>{scalar(profile.code)}</code>
                          </td>
                          <td>{scalar(profile.name)}</td>
                          <td>
                            <StatusBadge value={profile.active ? 'ACTIVE' : 'INACTIVE'} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  title="No cost profiles"
                  description="Create and authorize a cost profile for this partner."
                />
              )}
              <h3>Credentials</h3>
              {detailCredentials.length ? (
                <div className="table-panel">
                  <table aria-label="Partner credentials">
                    <thead>
                      <tr>
                        <th>Selector</th>
                        <th>Scopes</th>
                        <th>Status</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {detailCredentials.map((credential) => {
                        const id = pickString(credential, 'credentialId', 'id') ?? '';
                        return (
                          <tr key={id}>
                            <td>
                              <code>{scalar(credential.selector)}</code>
                            </td>
                            <td>
                              {Array.isArray(credential.scopes)
                                ? credential.scopes.map(String).join(', ')
                                : '—'}
                            </td>
                            <td>
                              <StatusBadge
                                value={
                                  credential.revokedAt
                                    ? 'REVOKED'
                                    : credential.active
                                      ? 'ACTIVE'
                                      : 'INACTIVE'
                                }
                              />
                            </td>
                            <td>
                              {auth.can('order.credentials.revoke') && !credential.revokedAt ? (
                                <button
                                  className="text-link"
                                  type="button"
                                  onClick={() => {
                                    setCredentialId(id);
                                    setError('');
                                    setModal('revoke');
                                  }}
                                >
                                  Revoke
                                </button>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  title="No credentials"
                  description="Issue a credential to enable partner API access."
                />
              )}
            </>
          ) : null}
        </>
      ) : null}

      {modal === 'create' ? (
        <ReasonModal
          title="Create partner"
          description="Create a partner tenant identity for pepsa-order intake."
          confirmLabel="Create partner"
          error={error}
          onClose={() => setModal(undefined)}
          onSubmit={async (reason) => {
            try {
              await api.mutate(PLATFORM, 'partners-create', reason, {
                apiId: partnerApiId.trim() || partnerName.trim().toUpperCase().replace(/\s+/g, '_'),
                name: partnerName.trim() || 'New partner',
              });
              setModal(undefined);
              setPartnerApiId('');
              setPartnerName('');
              setMessage('Partner create submitted.');
              await partners.reload();
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Create failed');
            }
          }}
        >
          <label>
            API ID
            <input
              aria-label="Partner API ID"
              value={partnerApiId}
              onChange={(event) => setPartnerApiId(event.target.value)}
              placeholder="BAS"
            />
          </label>
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

      {modal === 'activate' || modal === 'deactivate' ? (
        <ReasonModal
          title={modal === 'activate' ? 'Activate partner' : 'Deactivate partner'}
          description={`${modal === 'activate' ? 'Enable' : 'Disable'} partner ${selectedId}.`}
          confirmLabel={modal === 'activate' ? 'Activate' : 'Deactivate'}
          error={error}
          onClose={() => setModal(undefined)}
          onSubmit={async (reason) => {
            try {
              await api.mutate(PLATFORM, 'partners-update', reason, {
                partnerId: selectedId,
                active: modal === 'activate',
              });
              setModal(undefined);
              setMessage('Partner update submitted.');
              await Promise.all([partners.reload(), detail.reload()]);
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Update failed');
            }
          }}
        />
      ) : null}

      {modal === 'user' ? (
        <ReasonModal
          title="Add partner user"
          description={`Register a sub-user mapping for partner ${selectedId}.`}
          confirmLabel="Add user"
          error={error}
          onClose={() => setModal(undefined)}
          onSubmit={async (reason) => {
            try {
              await api.mutate(PLATFORM, 'partners-users-create', reason, {
                partnerId: selectedId,
                subId: subId.trim(),
              });
              setModal(undefined);
              setSubId('');
              setMessage('Partner user submitted.');
              await detail.reload();
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Add user failed');
            }
          }}
        >
          <label>
            Sub ID
            <input
              aria-label="Partner sub ID"
              value={subId}
              onChange={(event) => setSubId(event.target.value)}
              placeholder="bas-business-1002"
            />
          </label>
        </ReasonModal>
      ) : null}

      {modal === 'cost-profile' ? (
        <ReasonModal
          title="Create cost profile"
          description="Create a pricing profile identity, then authorize it for a partner."
          confirmLabel="Create profile"
          error={error}
          onClose={() => setModal(undefined)}
          onSubmit={async (reason) => {
            try {
              const result = await api.mutate<JsonRecord>(
                PLATFORM,
                'cost-profiles-create',
                reason,
                {
                  code: costCode.trim() || 'PLATFORM',
                  name: costName.trim() || 'Platform pricing',
                },
              );
              const createdId = pickString(result, 'costProfileId');
              if (createdId) setCostProfileId(createdId);
              setModal(undefined);
              setMessage(
                createdId
                  ? `Cost profile created (${createdId}). Authorize it next.`
                  : 'Cost profile create submitted.',
              );
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Create failed');
            }
          }}
        >
          <label>
            Code
            <input
              aria-label="Cost profile code"
              value={costCode}
              onChange={(event) => setCostCode(event.target.value)}
              placeholder="BAS_PLATFORM"
            />
          </label>
          <label>
            Name
            <input
              aria-label="Cost profile name"
              value={costName}
              onChange={(event) => setCostName(event.target.value)}
              placeholder="BAS calculated pricing"
            />
          </label>
        </ReasonModal>
      ) : null}

      {modal === 'authorize' ? (
        <ReasonModal
          title="Authorize cost profile"
          description={`Authorize a cost profile for partner ${selectedId}.`}
          confirmLabel="Authorize"
          error={error}
          onClose={() => setModal(undefined)}
          onSubmit={async (reason) => {
            try {
              await api.mutate(PLATFORM, 'partners-cost-profile-authorize', reason, {
                partnerId: selectedId,
                costProfileId: costProfileId.trim(),
              });
              setModal(undefined);
              setMessage('Cost profile authorization submitted.');
              await detail.reload();
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Authorize failed');
            }
          }}
        >
          <label>
            Cost profile ID
            <input
              aria-label="Cost profile ID"
              value={costProfileId}
              onChange={(event) => setCostProfileId(event.target.value)}
              placeholder="Cost profile UUID"
            />
          </label>
        </ReasonModal>
      ) : null}

      {modal === 'issue' ? (
        <ReasonModal
          title="Issue partner credential"
          description={`Issue a credential for partner ${selectedId}. Plaintext is returned once.`}
          confirmLabel="Issue credential"
          error={error}
          onClose={() => setModal(undefined)}
          onSubmit={async (reason) => {
            try {
              const outcome = await executeCriticalOperation({
                platformKey: PLATFORM,
                operation: 'credentials-issue',
                reason,
                payload: {
                  partnerId: selectedId,
                  scopes: ['orders:create', 'orders:read', 'payments:initiate'],
                },
                requesterId: auth.session?.user.id,
              });
              if (outcome.status === 'requested') {
                setMessage(criticalRequestMessage('credentials-issue'));
                setModal(undefined);
                return;
              }
              const token = (outcome.result as JsonRecord)?.token;
              if (typeof token === 'string' && token) setOneTimeToken(token);
              setModal(undefined);
              setMessage('Credential issue submitted.');
              await detail.reload();
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Issue failed');
            }
          }}
        />
      ) : null}

      {modal === 'revoke' ? (
        <ReasonModal
          title="Revoke partner credential"
          description={`Immediately revoke credential ${credentialId}.`}
          confirmLabel="Revoke credential"
          error={error}
          onClose={() => setModal(undefined)}
          onSubmit={async (reason) => {
            try {
              const outcome = await executeCriticalOperation({
                platformKey: PLATFORM,
                operation: 'credentials-revoke',
                reason,
                payload: { credentialId: credentialId.trim() },
                requesterId: auth.session?.user.id,
              });
              if (outcome.status === 'requested') {
                setMessage(criticalRequestMessage('credentials-revoke'));
                setModal(undefined);
                return;
              }
              setModal(undefined);
              setMessage('Credential revoke submitted.');
              await detail.reload();
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
  const [mobility, setMobility] = useState('MOTORCYCLE');
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
            <strong>{scalar(health.data?.status ?? health.data?.state ?? 'unknown')}</strong>
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
        <EmptyState
          title="No riders"
          description="Fleet riders will appear after a successful sync."
        />
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
                    <code>{scalar(rider.id ?? rider.externalId)}</code>
                  </td>
                  <td>{scalar(rider.name ?? rider.displayName ?? rider.externalId)}</td>
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
        <DetailPanel
          title="Evaluate result"
          entries={[
            { label: 'Status', value: scalar(evaluateResult.status ?? evaluateResult.state) },
            {
              label: 'Available',
              value: scalar(evaluateResult.available ?? evaluateResult.sufficient),
            },
            {
              label: 'Required mobility',
              value: scalar(evaluateResult.requiredMobility ?? mobility),
            },
            {
              label: 'Additional load',
              value: scalar(evaluateResult.additionalLoad ?? load),
            },
            {
              label: 'Rider count',
              value: scalar(evaluateResult.riderCount ?? evaluateResult.count),
            },
            {
              label: 'Message',
              value: scalar(evaluateResult.message ?? evaluateResult.reason),
            },
          ].filter((entry) => entry.value !== '—')}
        />
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
  const [manualRiderId, setManualRiderId] = useState('');
  const [manualShipmentIds, setManualShipmentIds] = useState('');
  const [error, setError] = useState('');
  const rows = asRecords(pool.data);
  const assignmentRows = asRecords(detail?.assignments ?? detail?.batches);
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
                    <code>{scalar(row.id ?? row.runId ?? row.batchId)}</code>
                  </td>
                  <td>
                    <StatusBadge value={String(row.status ?? 'UNKNOWN')} />
                  </td>
                  <td>{scalar(row.summary ?? row.type ?? row.partnerId)}</td>
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
      {detail ? (
        <>
          <DetailPanel
            title="Run / batch detail"
            entries={Object.entries(detail)
              .filter(([key]) => key !== 'assignments' && key !== 'batches')
              .slice(0, 12)
              .map(([label, value]) => ({
                label,
                value:
                  typeof value === 'object' && value !== null
                    ? Array.isArray(value)
                      ? `${value.length} items`
                      : 'object'
                    : scalar(value),
              }))}
          />
          {assignmentRows.length ? (
            <div className="table-panel">
              <table aria-label="Assignments">
                <thead>
                  <tr>
                    <th>Rider</th>
                    <th>Shipments</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {assignmentRows.map((row, index) => (
                    <tr key={String(row.riderId ?? row.id ?? index)}>
                      <td>{scalar(row.riderId ?? row.rider)}</td>
                      <td>
                        {Array.isArray(row.shipmentIds)
                          ? row.shipmentIds.map(String).join(', ')
                          : scalar(row.shipmentId ?? row.count)}
                      </td>
                      <td>
                        <StatusBadge value={String(row.status ?? '—')} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : null}
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
              const payload =
                action === 'manual'
                  ? {
                      assignments: [
                        {
                          riderId: manualRiderId.trim(),
                          shipmentIds: manualShipmentIds
                            .split(/[\s,]+/)
                            .map((entry) => entry.trim())
                            .filter(Boolean),
                        },
                      ],
                    }
                  : {};
              await api.mutate(PLATFORM, operation, reason, payload);
              setAction(undefined);
              await pool.reload();
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Run failed');
            }
          }}
        >
          {action === 'manual' ? (
            <>
              <label>
                Rider ID
                <input
                  aria-label="Manual rider ID"
                  value={manualRiderId}
                  onChange={(event) => setManualRiderId(event.target.value)}
                />
              </label>
              <label>
                Shipment IDs
                <textarea
                  aria-label="Manual shipment IDs"
                  rows={3}
                  value={manualShipmentIds}
                  onChange={(event) => setManualShipmentIds(event.target.value)}
                  placeholder="Comma or whitespace separated UUIDs"
                />
              </label>
            </>
          ) : null}
        </ReasonModal>
      ) : null}
    </Page>
  );
}

export function OrderDispatchPage() {
  const auth = useAuth();
  const tasks = useAsync(() => api.operation<unknown>(PLATFORM, 'dispatch-tasks'), []);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [riderId, setRiderId] = useState('');
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
        <EmptyState
          title="No dispatch tasks"
          description="Tasks will appear as orders enter dispatch."
        />
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
                    <td>{scalar(task.shipmentId ?? task.orderId)}</td>
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
      {detail ? (
        <DetailPanel
          title={`Task ${selectedTaskId || ''}`}
          entries={[
            { label: 'Status', value: <StatusBadge value={String(detail.status ?? '—')} /> },
            { label: 'Shipment', value: scalar(detail.shipmentId ?? detail.orderId) },
            { label: 'Rider', value: scalar(detail.riderId ?? detail.assignedRiderId) },
            { label: 'Partner', value: scalar(detail.partnerId) },
            { label: 'Updated', value: formatMaybeDate(detail.updatedAt ?? detail.createdAt) },
          ]}
        />
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
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
                riderId: riderId.trim(),
              });
              setOfferOpen(false);
              setRiderId('');
              await tasks.reload();
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Offer failed');
            }
          }}
        >
          <label>
            Rider ID
            <input
              aria-label="Offer rider ID"
              value={riderId}
              onChange={(event) => setRiderId(event.target.value)}
              placeholder="Rider UUID"
            />
          </label>
        </ReasonModal>
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
              const outcome = await executeCriticalOperation({
                platformKey: PLATFORM,
                operation: 'dispatch-refund-retry',
                reason,
                payload: { refundId: refundId.trim() },
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
  const [fleetFreshnessSeconds, setFleetFreshnessSeconds] = useState('300');
  const [groupingProximityMeters, setGroupingProximityMeters] = useState('40000');
  const [pickupServiceSeconds, setPickupServiceSeconds] = useState('300');
  const [deliveryServiceSeconds, setDeliveryServiceSeconds] = useState('300');
  const [degradedSpeedKph, setDegradedSpeedKph] = useState('30');
  const [capacities, setCapacities] = useState(
    () =>
      MOBILITY_TYPES.map((mobilityType) => ({
        mobilityType,
        minimum: '10',
        maximum: mobilityType.includes('TRUCK') ? '' : '20',
      })) as Array<{ mobilityType: string; minimum: string; maximum: string }>,
  );
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
        <PolicyView policy={active.data} />
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
      {historical ? <PolicyView policy={historical} /> : null}
      {publishOpen ? (
        <ReasonModal
          title="Publish operations policy"
          description="Publishing activates a new immutable policy version. Dual approval is required."
          confirmLabel="Publish"
          error={error}
          onClose={() => setPublishOpen(false)}
          onSubmit={async (reason) => {
            try {
              const payload = {
                fleetFreshnessSeconds: Number(fleetFreshnessSeconds),
                groupingProximityMeters: Number(groupingProximityMeters),
                pickupServiceSeconds: Number(pickupServiceSeconds),
                deliveryServiceSeconds: Number(deliveryServiceSeconds),
                degradedSpeedKph: Number(degradedSpeedKph),
                capacities: capacities.map((row) => ({
                  mobilityType: row.mobilityType,
                  minimum: Number(row.minimum),
                  maximum: row.maximum.trim() ? Number(row.maximum) : null,
                })),
              };
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
        >
          <label>
            Fleet freshness seconds
            <input
              aria-label="Fleet freshness seconds"
              value={fleetFreshnessSeconds}
              onChange={(event) => setFleetFreshnessSeconds(event.target.value)}
            />
          </label>
          <label>
            Grouping proximity meters
            <input
              aria-label="Grouping proximity meters"
              value={groupingProximityMeters}
              onChange={(event) => setGroupingProximityMeters(event.target.value)}
            />
          </label>
          <label>
            Pickup service seconds
            <input
              aria-label="Pickup service seconds"
              value={pickupServiceSeconds}
              onChange={(event) => setPickupServiceSeconds(event.target.value)}
            />
          </label>
          <label>
            Delivery service seconds
            <input
              aria-label="Delivery service seconds"
              value={deliveryServiceSeconds}
              onChange={(event) => setDeliveryServiceSeconds(event.target.value)}
            />
          </label>
          <label>
            Degraded speed kph
            <input
              aria-label="Degraded speed kph"
              value={degradedSpeedKph}
              onChange={(event) => setDegradedSpeedKph(event.target.value)}
            />
          </label>
          {capacities.map((row, index) => (
            <div key={row.mobilityType} className="filter-bar">
              <strong>{row.mobilityType}</strong>
              <label>
                Min
                <input
                  aria-label={`${row.mobilityType} minimum`}
                  value={row.minimum}
                  onChange={(event) =>
                    setCapacities((current) =>
                      current.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, minimum: event.target.value } : entry,
                      ),
                    )
                  }
                />
              </label>
              <label>
                Max (blank = unlimited)
                <input
                  aria-label={`${row.mobilityType} maximum`}
                  value={row.maximum}
                  onChange={(event) =>
                    setCapacities((current) =>
                      current.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, maximum: event.target.value } : entry,
                      ),
                    )
                  }
                />
              </label>
            </div>
          ))}
        </ReasonModal>
      ) : null}
      {stepUp ? <StepUpDialog close={() => setStepUp(false)} /> : null}
    </Page>
  );
}

export function OrderEventsPage() {
  const auth = useAuth();
  const partners = useAsync(() => api.operation<unknown>(PLATFORM, 'partners-list'), []);
  const [partnerId, setPartnerId] = useState('');
  const query = partnerId.trim() ? `?${new URLSearchParams({ partnerId: partnerId.trim() })}` : '';
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
  const [replayOpen, setReplayOpen] = useState<'webhook' | 'notification'>();
  const [replayId, setReplayId] = useState('');
  const [callbackOpen, setCallbackOpen] = useState(false);
  const [endpointUrl, setEndpointUrl] = useState('');
  const [eventTypes, setEventTypes] = useState('ORDER_UPDATED');
  const [error, setError] = useState('');
  const partnerOptions = asRecords(partners.data);
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
          Partner
          <select
            aria-label="Partner ID for events"
            value={partnerId}
            onChange={(event) => setPartnerId(event.target.value)}
          >
            <option value="">Select partner</option>
            {partnerOptions.map((row) => {
              const id = pickString(row, 'partnerId', 'id') ?? '';
              return (
                <option key={id} value={id}>
                  {pickString(row, 'name') ?? id} ({pickString(row, 'apiId') ?? id})
                </option>
              );
            })}
          </select>
        </label>
      </div>
      <h2>Provider failures</h2>
      {failures.loading ? (
        <LoadingState />
      ) : failures.error ? (
        <ErrorState error={failures.error} retry={failures.reload} />
      ) : (
        (() => {
          const groups = asFailureGroups(failures.data);
          if (!groups.length) {
            return (
              <EmptyState
                title="No provider failures"
                description="Outbox, webhook, and notification failure queues are empty."
              />
            );
          }
          return (
            <>
              {groups.map((group) => (
                <div key={group.label}>
                  <h3 className="section-title">{group.label}</h3>
                  <EventTable rows={group.rows} label={group.label} />
                </div>
              ))}
            </>
          );
        })()
      )}
      <h2 className="section-title">Events</h2>
      {!partnerId.trim() ? (
        <EmptyState title="Partner required" description="Select a partner to list events." />
      ) : events.loading ? (
        <LoadingState />
      ) : events.error ? (
        <ErrorState error={events.error} retry={events.reload} />
      ) : (
        <EventTable rows={asRecords(events.data)} label="Events" />
      )}
      <h2 className="section-title">Audits</h2>
      {!partnerId.trim() ? (
        <EmptyState title="Partner required" description="Select a partner to list audits." />
      ) : audits.loading ? (
        <LoadingState />
      ) : audits.error ? (
        <ErrorState error={audits.error} retry={audits.reload} />
      ) : (
        <EventTable rows={asRecords(audits.data)} label="Audits" />
      )}
      {auth.can('order.events.operate') ? (
        <div className="filter-bar">
          <button className="button secondary" onClick={() => setReplayOpen('webhook')}>
            Replay webhook
          </button>
          <button className="button secondary" onClick={() => setReplayOpen('notification')}>
            Replay notification
          </button>
        </div>
      ) : null}
      {replayOpen ? (
        <ReasonModal
          title={`Replay ${replayOpen}`}
          description={`Replay a ${replayOpen} delivery by ID.`}
          confirmLabel="Replay"
          error={error}
          onClose={() => setReplayOpen(undefined)}
          onSubmit={async (reason) => {
            try {
              await api.mutate(
                PLATFORM,
                replayOpen === 'webhook' ? 'webhook-replay' : 'notification-replay',
                reason,
                { id: replayId.trim() },
              );
              setReplayOpen(undefined);
              setReplayId('');
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Replay failed');
            }
          }}
        >
          <label>
            Delivery ID
            <input
              aria-label="Delivery ID"
              value={replayId}
              onChange={(event) => setReplayId(event.target.value)}
            />
          </label>
        </ReasonModal>
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
              await api.mutate(PLATFORM, 'bas-callbacks-provision', reason, {
                partnerId: partnerId.trim(),
                endpointUrl: endpointUrl.trim(),
                eventTypes: eventTypes
                  .split(/[\s,]+/)
                  .map((entry) => entry.trim())
                  .filter(Boolean),
              });
              setCallbackOpen(false);
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'Provision failed');
            }
          }}
        >
          <label>
            Partner ID
            <input
              aria-label="BAS callback partner ID"
              value={partnerId}
              onChange={(event) => setPartnerId(event.target.value)}
            />
          </label>
          <label>
            Endpoint URL
            <input
              aria-label="BAS callback endpoint"
              value={endpointUrl}
              onChange={(event) => setEndpointUrl(event.target.value)}
              placeholder="https://..."
            />
          </label>
          <label>
            Event types
            <input
              aria-label="BAS callback event types"
              value={eventTypes}
              onChange={(event) => setEventTypes(event.target.value)}
            />
          </label>
        </ReasonModal>
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
  const [platformKey, setPlatformKey] = useState('business-as-a-service');
  const [environment, setEnvironment] = useState('production');
  const [paymentAuthority, setPaymentAuthority] = useState('platform-owned');
  const [status, setStatus] = useState('DISABLED');
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
                    <td>{scalar(item.name ?? item.key ?? item.platformKey ?? item.type)}</td>
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
              const payload =
                action.operation === 'integrations-upsert'
                  ? {
                      platformKey,
                      environment,
                      paymentAuthority,
                      status,
                    }
                  : action.id
                    ? { id: action.id }
                    : {};
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
        >
          {action.operation === 'integrations-upsert' ? (
            <>
              <label>
                Platform key
                <input
                  aria-label="Integration platform key"
                  value={platformKey}
                  onChange={(event) => setPlatformKey(event.target.value)}
                />
              </label>
              <label>
                Environment
                <input
                  aria-label="Integration environment"
                  value={environment}
                  onChange={(event) => setEnvironment(event.target.value)}
                />
              </label>
              <label>
                Payment authority
                <input
                  aria-label="Payment authority"
                  value={paymentAuthority}
                  onChange={(event) => setPaymentAuthority(event.target.value)}
                />
              </label>
              <label>
                Status
                <input
                  aria-label="Integration status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
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
