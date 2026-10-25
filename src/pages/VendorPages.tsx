import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Page } from '../components/Page.js';
import { ReasonModal } from '../components/OpsUi.js';
import { StepUpDialog } from '../components/StepUpDialog.js';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '../components/States.js';
import { api } from '../core/api.js';
import { criticalRequestMessage, executeCriticalOperation } from '../core/criticalOperation.js';
import { formatDate, formatMoney, titleCase } from '../core/format.js';
import { useAsync } from '../core/useAsync.js';

const PLATFORM = 'vendor';

type Count = { status: string; count: number };
type Overview = {
  asOf: string;
  currency: string;
  vendors: Count[];
  orders: Array<Count & { source: string; amountMinor: number }>;
  dispatches: Array<Count & { mode: string; feeAmountMinor: number }>;
  manifests: Count[];
  finance: {
    projectedTotalMinor: number;
    projectedEarningsMinor: number;
    outstandingFeeMinor: number;
    classification: string;
  };
};
type VendorRow = {
  id: string;
  businessName: string;
  email: string;
  phone: string;
  type: string;
  status: string;
  paymentProvisioning: string;
  createdAt: string;
  _count: { orders: number; dispatches: number; outboundManifests: number; dispatchers: number };
};
type VendorList = { items: VendorRow[]; asOf: string; nextCursor: string | null };
type ProvisioningRow = {
  id: string;
  tenantId: string;
  status: string;
  attempts: number;
  lastErrorCode?: string;
  lastRequestId?: string;
  updatedAt: string;
  vendor: { businessName: string; email: string };
};
type FeePolicy = {
  id: string;
  feeCode: string;
  scope: string;
  version: number;
  calculationType: string;
  currency: string;
  flatAmountMinor?: number;
  percentageBps?: number;
  deferralAllowed: boolean;
  status: string;
  effectiveFrom?: string;
  vendor?: { businessName: string };
};
type FeeSimulation = {
  policyId: string;
  version: number;
  calculationType: string;
  baseAmountMinor: number;
  amountMinor: number;
  currency: string;
  contentHash: string;
};
type VendorDetail = VendorRow & {
  updatedAt: string;
  applications: Array<{
    id: string;
    version: number;
    status: string;
    submittedAt?: string;
    decidedAt?: string;
  }>;
  provisioningSagas: Array<{
    id: string;
    status: string;
    attempts: number;
    lastErrorCode?: string;
    updatedAt: string;
  }>;
  finance: {
    classification: string;
    projectionCount: number;
    totalAmountMinor: number;
    earningsMinor: number;
    outstandingFeeMinor: number;
  };
  performance: {
    orders: Array<{
      source: string;
      status: string;
      _count: { _all: number };
      _sum: { amountMinor?: number };
    }>;
    dispatches: Array<{ mode: string; status: string; _count: { _all: number } }>;
  };
  _count: VendorRow['_count'] & { inboundManifests: number; customers: number; users: number };
};
type WorkbenchBase = {
  source: 'vendor';
  asOf: string;
  timezone: string;
  currency: string;
  freshness: string;
  dataQuality: string;
  classification: string;
};
type OperationRow = {
  id: string;
  publicReference: string;
  status: string;
  createdAt: string;
  vendor: { businessName: string };
  source?: string;
  mode?: string;
  paymentStatus?: string;
  amountMinor?: number;
  currency?: string;
};
type FinanceRow = {
  id: string;
  source?: string;
  sourceReference?: string;
  totalAmountMinor?: number;
  earningsMinor?: number;
  amountMinor?: number;
  collectedMinor?: number;
  currency: string;
  status: string;
  paymentReference?: string;
  createdAt: string;
  vendor: { businessName: string };
};
type ExceptionRow = {
  id: string;
  status?: string;
  attempts?: number;
  lastErrorCode?: string;
  lastRequestId?: string;
  amountMinor?: number;
  collectedMinor?: number;
  currency?: string;
  createdAt?: string;
  updatedAt?: string;
  vendor: { businessName: string };
};
type ReconciliationCaseRow = {
  id: string;
  category: string;
  severity: string;
  status: string;
  summary: string;
  sourceSystem: string;
  sourceReference: string;
  createdAt: string;
  updatedAt: string;
  vendor: { businessName: string };
};
type AuditRow = {
  id: string;
  actorId: string;
  action: string;
  subjectId?: string;
  requestId?: string;
  outcome: string;
  createdAt: string;
};
type ReviewRow = {
  id: string;
  version: number;
  status: string;
  submittedAt?: string;
  vendor: { businessName: string; type?: string };
};
type DispatcherReviewRow = {
  id: string;
  version: number;
  status: string;
  firstName: string;
  lastName: string;
  engagementType: string;
  vehicleType: string;
  submittedAt?: string;
  dispatcher: { vendor: { businessName: string } };
};
type ReviewDocument = {
  id: string;
  documentType: string;
  originalName: string;
  status: string;
};
type VendorApplicationDetail = {
  id: string;
  version: number;
  status: string;
  submittedAt?: string;
  vendor: { businessName: string; type: string; email: string; phone: string };
  personalData: Record<
    | 'firstName'
    | 'lastName'
    | 'gender'
    | 'dateOfBirth'
    | 'phone'
    | 'homeAddress'
    | 'state'
    | 'city',
    string | undefined
  >;
  businessData: Record<
    | 'legalName'
    | 'registrationType'
    | 'registrationDate'
    | 'registrationNumber'
    | 'taxNumber'
    | 'registeredAddress'
    | 'businessAddress'
    | 'state'
    | 'city',
    string | undefined
  >;
  directors: Array<{
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    role: string;
    ownershipShare: string;
  }>;
  documents: ReviewDocument[];
};
type DispatcherReviewDetail = {
  id: string;
  status: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  identityType: string;
  homeAddress: string;
  state: string;
  city: string;
  engagementType: string;
  vehicleType: string;
  vehicleBrand?: string;
  plateNumber?: string;
  guarantorName: string;
  guarantorPhone: string;
  revenueSharePct: string;
  documents?: ReviewDocument[];
  dispatcher: { tenantId: string };
};
type Workbench = WorkbenchBase & {
  orders?: OperationRow[];
  dispatches?: OperationRow[];
  settlements?: FinanceRow[];
  receivables?: FinanceRow[];
  provisioning?: ExceptionRow[];
  reconciliationCases?: ReconciliationCaseRow[];
  events?: AuditRow[];
  applications?: ReviewRow[];
  revisions?: DispatcherReviewRow[];
};
type Performance = WorkbenchBase & {
  watermark: string | null;
  gmvDefinition: string;
  series: Array<{
    date: string;
    orderCount: number;
    pricedOrderCount: number;
    unpricedOrderCount: number;
    gmvMinor: number;
    dispatchCount: number;
    completedDispatchCount: number;
    projectedSettlementMinor: number;
  }>;
  vendors: Array<{
    vendorId: string;
    businessName: string;
    orderCount: number;
    unpricedOrderCount: number;
    dispatchCount: number;
    completedDispatchCount: number;
    projectedEarningsMinor: number;
  }>;
};
type OperationalHealth = WorkbenchBase & {
  alerts: Array<{
    code: string;
    status: string;
    value: number;
    threshold: number;
    runbook: string;
  }>;
};
type CorrelationResults = WorkbenchBase & {
  query: string;
  results: Record<
    string,
    Array<{ id: string; status?: string; action?: string; requestId?: string }>
  >;
};

const money = (minor: number, currency = 'NGN') => formatMoney(minor / 100, currency);
const total = (rows: Count[]) => rows.reduce((sum, row) => sum + row.count, 0);
const csvCell = (value: string | number) => {
  const raw = String(value);
  const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
};
function exportCsv(filename: string, headings: string[], rows: Array<Array<string | number>>) {
  const content = [headings, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function VendorOverviewPage() {
  const data = useAsync(() => api.operation<Overview>(PLATFORM, 'overview-read'), []);
  if (data.loading)
    return (
      <Page
        eyebrow="Vendor"
        title="Platform overview"
        description="Vendor operations and financial posture."
      >
        <LoadingState />
      </Page>
    );
  if (data.error)
    return (
      <Page
        eyebrow="Vendor"
        title="Platform overview"
        description="Vendor operations and financial posture."
      >
        <ErrorState error={data.error} retry={data.reload} />
      </Page>
    );
  const value = data.data!;
  return (
    <Page
      eyebrow="Vendor"
      title="Platform overview"
      description={`Current as of ${formatDate(value.asOf)}. Financial values are explicitly classified.`}
    >
      <div className="metric-grid">
        <Metric label="Vendors" value={String(total(value.vendors))} note="All lifecycle states" />
        <Metric
          label="Orders"
          value={String(total(value.orders))}
          note="Vendor and customer link"
        />
        <Metric
          label="Dispatches"
          value={String(total(value.dispatches))}
          note="Own fleet and General Pool"
        />
        <Metric
          label="Projected earnings"
          value={money(value.finance.projectedEarningsMinor, value.currency)}
          note={value.finance.classification}
        />
        <Metric
          label="Outstanding fees"
          value={money(value.finance.outstandingFeeMinor, value.currency)}
          note="Vendor receivables"
        />
      </div>
      <div className="content-grid two-column">
        <StatusTable title="Vendor lifecycle" rows={value.vendors} />
        <StatusTable title="Manifest lifecycle" rows={value.manifests} />
      </div>
    </Page>
  );
}

export function VendorPerformancePage() {
  const [days, setDays] = useState('30');
  const [query, setQuery] = useState('');
  const [trace, setTrace] = useState<CorrelationResults>();
  const [traceError, setTraceError] = useState('');
  const performance = useAsync(
    () => api.operation<Performance>(PLATFORM, 'performance-read', `?days=${days}`),
    [days],
  );
  const health = useAsync(
    () => api.operation<OperationalHealth>(PLATFORM, 'operational-health-read'),
    [],
  );
  return (
    <Page
      eyebrow="Vendor"
      title="Performance and operational health"
      description="Live source KPIs with explicit watermark, projection classification and actionable alert runbooks."
      action={
        <select
          aria-label="Performance window"
          value={days}
          onChange={(event) => setDays(event.target.value)}
        >
          <option value="7">7 days</option>
          <option value="30">30 days</option>
          <option value="90">90 days</option>
        </select>
      }
    >
      {performance.loading || health.loading ? (
        <LoadingState />
      ) : performance.error || health.error ? (
        <ErrorState
          error={performance.error ?? health.error ?? new Error('Data unavailable')}
          retry={() => {
            performance.reload();
            health.reload();
          }}
        />
      ) : performance.data && health.data ? (
        <>
          <p className="muted">
            Watermark{' '}
            {performance.data.watermark ? formatDate(performance.data.watermark) : 'No activity'} ·{' '}
            {performance.data.freshness} · {performance.data.classification}
          </p>
          <p>{performance.data.gmvDefinition}</p>
          <div className="metric-grid">
            <Metric
              label="Orders"
              value={String(performance.data.series.reduce((sum, row) => sum + row.orderCount, 0))}
              note={`${performance.data.series.reduce((sum, row) => sum + row.unpricedOrderCount, 0)} unpriced`}
            />
            <Metric
              label="GMV"
              value={money(performance.data.series.reduce((sum, row) => sum + row.gmvMinor, 0))}
              note="Vendor projection"
            />
            <Metric
              label="Dispatches"
              value={String(
                performance.data.series.reduce((sum, row) => sum + row.dispatchCount, 0),
              )}
              note={`${performance.data.series.reduce((sum, row) => sum + row.completedDispatchCount, 0)} completed`}
            />
            <Metric
              label="Active alerts"
              value={String(
                health.data.alerts.filter((alert) => alert.status === 'ALERTING').length,
              )}
              note="Runbook linked"
            />
          </div>
          <div className="content-grid two-column">
            <section className="table-panel">
              <header>
                <h3>Daily KPI series</h3>
              </header>
              <table aria-label="Daily vendor KPIs">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Orders</th>
                    <th>Unpriced</th>
                    <th>GMV</th>
                    <th>Completed dispatches</th>
                  </tr>
                </thead>
                <tbody>
                  {performance.data.series.map((row) => (
                    <tr key={row.date}>
                      <td>{row.date}</td>
                      <td>{row.orderCount}</td>
                      <td>{row.unpricedOrderCount}</td>
                      <td>{money(row.gmvMinor)}</td>
                      <td>{row.completedDispatchCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section className="table-panel">
              <header>
                <h3>Operational alerts</h3>
              </header>
              <table aria-label="Vendor operational alerts">
                <thead>
                  <tr>
                    <th>Control</th>
                    <th>Status</th>
                    <th>Value</th>
                    <th>Runbook</th>
                  </tr>
                </thead>
                <tbody>
                  {health.data.alerts.map((alert) => (
                    <tr key={alert.code}>
                      <td>{titleCase(alert.code)}</td>
                      <td>
                        <StatusBadge value={alert.status} />
                      </td>
                      <td>{alert.value}</td>
                      <td>
                        <code>{alert.runbook}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
          <section className="review-section">
            <h3>Cross-platform correlation search</h3>
            <div className="inline-actions">
              <label>
                Correlation identifier
                <input
                  value={query}
                  maxLength={120}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Order, dispatch, Payment or request ID"
                />
              </label>
              <button
                className="button secondary"
                disabled={query.trim().length < 3}
                onClick={() => {
                  setTraceError('');
                  void api
                    .operation<CorrelationResults>(
                      PLATFORM,
                      'correlation-search',
                      `?q=${encodeURIComponent(query.trim())}`,
                    )
                    .then(setTrace)
                    .catch((error: unknown) =>
                      setTraceError(error instanceof Error ? error.message : 'Search failed'),
                    );
                }}
              >
                Trace
              </button>
            </div>
            {traceError ? (
              <p className="form-error" role="alert">
                {traceError}
              </p>
            ) : null}
            {trace ? (
              <div className="table-panel">
                <table aria-label="Correlation results">
                  <thead>
                    <tr>
                      <th>System record</th>
                      <th>Identifier</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(trace.results).flatMap(([kind, rows]) =>
                      rows.map((row) => (
                        <tr key={`${kind}-${row.id}`}>
                          <td>{titleCase(kind)}</td>
                          <td>
                            <code>{row.id}</code>
                          </td>
                          <td>{titleCase(row.status ?? row.action ?? 'matched')}</td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">
                Search uses exact correlation identifiers and respects the administrator’s vendor
                scope.
              </p>
            )}
          </section>
        </>
      ) : (
        <EmptyState
          title="No performance data"
          description="No source records are available for this period."
        />
      )}
    </Page>
  );
}

export function VendorDirectoryPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const query = useMemo(
    () => (search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''),
    [search],
  );
  const data = useAsync(() => api.operation<VendorList>(PLATFORM, 'vendors-list', query), [query]);
  return (
    <Page
      eyebrow="Vendor"
      title="Vendors"
      description="Track approval, Payment provisioning and operational activity for every vendor."
      action={
        <div className="inline-actions">
          <label className="search-control">
            <span className="sr-only">Search vendors</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search business or email"
            />
          </label>
          <button
            className="button secondary"
            disabled={!data.data?.items.length}
            onClick={() =>
              exportCsv(
                'vendor-directory.csv',
                [
                  'Vendor',
                  'Email',
                  'Lifecycle',
                  'Payment account',
                  'Orders',
                  'Dispatches',
                  'Joined',
                ],
                (data.data?.items ?? [])
                  .slice(0, 100)
                  .map((vendor) => [
                    vendor.businessName,
                    vendor.email,
                    vendor.status,
                    vendor.paymentProvisioning,
                    vendor._count.orders,
                    vendor._count.dispatches,
                    vendor.createdAt,
                  ]),
              )
            }
          >
            Export visible rows
          </button>
        </div>
      }
    >
      {data.loading ? (
        <LoadingState />
      ) : data.error ? (
        <ErrorState error={data.error} retry={data.reload} />
      ) : !data.data?.items.length ? (
        <EmptyState
          title="No vendors found"
          description="Approved and onboarding vendors will appear here."
        />
      ) : (
        <div className="table-panel">
          <table aria-label="Vendors">
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Lifecycle</th>
                <th>Payment account</th>
                <th>Orders</th>
                <th>Dispatches</th>
                <th>Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.data.items.map((vendor) => (
                <tr key={vendor.id}>
                  <td>
                    <strong>{vendor.businessName}</strong>
                    <small>{vendor.email}</small>
                  </td>
                  <td>
                    <StatusBadge value={vendor.status} />
                  </td>
                  <td>
                    <StatusBadge value={vendor.paymentProvisioning} />
                  </td>
                  <td>{vendor._count.orders}</td>
                  <td>{vendor._count.dispatches}</td>
                  <td>{formatDate(vendor.createdAt)}</td>
                  <td>
                    <button
                      className="text-link"
                      onClick={() => navigate(`/p/vendor/vendors/${vendor.id}`)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}

export function VendorDetailPage() {
  const { vendorId = '' } = useParams();
  const data = useAsync(
    () =>
      api.operation<VendorDetail>(
        PLATFORM,
        'vendors-detail',
        `?vendorId=${encodeURIComponent(vendorId)}`,
      ),
    [vendorId],
  );
  const [action, setAction] = useState<
    | 'vendor-suspend'
    | 'vendor-reactivate'
    | 'vendor-dispatch-freeze'
    | 'vendor-dispatch-unfreeze'
    | 'sessions-revoke'
    | 'provisioning-retry'
  >();
  const [stepUp, setStepUp] = useState(false);
  const [message, setMessage] = useState('');
  if (data.loading)
    return (
      <Page eyebrow="Vendor" title="Vendor detail" description="Loading vendor profile.">
        <LoadingState />
      </Page>
    );
  if (data.error)
    return (
      <Page eyebrow="Vendor" title="Vendor detail" description="Vendor operational record.">
        <ErrorState error={data.error} retry={data.reload} />
      </Page>
    );
  const vendor = data.data!;
  return (
    <Page
      eyebrow="Vendor 360"
      title={vendor.businessName}
      description={`${vendor.email} · ${vendor.phone}`}
      action={
        <div className="inline-actions">
          <button className="button secondary" onClick={() => setStepUp(true)}>
            Verify MFA
          </button>
          <select
            aria-label="Vendor action"
            defaultValue=""
            onChange={(event) => {
              if (event.target.value) setAction(event.target.value as typeof action);
              event.currentTarget.value = '';
            }}
          >
            <option value="" disabled>
              Choose action
            </option>
            <option value={vendor.status === 'SUSPENDED' ? 'vendor-reactivate' : 'vendor-suspend'}>
              {vendor.status === 'SUSPENDED' ? 'Reactivate vendor' : 'Suspend vendor'}
            </option>
            <option value="vendor-dispatch-freeze">Freeze new dispatches</option>
            <option value="vendor-dispatch-unfreeze">Unfreeze new dispatches</option>
            <option value="sessions-revoke">Revoke staff sessions</option>
            <option value="provisioning-retry">Retry provisioning</option>
          </select>
        </div>
      }
    >
      {message ? (
        <p className="notice" role="status">
          {message}
        </p>
      ) : null}
      <div className="metric-grid">
        <Metric label="Lifecycle" value={titleCase(vendor.status)} note={vendor.type} />
        <Metric
          label="Payment account"
          value={titleCase(vendor.paymentProvisioning)}
          note="Operational gate"
        />
        <Metric
          label="Orders"
          value={String(vendor._count.orders)}
          note={`${vendor._count.customers} customers`}
        />
        <Metric
          label="Dispatches"
          value={String(vendor._count.dispatches)}
          note={`${vendor._count.dispatchers} riders`}
        />
        <Metric
          label="Projected earnings"
          value={money(vendor.finance.earningsMinor)}
          note={vendor.finance.classification}
        />
      </div>
      <div className="content-grid two-column">
        <section className="review-section">
          <h3>Provisioning timeline</h3>
          {vendor.provisioningSagas.length ? (
            <ol className="timeline">
              {vendor.provisioningSagas.map((saga) => (
                <li key={saga.id}>
                  <StatusBadge value={saga.status} />
                  <strong>{saga.attempts} attempts</strong>
                  <span>{formatDate(saga.updatedAt)}</span>
                  {saga.lastErrorCode ? <small>{titleCase(saga.lastErrorCode)}</small> : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">No provisioning run yet.</p>
          )}
        </section>
        <section className="review-section">
          <h3>Financial posture</h3>
          <dl className="review-details">
            <div>
              <dt>Projected order value</dt>
              <dd>{money(vendor.finance.totalAmountMinor)}</dd>
            </div>
            <div>
              <dt>Projected earnings</dt>
              <dd>{money(vendor.finance.earningsMinor)}</dd>
            </div>
            <div>
              <dt>Outstanding fees</dt>
              <dd>{money(vendor.finance.outstandingFeeMinor)}</dd>
            </div>
            <div>
              <dt>Classification</dt>
              <dd>
                <StatusBadge value={vendor.finance.classification} />
              </dd>
            </div>
          </dl>
        </section>
      </div>
      {stepUp ? <StepUpDialog close={() => setStepUp(false)} /> : null}
      {action ? (
        <ReasonModal
          title={titleCase(action)}
          description={`Confirm the operational impact on ${vendor.businessName}. Critical actions require recent MFA and two independent approvals.`}
          confirmLabel="Submit protected action"
          onClose={() => setAction(undefined)}
          onSubmit={async (reason) => {
            const outcome = await executeCriticalOperation({
              platformKey: PLATFORM,
              operation: action,
              reason,
              payload: { vendorId: vendor.id },
            });
            setMessage(
              outcome.status === 'requested'
                ? criticalRequestMessage(action)
                : `${titleCase(action)} completed.`,
            );
            setAction(undefined);
            if (outcome.status === 'executed') data.reload();
          }}
        />
      ) : null}
    </Page>
  );
}

export function VendorProvisioningPage() {
  const data = useAsync(() => api.operation<ProvisioningRow[]>(PLATFORM, 'provisioning-list'), []);
  return (
    <Page
      eyebrow="Vendor"
      title="Payment provisioning"
      description="SVA, main-wallet and settlement-wallet activation status."
    >
      {data.loading ? (
        <LoadingState />
      ) : data.error ? (
        <ErrorState error={data.error} retry={data.reload} />
      ) : !data.data?.length ? (
        <EmptyState
          title="No provisioning runs"
          description="Approved vendors will enter this queue automatically."
        />
      ) : (
        <div className="table-panel">
          <table>
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Last update</th>
                <th>Recovery</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.vendor.businessName}</strong>
                    <small>{row.vendor.email}</small>
                  </td>
                  <td>
                    <StatusBadge value={row.status} />
                  </td>
                  <td>{row.attempts}</td>
                  <td>{formatDate(row.updatedAt)}</td>
                  <td>{row.lastErrorCode ? titleCase(row.lastErrorCode) : 'No action required'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}

export function VendorFeesPage() {
  const data = useAsync(() => api.operation<FeePolicy[]>(PLATFORM, 'fee-policies-list'), []);
  const [selected, setSelected] = useState<FeePolicy>();
  const [creating, setCreating] = useState(false);
  const [stepUp, setStepUp] = useState(false);
  const [message, setMessage] = useState('');
  const [flatAmount, setFlatAmount] = useState('20');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [simulationBase, setSimulationBase] = useState('1000');
  const [simulation, setSimulation] = useState<FeeSimulation>();
  return (
    <Page
      eyebrow="Vendor"
      title="Fee policies"
      description="Immutable platform defaults and vendor overrides with effective dates."
      action={
        <div className="inline-actions">
          <button className="button secondary" onClick={() => setStepUp(true)}>
            Verify MFA
          </button>
          <button className="button primary" onClick={() => setCreating(true)}>
            Create fee version
          </button>
        </div>
      }
    >
      {message ? (
        <p className="notice" role="status">
          {message}
        </p>
      ) : null}
      <section className="review-section" aria-labelledby="fee-simulator-title">
        <h3 id="fee-simulator-title">Runway fee simulator</h3>
        <div className="inline-actions">
          <label>
            Operation value (NGN)
            <input
              type="number"
              min="0"
              step="0.01"
              value={simulationBase}
              onChange={(event) => setSimulationBase(event.target.value)}
            />
          </label>
          <button
            className="button secondary"
            onClick={() =>
              void api
                .mutate<FeeSimulation>(
                  PLATFORM,
                  'fee-policy-simulate',
                  'Fee policy preview for administrator',
                  {
                    feeCode: 'RUNWAY_DISPATCH',
                    baseAmountMinor: Math.round(Number(simulationBase) * 100),
                    currency: 'NGN',
                  },
                )
                .then(setSimulation)
            }
          >
            Preview resolved fee
          </button>
        </div>
        {simulation ? (
          <dl className="review-details">
            <div>
              <dt>Resolved fee</dt>
              <dd>{money(simulation.amountMinor, simulation.currency)}</dd>
            </div>
            <div>
              <dt>Policy version</dt>
              <dd>v{simulation.version}</dd>
            </div>
            <div>
              <dt>Calculation</dt>
              <dd>{titleCase(simulation.calculationType)}</dd>
            </div>
            <div>
              <dt>Immutable snapshot</dt>
              <dd>
                <code>{simulation.contentHash.slice(0, 12)}</code>
              </dd>
            </div>
          </dl>
        ) : (
          <p className="muted">
            Enter an operation value to preview the currently effective policy.
          </p>
        )}
      </section>
      {data.loading ? (
        <LoadingState />
      ) : data.error ? (
        <ErrorState error={data.error} retry={data.reload} />
      ) : !data.data?.length ? (
        <EmptyState
          title="No fee policies"
          description="Create an approved platform default before enabling the related operation."
        />
      ) : (
        <div className="table-panel">
          <table>
            <thead>
              <tr>
                <th>Fee</th>
                <th>Scope</th>
                <th>Version</th>
                <th>Calculation</th>
                <th>Deferral</th>
                <th>Status</th>
                <th>Effective</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((policy) => (
                <tr key={policy.id}>
                  <td>
                    <strong>{titleCase(policy.feeCode)}</strong>
                    <small>{policy.vendor?.businessName ?? 'All vendors'}</small>
                  </td>
                  <td>{titleCase(policy.scope)}</td>
                  <td>v{policy.version}</td>
                  <td>
                    {policy.calculationType === 'FLAT'
                      ? money(policy.flatAmountMinor ?? 0, policy.currency)
                      : `${((policy.percentageBps ?? 0) / 100).toFixed(2)}%`}
                  </td>
                  <td>{policy.deferralAllowed ? 'Allowed' : 'Not allowed'}</td>
                  <td>
                    <StatusBadge value={policy.status} />
                  </td>
                  <td>
                    {policy.effectiveFrom ? formatDate(policy.effectiveFrom) : 'Not scheduled'}
                  </td>
                  <td>
                    <button className="text-link" onClick={() => setSelected(policy)}>
                      {policy.status === 'ACTIVE' ? 'Retire' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {stepUp ? <StepUpDialog close={() => setStepUp(false)} /> : null}
      {creating ? (
        <ReasonModal
          title="Create Runway fee version"
          description="Creates an immutable NGN platform-default draft. Activation is a separate dual-control action."
          confirmLabel="Request creation"
          onClose={() => setCreating(false)}
          onSubmit={async (reason) => {
            const outcome = await executeCriticalOperation({
              platformKey: PLATFORM,
              operation: 'fee-policy-create',
              reason,
              payload: {
                feeCode: 'RUNWAY_DISPATCH',
                scope: 'PLATFORM_DEFAULT',
                currency: 'NGN',
                calculationType: 'FLAT',
                flatAmountMinor: Math.round(Number(flatAmount) * 100),
                roundingRule: 'HALF_UP',
                deferralAllowed: true,
              },
            });
            setMessage(
              outcome.status === 'requested'
                ? criticalRequestMessage('fee-policy-create')
                : 'Fee version created.',
            );
            setCreating(false);
            if (outcome.status === 'executed') data.reload();
          }}
        >
          <label>
            Flat amount (NGN)
            <input
              aria-label="Flat amount (NGN)"
              type="number"
              min="0"
              step="0.01"
              value={flatAmount}
              onChange={(event) => setFlatAmount(event.target.value)}
              required
            />
          </label>
        </ReasonModal>
      ) : null}
      {selected ? (
        <ReasonModal
          title={selected.status === 'ACTIVE' ? 'Retire fee policy' : 'Activate fee policy'}
          description={`Policy ${selected.feeCode} v${selected.version}. This preserves all historical assessments.`}
          confirmLabel={selected.status === 'ACTIVE' ? 'Request retirement' : 'Request activation'}
          onClose={() => setSelected(undefined)}
          onSubmit={async (reason) => {
            const operation =
              selected.status === 'ACTIVE' ? 'fee-policy-retire' : 'fee-policy-activate';
            const payload: Record<string, unknown> = { policyId: selected.id };
            if (operation === 'fee-policy-activate')
              payload.effectiveFrom = new Date(effectiveFrom).toISOString();
            const outcome = await executeCriticalOperation({
              platformKey: PLATFORM,
              operation,
              reason,
              payload,
            });
            setMessage(
              outcome.status === 'requested'
                ? criticalRequestMessage(operation)
                : `${titleCase(operation)} completed.`,
            );
            setSelected(undefined);
            if (outcome.status === 'executed') data.reload();
          }}
        >
          {selected.status !== 'ACTIVE' ? (
            <label>
              Effective from
              <input
                aria-label="Effective from"
                type="datetime-local"
                value={effectiveFrom}
                onChange={(event) => setEffectiveFrom(event.target.value)}
                required
              />
            </label>
          ) : null}
        </ReasonModal>
      ) : null}
    </Page>
  );
}

export function VendorOperationsPage({
  view,
}: {
  view: 'operations' | 'finance' | 'exceptions' | 'audit' | 'reviews' | 'dispatchers';
}) {
  const descriptions = {
    operations: 'Orders, manifests and dispatch execution across all vendors.',
    finance: 'Authoritative Payment references and Vendor operational projections.',
    exceptions: 'Payment, provisioning and dispatch exceptions requiring action.',
    audit: 'Correlated privileged activity across Admin and Vendor.',
    reviews: 'Business onboarding decisions and correction requests.',
    dispatchers: 'Dispatcher profile revisions awaiting Pepsa review.',
  };
  const data = useAsync(() => api.operation<Workbench>(PLATFORM, `${view}-read`), [view]);
  return (
    <Page eyebrow="Vendor" title={titleCase(view)} description={descriptions[view]}>
      {data.loading ? (
        <LoadingState />
      ) : data.error ? (
        <ErrorState error={data.error} retry={data.reload} />
      ) : data.data ? (
        <>
          <p className="muted">
            {titleCase(data.data.classification)} · {data.data.freshness} · as of{' '}
            {formatDate(data.data.asOf)}
          </p>
          <WorkbenchTable view={view} data={data.data} />
        </>
      ) : (
        <EmptyState title="No data available" description="No records match this view." />
      )}
    </Page>
  );
}

function WorkbenchTable({
  view,
  data,
}: {
  view: 'operations' | 'finance' | 'exceptions' | 'audit' | 'reviews' | 'dispatchers';
  data: Workbench;
}) {
  const [pendingAction, setPendingAction] = useState<{
    operation: string;
    title: string;
    payload: Record<string, unknown>;
  }>();
  const [message, setMessage] = useState('');
  const [detail, setDetail] = useState<{ kind: 'vendor' | 'dispatcher'; id: string }>();
  const actionModal = pendingAction ? (
    <ReasonModal
      title={pendingAction.title}
      description="Confirm the impact and provide an auditable business reason."
      confirmLabel="Confirm action"
      onClose={() => setPendingAction(undefined)}
      onSubmit={async (reason) => {
        await api.mutate(PLATFORM, pendingAction.operation, reason, pendingAction.payload);
        setMessage(`${pendingAction.title} completed.`);
        setPendingAction(undefined);
      }}
    />
  ) : null;
  const detailModal = detail ? (
    <ReviewDetailModal
      selection={detail}
      close={() => setDetail(undefined)}
      decide={(operation, title, payload) => {
        setDetail(undefined);
        setPendingAction({ operation, title, payload });
      }}
    />
  ) : null;
  if (view === 'operations') {
    const rows = [...(data.orders ?? []), ...(data.dispatches ?? [])];
    return rows.length ? (
      <div className="table-panel">
        <table aria-label="Vendor operations">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Vendor</th>
              <th>Type</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <code>{row.publicReference}</code>
                </td>
                <td>{row.vendor.businessName}</td>
                <td>{titleCase(row.mode ?? row.source ?? 'order')}</td>
                <td>
                  <StatusBadge value={row.status} />
                </td>
                <td>{formatDate(row.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <EmptyState title="No operations" description="Orders and dispatches will appear here." />
    );
  }
  if (view === 'finance') {
    const rows = [...(data.settlements ?? []), ...(data.receivables ?? [])];
    return rows.length ? (
      <div className="table-panel">
        <table aria-label="Vendor finance">
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Kind</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Payment reference</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.vendor.businessName}</td>
                <td>{titleCase(row.source ?? 'fee receivable')}</td>
                <td>{money(row.earningsMinor ?? row.amountMinor ?? 0, row.currency)}</td>
                <td>
                  <StatusBadge value={row.status} />
                </td>
                <td>
                  <code>{row.paymentReference ?? 'Pending'}</code>
                </td>
                <td>{formatDate(row.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <EmptyState
        title="No finance records"
        description="Settlement projections and fee receivables will appear here."
      />
    );
  }
  if (view === 'exceptions') {
    if (data.reconciliationCases?.length)
      return (
        <>
          <div className="table-panel">
            <table aria-label="Reconciliation exceptions">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Severity</th>
                  <th>Category</th>
                  <th>Explanation</th>
                  <th>Source</th>
                  <th>Opened</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.reconciliationCases.map((row) => (
                  <tr key={row.id}>
                    <td>{row.vendor.businessName}</td>
                    <td>
                      <StatusBadge value={row.severity} />
                    </td>
                    <td>{titleCase(row.category)}</td>
                    <td>{row.summary}</td>
                    <td>
                      {titleCase(row.sourceSystem)}
                      <small>
                        <code>{row.sourceReference}</code>
                      </small>
                    </td>
                    <td>{formatDate(row.createdAt)}</td>
                    <td>
                      <button
                        className="text-link"
                        onClick={() =>
                          setPendingAction({
                            operation: 'exception-resolve',
                            title: 'Resolve reconciliation case',
                            payload: { caseId: row.id },
                          })
                        }
                      >
                        Resolve
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {message ? (
            <p role="status" className="notice">
              {message}
            </p>
          ) : null}
          {actionModal}
        </>
      );
    const rows = [...(data.provisioning ?? []), ...(data.receivables ?? [])] as ExceptionRow[];
    return rows.length ? (
      <div className="table-panel">
        <table aria-label="Vendor exceptions">
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Category</th>
              <th>Current state</th>
              <th>Recovery detail</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.vendor.businessName}</td>
                <td>{row.lastErrorCode ? 'Provisioning' : 'Outstanding fee'}</td>
                <td>
                  <StatusBadge value={row.status ?? 'OUTSTANDING'} />
                </td>
                <td>
                  {row.lastErrorCode
                    ? titleCase(row.lastErrorCode)
                    : money((row.amountMinor ?? 0) - (row.collectedMinor ?? 0), row.currency)}
                </td>
                <td>{formatDate(row.updatedAt ?? row.createdAt ?? data.asOf)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <EmptyState
        title="No active exceptions"
        description="Provisioning and financial exception queues are clear."
      />
    );
  }
  if (view === 'audit') {
    return data.events?.length ? (
      <>
        <div className="table-panel">
          <table aria-label="Vendor audit">
            <thead>
              <tr>
                <th>Action</th>
                <th>Actor</th>
                <th>Outcome</th>
                <th>Request</th>
                <th>Time</th>
                <th>Recovery</th>
              </tr>
            </thead>
            <tbody>
              {data.events.map((row) => (
                <tr key={row.id}>
                  <td>{titleCase(row.action)}</td>
                  <td>
                    <code>{row.actorId}</code>
                  </td>
                  <td>
                    <StatusBadge value={row.outcome} />
                  </td>
                  <td>
                    <code>{row.requestId ?? 'Not recorded'}</code>
                  </td>
                  <td>{formatDate(row.createdAt)}</td>
                  <td>
                    <button
                      className="text-link"
                      onClick={() =>
                        setPendingAction({
                          operation: 'delivery-replay',
                          title: 'Replay event delivery',
                          payload: { eventId: row.id },
                        })
                      }
                    >
                      Replay
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {message ? (
          <p role="status" className="notice">
            {message}
          </p>
        ) : null}
        {actionModal}
      </>
    ) : (
      <EmptyState
        title="No audit events"
        description="Correlated privileged actions will appear here."
      />
    );
  }
  if (view === 'reviews') {
    return data.applications?.length ? (
      <>
        <div className="table-panel">
          <table aria-label="Vendor reviews">
            <thead>
              <tr>
                <th>Business</th>
                <th>Type</th>
                <th>Version</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Decision</th>
              </tr>
            </thead>
            <tbody>
              {data.applications.map((row) => (
                <tr key={row.id}>
                  <td>{row.vendor.businessName}</td>
                  <td>{titleCase(row.vendor.type ?? 'vendor')}</td>
                  <td>v{row.version}</td>
                  <td>
                    <StatusBadge value={row.status} />
                  </td>
                  <td>{row.submittedAt ? formatDate(row.submittedAt) : 'Not submitted'}</td>
                  <td>
                    <div className="inline-actions">
                      <button
                        className="text-link"
                        onClick={() => setDetail({ kind: 'vendor', id: row.id })}
                      >
                        View details
                      </button>
                      <button
                        className="text-link"
                        onClick={() =>
                          setPendingAction({
                            operation: 'vendor-application-review',
                            title: 'Approve vendor application',
                            payload: { applicationId: row.id, decision: 'APPROVE' },
                          })
                        }
                      >
                        Approve
                      </button>
                      <button
                        className="text-link"
                        onClick={() =>
                          setPendingAction({
                            operation: 'vendor-application-review',
                            title: 'Request vendor correction',
                            payload: {
                              applicationId: row.id,
                              decision: 'REJECT',
                              correctionFields: ['APPLICATION_DETAILS'],
                            },
                          })
                        }
                      >
                        Request correction
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {message ? (
          <p role="status" className="notice">
            {message}
          </p>
        ) : null}
        {actionModal}
        {detailModal}
      </>
    ) : (
      <EmptyState title="No business reviews" description="The business review queue is clear." />
    );
  }
  return data.revisions?.length ? (
    <>
      <div className="table-panel">
        <table aria-label="Dispatcher reviews">
          <thead>
            <tr>
              <th>Dispatcher</th>
              <th>Vendor</th>
              <th>Engagement</th>
              <th>Vehicle</th>
              <th>Status</th>
              <th>Submitted</th>
              <th>Review</th>
            </tr>
          </thead>
          <tbody>
            {data.revisions.map((row) => (
              <tr key={row.id}>
                <td>
                  {row.firstName} {row.lastName}
                </td>
                <td>{row.dispatcher.vendor.businessName}</td>
                <td>{titleCase(row.engagementType)}</td>
                <td>{titleCase(row.vehicleType)}</td>
                <td>
                  <StatusBadge value={row.status} />
                </td>
                <td>{row.submittedAt ? formatDate(row.submittedAt) : 'Not submitted'}</td>
                <td>
                  <button
                    className="text-link"
                    onClick={() => setDetail({ kind: 'dispatcher', id: row.id })}
                  >
                    View details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {message ? (
        <p role="status" className="notice">
          {message}
        </p>
      ) : null}
      {actionModal}
      {detailModal}
    </>
  ) : (
    <EmptyState title="No dispatcher reviews" description="The dispatcher review queue is clear." />
  );
}

function ReviewDetailModal({
  selection,
  close,
  decide,
}: {
  selection: { kind: 'vendor' | 'dispatcher'; id: string };
  close(): void;
  decide(operation: string, title: string, payload: Record<string, unknown>): void;
}) {
  const operation =
    selection.kind === 'vendor' ? 'vendor-application-detail' : 'dispatcher-review-detail';
  const parameter = selection.kind === 'vendor' ? 'applicationId' : 'revisionId';
  const detail = useAsync(
    () =>
      api.operation<VendorApplicationDetail | DispatcherReviewDetail>(
        PLATFORM,
        operation,
        `?${parameter}=${encodeURIComponent(selection.id)}`,
      ),
    [operation, parameter, selection.id],
  );
  const openDocument = async (documentId: string) => {
    const documentOperation =
      selection.kind === 'vendor' ? 'vendor-application-document' : 'dispatcher-review-document';
    const result = await api.operation<{ url: string }>(
      PLATFORM,
      documentOperation,
      `?${parameter}=${encodeURIComponent(selection.id)}&documentId=${encodeURIComponent(documentId)}`,
    );
    window.open(result.url, '_blank', 'noopener,noreferrer');
  };
  const value = detail.data;
  const vendor =
    selection.kind === 'vendor' ? (value as VendorApplicationDetail | undefined) : undefined;
  const dispatcher =
    selection.kind === 'dispatcher' ? (value as DispatcherReviewDetail | undefined) : undefined;
  const documents = vendor?.documents ?? dispatcher?.documents ?? [];
  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="modal modal-wide"
        role="dialog"
        aria-modal="true"
        aria-label="Review submitted details"
      >
        <header>
          <div>
            <p className="eyebrow">Approval review</p>
            <h2>
              {vendor?.vendor.businessName ??
                (dispatcher
                  ? `${dispatcher.firstName} ${dispatcher.lastName}`
                  : 'Submitted details')}
            </h2>
          </div>
          <button className="icon-control" onClick={close} aria-label="Close review details">
            ×
          </button>
        </header>
        {detail.loading ? (
          <LoadingState />
        ) : detail.error ? (
          <ErrorState error={detail.error} retry={detail.reload} />
        ) : value ? (
          <>
            <div className="table-panel">
              <table aria-label="Submitted profile details">
                <tbody>
                  {(vendor
                    ? [
                        ['Business type', vendor.vendor.type],
                        ['Email', vendor.vendor.email],
                        ['Phone', vendor.vendor.phone],
                        ['Legal name', vendor.businessData.legalName],
                        ['Registration type', vendor.businessData.registrationType],
                        ['Registration number', vendor.businessData.registrationNumber],
                        ['Tax number', vendor.businessData.taxNumber],
                        ['Registered address', vendor.businessData.registeredAddress],
                        ['Operating address', vendor.businessData.businessAddress],
                        [
                          'State / city',
                          [vendor.businessData.state, vendor.businessData.city]
                            .filter(Boolean)
                            .join(', '),
                        ],
                      ]
                    : [
                        ['Email', dispatcher?.email],
                        ['Phone', dispatcher?.phone],
                        [
                          'Date of birth',
                          dispatcher?.dateOfBirth ? formatDate(dispatcher.dateOfBirth) : undefined,
                        ],
                        ['Gender', dispatcher?.gender],
                        ['Identity type', dispatcher?.identityType],
                        ['Address', dispatcher?.homeAddress],
                        [
                          'State / city',
                          [dispatcher?.state, dispatcher?.city].filter(Boolean).join(', '),
                        ],
                        ['Engagement', dispatcher?.engagementType],
                        [
                          'Vehicle',
                          [
                            dispatcher?.vehicleBrand,
                            dispatcher?.vehicleType,
                            dispatcher?.plateNumber,
                          ]
                            .filter(Boolean)
                            .join(' · '),
                        ],
                        [
                          'Guarantor',
                          [dispatcher?.guarantorName, dispatcher?.guarantorPhone]
                            .filter(Boolean)
                            .join(' · '),
                        ],
                        ['Revenue share', `${dispatcher?.revenueSharePct}%`],
                      ]
                  ).map(([label, field]) => (
                    <tr key={label}>
                      <th>{label}</th>
                      <td>{field ? titleCase(String(field)) : 'Not provided'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {vendor?.directors.length ? (
              <div>
                <h3>Directors</h3>
                <div className="table-panel">
                  <table aria-label="Submitted directors">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Role</th>
                        <th>Phone</th>
                        <th>Ownership</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendor.directors.map((director) => (
                        <tr key={director.id}>
                          <td>
                            {director.firstName} {director.lastName}
                          </td>
                          <td>{titleCase(director.role)}</td>
                          <td>{director.phone}</td>
                          <td>{director.ownershipShare}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
            <div>
              <h3>Documents</h3>
              {documents.length ? (
                <div className="table-panel">
                  <table aria-label="Submitted documents">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>File</th>
                        <th>Status</th>
                        <th>Access</th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map((document) => (
                        <tr key={document.id}>
                          <td>{titleCase(document.documentType)}</td>
                          <td>{document.originalName}</td>
                          <td>
                            <StatusBadge value={document.status} />
                          </td>
                          <td>
                            <button
                              className="text-link"
                              onClick={() => void openDocument(document.id)}
                            >
                              View document
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted">No documents submitted.</p>
              )}
            </div>
            <footer>
              <button className="button secondary" onClick={close}>
                Close
              </button>
              <button
                className="button danger"
                onClick={() =>
                  decide(
                    selection.kind === 'vendor' ? 'vendor-application-review' : 'dispatcher-review',
                    'Request correction',
                    {
                      [parameter]: selection.id,
                      decision: 'REJECT',
                      correctionFields: ['APPLICATION_DETAILS'],
                    },
                  )
                }
              >
                Request correction
              </button>
              <button
                className="button primary"
                onClick={() =>
                  decide(
                    selection.kind === 'vendor' ? 'vendor-application-review' : 'dispatcher-review',
                    'Approve submission',
                    { [parameter]: selection.id, decision: 'APPROVE' },
                  )
                }
              >
                Approve
              </button>
            </footer>
          </>
        ) : (
          <EmptyState
            title="Details unavailable"
            description="The submitted record could not be loaded."
          />
        )}
      </section>
    </div>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}
function StatusTable({ title, rows }: { title: string; rows: Count[] }) {
  return (
    <section className="table-panel">
      <header>
        <h3>{title}</h3>
      </header>
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.status}>
              <td>
                <StatusBadge value={row.status} />
              </td>
              <td>{row.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
