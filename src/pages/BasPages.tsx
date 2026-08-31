import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../app/AuthContext.js';
import { StepUpDialog } from '../components/StepUpDialog.js';
import { Page } from '../components/Page.js';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '../components/States.js';
import { api, type BasOverview } from '../core/api.js';
import { formatDate, formatMoney } from '../core/format.js';
import { useAsync } from '../core/useAsync.js';

function useDebouncedValue<T>(value: T, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function businessesQuery(search: string) {
  const trimmed = search.trim();
  if (!trimmed) return '';
  return `?${new URLSearchParams({ q: trimmed })}`;
}

interface Business {
  id: string;
  name: string;
  legalName?: string;
  businessType?: string;
  rcNumber?: string;
  intendedUseCase?: string;
  email: string;
  phone?: string;
  website?: string;
  status: string;
  statusReason?: string;
  reviewedAt?: string;
  environment: string;
  apiAccessStatus: string;
  rateLimitTier: string;
  paymentMethod?: string;
  deliveryType?: string;
  createdAt: string;
  updatedAt: string;
  directors: Array<{
    id: string;
    name: string;
    phone: string;
    email: string;
    idNumber: string;
  }>;
  storedAssets: Array<{
    id: string;
    directorId?: string;
    kind: string;
    filename?: string;
    mimeType: string;
    byteSize: number;
    retentionExpiresAt?: string;
    legalHoldAt?: string;
    legalHoldReason?: string;
    createdAt: string;
  }>;
}
interface BusinessDocument {
  id: string;
  filename: string;
  mimeType: string;
  byteSize: number;
  contentBase64: string;
}
interface Order {
  id: string;
  clientReferenceId: string;
  publicTrackingCode: string;
  status: string;
  deliveryType: string;
  quotedAmount: string;
  currency: string;
  createdAt: string;
  business: { name: string };
  assets: Array<{
    id: string;
    filename?: string;
    retentionExpiresAt?: string;
    legalHoldAt?: string;
    legalHoldReason?: string;
  }>;
}
interface Wallet {
  id: string;
  status: string;
  environment: string;
  currency: string;
  currentBalance: string;
  reservedBalance: string;
  updatedAt: string;
  business: { name: string; email: string };
}
interface PricingVersion {
  id: string;
  scope: string;
  version: number;
  status: string;
  currency: string;
  minimumDeliveryPrice?: string;
  activatedAt?: string;
  createdAt: string;
  recordType?: 'VERSION' | 'OVERRIDE';
  perKmRate?: string;
  profile?: { name: string; business: { id: string; name: string } };
}
interface PricingWorkbookReport {
  valid: boolean;
  summary: {
    stateCount: number;
    enabledRateCount: number;
    ignoredDisabledRateCount: number;
    discountTierCount: number;
    interstateRouteCount: number;
    interstateWeightBandCount: number;
    ignoredDisabledInterstateBandCount: number;
  };
  issues: Array<{
    severity: 'ERROR' | 'WARNING';
    code: string;
    sheet: string;
    row?: number;
    message: string;
  }>;
}
interface PricingWorkbookExport {
  filename: string;
  fileBase64: string;
  versionId: string;
  version: number;
  status: string;
}
interface Transaction {
  id: string;
  type: string;
  category: string;
  status: string;
  amount: string;
  currency: string;
  referenceId?: string;
  correlationId?: string;
  createdAt: string;
  environment: string;
  business: { name: string };
}
interface Invoice {
  id: string;
  periodStart: string;
  periodEnd: string;
  dueAt: string;
  currency: string;
  subtotal: string;
  paidAmount: string;
  status: string;
  billingCycle: string;
  createdAt: string;
  environment: string;
  business: { name: string };
}
interface ApiKeyRecord {
  id: string;
  publicKey: string;
  environment: string;
  status: string;
  expiresAt?: string;
  lastUsedAt?: string;
  scheduledRotationAt?: string;
  createdAt: string;
  business: { name: string };
}
interface WebhookEndpoint {
  id: string;
  environment: string;
  url: string;
  enabled: boolean;
  eventTypes: string[];
  verifiedAt?: string;
  createdAt: string;
  business: { name: string };
}
interface WebhookDelivery {
  id: string;
  correlationId: string;
  status: string;
  attempts: number;
  responseStatus?: number;
  failureReason?: string;
  deliveredAt?: string;
  deadLetteredAt?: string;
  createdAt: string;
  endpoint: {
    id: string;
    url: string;
    enabled: boolean;
    environment: string;
    business: { name: string };
  };
}
interface PlatformAudit {
  id: string;
  action: string;
  entity: string;
  entityId?: string;
  requestId?: string;
  createdAt: string;
}

export function BasOverviewPage() {
  const result = useAsync(
    () => api.operation<BasOverview>('business-as-a-service', 'overview'),
    [],
  );
  return (
    <Page
      eyebrow="Business as a Service"
      title="Platform overview"
      description="Tenant, fulfillment, and financial posture through the isolated BAS admin contract."
    >
      {result.loading ? (
        <LoadingState />
      ) : result.error || !result.data ? (
        <ErrorState error={result.error ?? new Error('No data')} retry={result.reload} />
      ) : (
        <div className="metric-grid">
          <article className="metric">
            <span>Total businesses</span>
            <strong>{result.data.businesses.total}</strong>
            <small>{result.data.businesses.pendingReview} pending review</small>
          </article>
          <article className="metric">
            <span>Total orders</span>
            <strong>{result.data.orders.total}</strong>
            <small>{result.data.orders.active} active now</small>
          </article>
          <article className="metric">
            <span>Order exceptions</span>
            <strong>{result.data.orders.exceptions}</strong>
            <small>Require investigation</small>
          </article>
          <article className="metric">
            <span>Wallet balance</span>
            <strong>{formatMoney(result.data.finance.walletBalance)}</strong>
            <small>{formatMoney(result.data.finance.reservedBalance)} reserved</small>
          </article>
        </div>
      )}
    </Page>
  );
}

export function BusinessesPage() {
  const auth = useAuth();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const result = useAsync(
    () =>
      api.operation<Business[]>(
        'business-as-a-service',
        'businesses',
        businessesQuery(debouncedSearch),
      ),
    [debouncedSearch],
  );
  const [review, setReview] = useState<Business>();
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulk, setBulk] = useState(false);
  const [stepUp, setStepUp] = useState(false);
  const submit = async (status: string, reason: string) => {
    if (!review) return;
    try {
      await api.mutate('business-as-a-service', 'businesses-review', reason, {
        businessId: review.id,
        status,
      });
      setReview(undefined);
      await result.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Review failed');
    }
  };
  const setLegalHold = async (assetId: string, action: 'PLACE' | 'RELEASE', reason: string) => {
    try {
      await api.mutate('business-as-a-service', 'asset-legal-hold', reason, { assetId, action });
      setReview(undefined);
      await result.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Legal hold operation failed');
    }
  };
  return (
    <Page
      eyebrow="Business as a Service"
      title="Businesses"
      description="Review tenant identity, operational status, environment, and API access."
      action={
        auth.can('bas.businesses.review') ? (
          <div className="inline-actions">
            <button className="button secondary" onClick={() => setStepUp(true)}>
              Verify MFA
            </button>
            <button
              className="button primary"
              disabled={!selectedIds.size}
              onClick={() => setBulk(true)}
            >
              Review selected ({selectedIds.size})
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="filter-bar">
        <label>
          Search businesses
          <input
            aria-label="Search businesses"
            placeholder="Name, email, phone, or RC number"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>
      {result.loading ? (
        <LoadingState />
      ) : result.error ? (
        <ErrorState error={result.error} retry={result.reload} />
      ) : !result.data?.length ? (
        <EmptyState
          title={debouncedSearch.trim() ? 'No matching businesses' : 'No businesses'}
          description={
            debouncedSearch.trim()
              ? 'Try another name, email, phone, or RC number.'
              : 'BAS tenants will appear here.'
          }
        />
      ) : (
        <div className="table-panel">
          <table aria-label="Businesses">
            <thead>
              <tr>
                <th>
                  <span className="sr-only">Select</span>
                </th>
                <th>Business</th>
                <th>Status</th>
                <th>Active context</th>
                <th>API access</th>
                <th>Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {result.data.map((business) => (
                <tr key={business.id}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select ${business.name}`}
                      checked={selectedIds.has(business.id)}
                      onChange={(event) =>
                        setSelectedIds((current) => {
                          const next = new Set(current);
                          if (event.target.checked) next.add(business.id);
                          else next.delete(business.id);
                          return next;
                        })
                      }
                    />
                  </td>
                  <td>
                    <strong>{business.name}</strong>
                    <small>{business.email}</small>
                  </td>
                  <td>
                    <StatusBadge value={business.status} />
                  </td>
                  <td>{business.environment}</td>
                  <td>
                    <StatusBadge value={business.apiAccessStatus} />
                  </td>
                  <td>{formatDate(business.createdAt)}</td>
                  <td>
                    <button className="text-link" onClick={() => setReview(business)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {review && (
        <ReviewDialog
          business={review}
          error={error}
          close={() => {
            setReview(undefined);
            setError('');
          }}
          submit={submit}
          canReview={auth.can('bas.businesses.review')}
          canManageLegalHold={auth.can('bas.assets.legal-hold')}
          setLegalHold={setLegalHold}
        />
      )}
      {bulk && (
        <BulkReviewDialog
          businesses={result.data?.filter(({ id }) => selectedIds.has(id)) ?? []}
          close={() => setBulk(false)}
          completed={async () => {
            setBulk(false);
            setSelectedIds(new Set());
            await result.reload();
          }}
        />
      )}
      {stepUp && <StepUpDialog close={() => setStepUp(false)} />}
    </Page>
  );
}

function BulkReviewDialog({
  businesses,
  close,
  completed,
}: {
  businesses: Business[];
  close(): void;
  completed(): Promise<void>;
}) {
  const [status, setStatus] = useState('APPROVED');
  const [reason, setReason] = useState('');
  const [preview, setPreview] = useState<{
    canExecute: boolean;
    items: Array<{
      businessId: string;
      name?: string;
      from?: string;
      to: string;
      valid: boolean;
      issue?: string;
    }>;
    compensation: string;
  }>();
  const [error, setError] = useState('');
  const payload = () => ({ items: businesses.map(({ id }) => ({ businessId: id, status })) });
  const loadPreview = async () => {
    try {
      setPreview(
        await api.mutate(
          'business-as-a-service',
          'businesses-bulk-review-preview',
          reason,
          payload(),
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Preview failed');
    }
  };
  const execute = async () => {
    try {
      await api.mutate('business-as-a-service', 'businesses-bulk-review', reason, payload());
      await completed();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Bulk review failed');
    }
  };
  return (
    <div className="modal-backdrop">
      <div
        className="modal modal-wide"
        role="dialog"
        aria-modal="true"
        aria-label="Bulk business review"
      >
        <header>
          <div>
            <p className="eyebrow">Preview required</p>
            <h2>Review {businesses.length} businesses</h2>
          </div>
          <button className="icon-control" onClick={close}>
            ×
          </button>
        </header>
        {error && <div className="form-error">{error}</div>}
        <label>
          Target status
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPreview(undefined);
            }}
          >
            <option>APPROVED</option>
            <option>UNDER_REVIEW</option>
            <option>REJECTED</option>
            <option>SUSPENDED</option>
          </select>
        </label>
        <label>
          Business reason
          <textarea
            minLength={8}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setPreview(undefined);
            }}
            required
          />
        </label>
        {preview && (
          <div className="bulk-preview">
            <strong>
              {preview.canExecute ? 'Ready to execute' : 'Resolve invalid transitions'}
            </strong>
            {preview.items.map((item) => (
              <p key={item.businessId}>
                <StatusBadge value={item.valid ? 'valid' : 'invalid'} />{' '}
                {item.name ?? item.businessId}: {item.from ?? 'missing'} → {item.to} {item.issue}
              </p>
            ))}
            <small>{preview.compensation}</small>
          </div>
        )}
        <footer>
          {preview?.canExecute ? (
            <button className="button danger" onClick={() => void execute()}>
              Confirm queued review
            </button>
          ) : (
            <button
              className="button primary"
              disabled={reason.trim().length < 8}
              onClick={() => void loadPreview()}
            >
              Preview changes
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

function ReviewDialog({
  business,
  error,
  close,
  submit,
  canReview,
  canManageLegalHold,
  setLegalHold,
}: {
  business: Business;
  error: string;
  close(): void;
  submit(status: string, reason: string): Promise<void>;
  canReview: boolean;
  canManageLegalHold: boolean;
  setLegalHold(assetId: string, action: 'PLACE' | 'RELEASE', reason: string): Promise<void>;
}) {
  const navigate = useNavigate();
  const transitions: Record<string, string[]> = {
    PENDING: ['UNDER_REVIEW', 'REJECTED'],
    UNDER_REVIEW: ['APPROVED', 'REJECTED'],
    APPROVED: ['SUSPENDED'],
    REJECTED: ['UNDER_REVIEW'],
    SUSPENDED: ['APPROVED'],
  };
  const availableStatuses = transitions[business.status] ?? [];
  const [status, setStatus] = useState(availableStatuses[0] ?? business.status);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [document, setDocument] = useState<BusinessDocument>();
  const [documentError, setDocumentError] = useState('');
  const [loadingDocumentId, setLoadingDocumentId] = useState('');
  const [legalHoldAssetId, setLegalHoldAssetId] = useState('');
  const changeLegalHold = async (asset: Business['storedAssets'][number]) => {
    const action = asset.legalHoldAt ? 'RELEASE' : 'PLACE';
    const reason = window.prompt(
      `${action === 'PLACE' ? 'Reason for placing' : 'Reason for releasing'} the legal hold (minimum 8 characters)`,
    );
    if (!reason) return;
    if (reason.trim().length < 8) {
      setDocumentError('A legal-hold reason of at least 8 characters is required');
      return;
    }
    setLegalHoldAssetId(asset.id);
    setDocumentError('');
    await setLegalHold(asset.id, action, reason.trim()).finally(() => setLegalHoldAssetId(''));
  };
  const openDocument = async (assetId: string) => {
    setLoadingDocumentId(assetId);
    setDocumentError('');
    try {
      setDocument(
        await api.operation<BusinessDocument>(
          'business-as-a-service',
          'business-document',
          `?assetId=${encodeURIComponent(assetId)}`,
        ),
      );
    } catch (cause) {
      setDocumentError(cause instanceof Error ? cause.message : 'Document could not be opened');
    } finally {
      setLoadingDocumentId('');
    }
  };
  const documentSource = document
    ? `data:${document.mimeType};base64,${document.contentBase64}`
    : undefined;
  return (
    <div className="modal-backdrop">
      <form
        className="modal modal-wide"
        role="dialog"
        aria-modal="true"
        aria-label="Review business"
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          void submit(status, reason).finally(() => setBusy(false));
        }}
      >
        <header>
          <div>
            <p className="eyebrow">Business profile</p>
            <h2>{business.name}</h2>
          </div>
          <button type="button" className="icon-control" onClick={close}>
            ×
          </button>
        </header>
        {error && <div className="form-error">{error}</div>}
        <section className="review-section">
          <div className="review-section-heading">
            <div>
              <p className="eyebrow">Application</p>
              <h3>Company information</h3>
            </div>
            <StatusBadge value={business.status} />
          </div>
          <dl className="review-details">
            <div>
              <dt>Legal name</dt>
              <dd>{business.legalName ?? business.name}</dd>
            </div>
            <div>
              <dt>Business type</dt>
              <dd>{business.businessType?.replaceAll('_', ' ') ?? '—'}</dd>
            </div>
            <div>
              <dt>Registration number</dt>
              <dd>{business.rcNumber ?? '—'}</dd>
            </div>
            <div>
              <dt>Contact</dt>
              <dd>{business.email}</dd>
              <dd>{business.phone ?? '—'}</dd>
            </div>
            <div>
              <dt>User-selected context</dt>
              <dd>{business.environment}</dd>
            </div>
            <div>
              <dt>Submitted</dt>
              <dd>{formatDate(business.createdAt)}</dd>
            </div>
          </dl>
          {business.intendedUseCase && <p>{business.intendedUseCase}</p>}
        </section>
        <section className="review-section">
          <p className="eyebrow">Identity</p>
          <h3>Directors</h3>
          <div className="director-list">
            {business.directors.map((director) => (
              <article key={director.id}>
                <strong>{director.name}</strong>
                <span>{director.email}</span>
                <span>{director.phone}</span>
                <small>ID ending {director.idNumber}</small>
              </article>
            ))}
          </div>
        </section>
        <section className="review-section">
          <p className="eyebrow">Evidence</p>
          <h3>Uploaded documents</h3>
          {documentError && <div className="form-error">{documentError}</div>}
          <div className="document-list">
            {business.storedAssets.map((asset) => (
              <article key={asset.id}>
                <div>
                  <strong>{asset.kind.replaceAll('_', ' ')}</strong>
                  <small>
                    {asset.filename ?? 'Uploaded document'} · {Math.ceil(asset.byteSize / 1024)} KB
                  </small>
                  <small>
                    {asset.legalHoldAt
                      ? `Legal hold since ${formatDate(asset.legalHoldAt)}`
                      : asset.retentionExpiresAt
                        ? `Retained until ${formatDate(asset.retentionExpiresAt)}`
                        : 'No automated expiry'}
                  </small>
                </div>
                <div className="inline-actions">
                  <button
                    type="button"
                    className="text-link"
                    disabled={Boolean(loadingDocumentId)}
                    onClick={() => void openDocument(asset.id)}
                  >
                    {loadingDocumentId === asset.id ? 'Opening…' : 'View'}
                  </button>
                  {canManageLegalHold && (
                    <button
                      type="button"
                      className="text-link"
                      disabled={Boolean(legalHoldAssetId)}
                      onClick={() => void changeLegalHold(asset)}
                    >
                      {legalHoldAssetId === asset.id
                        ? 'Applying…'
                        : asset.legalHoldAt
                          ? 'Release hold'
                          : 'Place hold'}
                    </button>
                  )}
                </div>
              </article>
            ))}
            {!business.storedAssets.length && <p>No uploaded documents were found.</p>}
          </div>
          {document && documentSource && (
            <div className="document-preview">
              <header>
                <strong>{document.filename}</strong>
                <div className="inline-actions">
                  <a className="text-link" href={documentSource} download={document.filename}>
                    Download
                  </a>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => setDocument(undefined)}
                  >
                    Close preview
                  </button>
                </div>
              </header>
              {document.mimeType.startsWith('image/') ? (
                <img src={documentSource} alt={document.filename} />
              ) : (
                <iframe
                  title={document.filename}
                  src={documentSource}
                  sandbox="allow-same-origin"
                />
              )}
            </div>
          )}
        </section>
        {canReview && availableStatuses.length > 0 && (
          <>
            <label>
              Decision
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                {availableStatuses.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              Decision reason
              <textarea
                minLength={8}
                required
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <p className="risk-note">
              This decision is enforced in BAS and recorded in both audit trails.
            </p>
          </>
        )}
        <footer>
          <button
            type="button"
            className="button secondary"
            onClick={() => navigate(`/p/business-as-a-service/pricing?businessId=${business.id}`)}
          >
            View pricing
          </button>
          <button type="button" className="button secondary" onClick={close}>
            Close
          </button>
          {canReview && availableStatuses.length > 0 && (
            <button className="button danger" disabled={busy}>
              {busy ? 'Applying…' : 'Confirm decision'}
            </button>
          )}
        </footer>
      </form>
    </div>
  );
}

export function OrdersPage() {
  const auth = useAuth();
  const result = useAsync(() => api.operation<Order[]>('business-as-a-service', 'orders'), []);
  const [holdError, setHoldError] = useState('');
  const [busyAssetId, setBusyAssetId] = useState('');
  const changeLegalHold = async (asset: Order['assets'][number]) => {
    const action = asset.legalHoldAt ? 'RELEASE' : 'PLACE';
    const reason = window.prompt(
      `${action === 'PLACE' ? 'Reason for placing' : 'Reason for releasing'} the POD legal hold (minimum 8 characters)`,
    );
    if (!reason) return;
    if (reason.trim().length < 8) {
      setHoldError('A legal-hold reason of at least 8 characters is required');
      return;
    }
    setBusyAssetId(asset.id);
    setHoldError('');
    try {
      await api.mutate('business-as-a-service', 'asset-legal-hold', reason.trim(), {
        assetId: asset.id,
        action,
      });
      await result.reload();
    } catch (cause) {
      setHoldError(cause instanceof Error ? cause.message : 'Legal hold operation failed');
    } finally {
      setBusyAssetId('');
    }
  };
  return (
    <>
      {holdError && <div className="form-error">{holdError}</div>}
      <DataPage
        title="Orders"
        description="Cross-tenant fulfillment activity, proof-of-delivery retention, and exceptions."
        result={result}
        headers={[
          'Reference',
          'Business',
          'Status',
          'Delivery',
          'Amount',
          'POD evidence',
          'Created',
        ]}
        row={(order) => (
          <>
            <td>
              <strong>{order.clientReferenceId}</strong>
              <small>{order.publicTrackingCode}</small>
            </td>
            <td>{order.business.name}</td>
            <td>
              <StatusBadge value={order.status} />
            </td>
            <td>{order.deliveryType}</td>
            <td>{formatMoney(Number(order.quotedAmount), order.currency)}</td>
            <td>
              {!order.assets.length && <small>None</small>}
              {order.assets.map((asset) => (
                <div key={asset.id}>
                  <small>
                    {asset.legalHoldAt
                      ? `Held since ${formatDate(asset.legalHoldAt)}`
                      : asset.retentionExpiresAt
                        ? `Until ${formatDate(asset.retentionExpiresAt)}`
                        : 'No automated expiry'}
                  </small>
                  {auth.can('bas.assets.legal-hold') && (
                    <button
                      type="button"
                      className="text-link"
                      disabled={Boolean(busyAssetId)}
                      onClick={() => void changeLegalHold(asset)}
                    >
                      {busyAssetId === asset.id
                        ? 'Applying…'
                        : asset.legalHoldAt
                          ? 'Release hold'
                          : 'Place hold'}
                    </button>
                  )}
                </div>
              ))}
            </td>
            <td>{formatDate(order.createdAt)}</td>
          </>
        )}
      />
    </>
  );
}
export function FinancePage() {
  const result = useAsync(() => api.operation<Wallet[]>('business-as-a-service', 'finance'), []);
  return (
    <DataPage
      title="Finance"
      description="Wallet exposure across BAS tenants. Adjustments require a separate critical-risk capability."
      result={result}
      headers={['Business', 'Environment', 'Status', 'Balance', 'Reserved', 'Updated']}
      row={(wallet) => (
        <>
          <td>
            <strong>{wallet.business.name}</strong>
            <small>{wallet.business.email}</small>
          </td>
          <td>{wallet.environment}</td>
          <td>
            <StatusBadge value={wallet.status} />
          </td>
          <td>{formatMoney(Number(wallet.currentBalance), wallet.currency)}</td>
          <td>{formatMoney(Number(wallet.reservedBalance), wallet.currency)}</td>
          <td>{formatDate(wallet.updatedAt)}</td>
        </>
      )}
    />
  );
}

export function PricingPage() {
  const auth = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [selectedBusiness, setSelectedBusiness] = useState<Business>();
  const businesses = useAsync(
    () =>
      api.operation<Business[]>(
        'business-as-a-service',
        'businesses',
        businessesQuery(debouncedSearch),
      ),
    [debouncedSearch],
  );
  const result = useAsync(
    () => api.operation<PricingVersion[]>('business-as-a-service', 'pricing'),
    [],
  );
  const [editing, setEditing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [versionChange, setVersionChange] = useState<{
    version: PricingVersion;
    operation: 'activate' | 'rollback';
  }>();
  const [error, setError] = useState('');
  const businessId = searchParams.get('businessId') ?? '';
  const business =
    selectedBusiness?.id === businessId
      ? selectedBusiness
      : businesses.data?.find(({ id }) => id === businessId);
  const businessOptions = [
    ...(business && !businesses.data?.some(({ id }) => id === business.id) ? [business] : []),
    ...(businesses.data ?? []),
  ];
  return (
    <Page
      eyebrow="Business as a Service"
      title="Pricing"
      description="Inspect the platform price book and create audited business-specific rules."
      action={
        auth.can('bas.pricing.manage') ? (
          <div className="button-row">
            <button
              className="button secondary"
              disabled={exporting}
              onClick={() => {
                setExporting(true);
                setError('');
                void api
                  .operation<PricingWorkbookExport>('business-as-a-service', 'pricing-export')
                  .then((exported) => downloadBase64Workbook(exported))
                  .catch((cause) =>
                    setError(cause instanceof Error ? cause.message : 'Pricing export failed'),
                  )
                  .finally(() => setExporting(false));
              }}
            >
              {exporting ? 'Preparing…' : 'Download active price book'}
            </button>
            <button className="button secondary" onClick={() => setImporting(true)}>
              Import price book
            </button>
            <button
              className="button primary"
              disabled={!businessId}
              onClick={() => setEditing(true)}
            >
              Add pricing rule
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="filter-bar">
        <label>
          Search businesses
          <input
            aria-label="Search businesses"
            placeholder="Name, email, phone, or RC number"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label>
          Business account
          <select
            value={businessId}
            onChange={(event) => {
              const next = new URLSearchParams(searchParams);
              const nextId = event.target.value;
              if (nextId) {
                next.set('businessId', nextId);
                setSelectedBusiness(
                  businessOptions.find(({ id }) => id === nextId) ?? selectedBusiness,
                );
              } else {
                next.delete('businessId');
                setSelectedBusiness(undefined);
              }
              setSearchParams(next);
            }}
          >
            <option value="">All businesses</option>
            {businessOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        {business && <span className="filter-summary">Viewing rules for {business.name}</span>}
      </div>
      {error && <div className="form-error">{error}</div>}
      {result.loading || businesses.loading ? (
        <LoadingState />
      ) : result.error || businesses.error ? (
        <ErrorState error={result.error ?? businesses.error!} retry={result.reload} />
      ) : !result.data?.length ? (
        <EmptyState
          title="No pricing versions"
          description="Select a business and add a rule, or configure a platform price book."
        />
      ) : (
        <div className="table-panel">
          <table aria-label="Pricing records">
            <thead>
              <tr>
                {['Scope', 'Profile', 'Version', 'Status', 'Minimum', 'Activated', 'Actions'].map(
                  (header) => (
                    <th key={header}>{header}</th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {result.data
                .filter(
                  (item) =>
                    !businessId || item.profile?.business.id === businessId || !item.profile,
                )
                .map((item) => (
                  <tr key={item.id}>
                    <td>{item.scope}</td>
                    <td>
                      {item.profile
                        ? `${item.profile.business.name} · ${item.profile.name}`
                        : 'Platform default'}
                    </td>
                    <td>{item.recordType === 'OVERRIDE' ? 'Override' : `v${item.version}`}</td>
                    <td>
                      <StatusBadge value={item.status} />
                    </td>
                    <td>
                      {item.minimumDeliveryPrice
                        ? formatMoney(Number(item.minimumDeliveryPrice), item.currency)
                        : item.perKmRate
                          ? `${formatMoney(Number(item.perKmRate), item.currency)} / km`
                          : '—'}
                    </td>
                    <td>{item.activatedAt ? formatDate(item.activatedAt) : 'Not active'}</td>
                    <td>
                      {auth.can('bas.pricing.manage') &&
                      item.recordType !== 'OVERRIDE' &&
                      item.status === 'DRAFT' ? (
                        <button
                          className="button secondary small"
                          onClick={() => setVersionChange({ version: item, operation: 'activate' })}
                        >
                          Activate
                        </button>
                      ) : auth.can('bas.pricing.manage') &&
                        item.recordType !== 'OVERRIDE' &&
                        item.status === 'RETIRED' ? (
                        <button
                          className="button secondary small"
                          onClick={() => setVersionChange({ version: item, operation: 'rollback' })}
                        >
                          Roll back
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && business && (
        <PricingRuleDialog
          business={business}
          close={() => setEditing(false)}
          completed={async () => {
            setEditing(false);
            setError('');
            await result.reload();
          }}
          failed={setError}
        />
      )}
      {importing && (
        <PricingImportDialog
          close={() => setImporting(false)}
          completed={async () => {
            setImporting(false);
            setError('');
            await result.reload();
          }}
          failed={setError}
        />
      )}
      {versionChange && (
        <PricingVersionDialog
          version={versionChange.version}
          operation={versionChange.operation}
          close={() => setVersionChange(undefined)}
          completed={async () => {
            setVersionChange(undefined);
            setError('');
            await result.reload();
          }}
          failed={setError}
        />
      )}
    </Page>
  );
}

function downloadBase64Workbook(exported: PricingWorkbookExport) {
  const binary = window.atob(exported.fileBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = exported.filename;
  link.click();
  URL.revokeObjectURL(url);
}

function fileBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the workbook'));
    reader.onload = () => resolve(String(reader.result).split(',', 2)[1] ?? '');
    reader.readAsDataURL(file);
  });
}

function PricingImportDialog({
  close,
  completed,
  failed,
}: {
  close(): void;
  completed(): Promise<void>;
  failed(message: string): void;
}) {
  const [file, setFile] = useState<File>();
  const [report, setReport] = useState<PricingWorkbookReport>();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const preview = async () => {
    if (!file) return;
    setBusy(true);
    try {
      setReport(
        await api.mutate<PricingWorkbookReport>(
          'business-as-a-service',
          'pricing-import-preview',
          'Validate pricing workbook before import',
          { fileBase64: await fileBase64(file) },
        ),
      );
    } catch (cause) {
      failed(cause instanceof Error ? cause.message : 'Workbook validation failed');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-backdrop">
      <form
        className="modal modal--wide"
        role="dialog"
        aria-modal="true"
        aria-label="Import platform price book"
        onSubmit={(event) => {
          event.preventDefault();
          if (!file || !report?.valid) return;
          setBusy(true);
          void fileBase64(file)
            .then((fileBase64Value) =>
              api.mutate('business-as-a-service', 'pricing-import', reason, {
                fileBase64: fileBase64Value,
              }),
            )
            .then(completed)
            .catch((cause) => failed(cause instanceof Error ? cause.message : 'Import failed'))
            .finally(() => setBusy(false));
        }}
      >
        <header>
          <div>
            <p className="eyebrow">Platform pricing</p>
            <h2>Import XLSX price book</h2>
          </div>
          <button type="button" className="icon-control" onClick={close}>
            ×
          </button>
        </header>
        <label>
          Workbook
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
            onChange={(event) => {
              setFile(event.target.files?.[0]);
              setReport(undefined);
            }}
          />
        </label>
        <button
          type="button"
          className="button secondary"
          disabled={!file || busy}
          onClick={() => void preview()}
        >
          {busy ? 'Checking…' : 'Validate workbook'}
        </button>
        {report && (
          <div className={report.valid ? 'state-card' : 'state-card state-card--error'}>
            <strong>
              {report.valid ? 'Workbook is ready for draft import' : 'Workbook cannot be imported'}
            </strong>
            <span>
              {report.summary.stateCount} states · {report.summary.enabledRateCount} enabled rates ·{' '}
              {report.summary.discountTierCount} tiers · {report.summary.ignoredDisabledRateCount}{' '}
              disabled rates ignored
              {report.summary.interstateRouteCount
                ? ` · ${report.summary.interstateRouteCount} interstate routes · ${report.summary.interstateWeightBandCount} weight bands`
                : ''}
            </span>
            {report.issues.slice(0, 20).map((issue, index) => (
              <span key={`${issue.code}-${issue.row ?? index}`}>
                {issue.severity}: {issue.sheet}
                {issue.row ? ` row ${issue.row}` : ''} — {issue.message}
              </span>
            ))}
            {report.issues.length > 20 && (
              <span>{report.issues.length - 20} more issues omitted.</span>
            )}
          </div>
        )}
        <label>
          Business reason
          <textarea
            minLength={8}
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <p className="risk-note">
          Import creates an immutable draft. It does not affect quotes until separately activated.
        </p>
        <footer>
          <button type="button" className="button secondary" onClick={close}>
            Cancel
          </button>
          <button
            className="button danger"
            disabled={busy || !report?.valid || reason.trim().length < 8}
          >
            {busy ? 'Importing…' : 'Import draft'}
          </button>
        </footer>
      </form>
    </div>
  );
}

function PricingVersionDialog({
  version,
  operation,
  close,
  completed,
  failed,
}: {
  version: PricingVersion;
  operation: 'activate' | 'rollback';
  close(): void;
  completed(): Promise<void>;
  failed(message: string): void;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="modal-backdrop">
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${operation} pricing version`}
        onSubmit={(event) => {
          event.preventDefault();
          setBusy(true);
          void api
            .mutate('business-as-a-service', `pricing-version-${operation}`, reason, {
              versionId: version.id,
            })
            .then(completed)
            .catch((cause) =>
              failed(cause instanceof Error ? cause.message : `Pricing ${operation} failed`),
            )
            .finally(() => setBusy(false));
        }}
      >
        <header>
          <div>
            <p className="eyebrow">Platform pricing</p>
            <h2>
              {operation === 'activate' ? 'Activate' : 'Roll back to'} version {version.version}
            </h2>
          </div>
          <button type="button" className="icon-control" onClick={close}>
            ×
          </button>
        </header>
        <label>
          Business reason
          <textarea
            minLength={8}
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <p className="risk-note">
          This retires the currently active platform version. Existing quotes and orders retain
          their original snapshots.
        </p>
        <footer>
          <button type="button" className="button secondary" onClick={close}>
            Cancel
          </button>
          <button className="button danger" disabled={busy || reason.trim().length < 8}>
            {busy
              ? 'Applying…'
              : operation === 'activate'
                ? 'Activate version'
                : 'Confirm rollback'}
          </button>
        </footer>
      </form>
    </div>
  );
}

function PricingRuleDialog({
  business,
  close,
  completed,
  failed,
}: {
  business: Business;
  close(): void;
  completed(): Promise<void>;
  failed(message: string): void;
}) {
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  return (
    <div className="modal-backdrop">
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Add business pricing rule"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setBusy(true);
          void api
            .mutate('business-as-a-service', 'pricing-override', reason, {
              businessId: business.id,
              state: String(data.get('state') || '') || undefined,
              mobilityMethod: String(data.get('mobilityMethod') || '') || undefined,
              perKmRate: data.get('perKmRate') ? Number(data.get('perKmRate')) : undefined,
              minimumDeliveryPrice: data.get('minimumDeliveryPrice')
                ? Number(data.get('minimumDeliveryPrice'))
                : undefined,
              cappedPrice: data.get('cappedPrice') ? Number(data.get('cappedPrice')) : undefined,
            })
            .then(completed)
            .catch((cause) =>
              failed(cause instanceof Error ? cause.message : 'Pricing update failed'),
            )
            .finally(() => setBusy(false));
        }}
      >
        <header>
          <div>
            <p className="eyebrow">Business override</p>
            <h2>{business.name}</h2>
          </div>
          <button type="button" className="icon-control" onClick={close}>
            ×
          </button>
        </header>
        <label>
          State (optional)
          <input name="state" placeholder="Oyo" />
        </label>
        <label>
          Mobility method (optional)
          <select name="mobilityMethod">
            <option value="">All methods</option>
            <option value="bicycle">Bicycle</option>
            <option value="motorcycle">Motorcycle</option>
            <option value="tricycle">Tricycle</option>
            <option value="car">Car</option>
            <option value="van">Van</option>
            <option value="truck">Truck</option>
            <option value="large_truck">Large truck</option>
          </select>
        </label>
        <label>
          Per-kilometre rate
          <input name="perKmRate" type="number" min="0" step="0.001" />
        </label>
        <label>
          Minimum delivery price
          <input name="minimumDeliveryPrice" type="number" min="0" step="0.01" required />
        </label>
        <label>
          Capped price (optional)
          <input name="cappedPrice" type="number" min="0" step="0.01" />
        </label>
        <label>
          Business reason
          <textarea
            minLength={8}
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <p className="risk-note">
          This creates a new active override; existing quotes and pricing history remain unchanged.
        </p>
        <footer>
          <button type="button" className="button secondary" onClick={close}>
            Cancel
          </button>
          <button className="button danger" disabled={busy || reason.trim().length < 8}>
            {busy ? 'Saving…' : 'Create rule'}
          </button>
        </footer>
      </form>
    </div>
  );
}

export function TransactionsPage() {
  const result = useAsync(
    () => api.operation<Transaction[]>('business-as-a-service', 'transactions'),
    [],
  );
  return (
    <DataPage
      title="Transactions"
      description="Read-only financial movement history with destination correlation references."
      result={result}
      headers={['Business', 'Environment', 'Type', 'Category', 'Status', 'Amount', 'Created']}
      row={(item) => (
        <>
          <td>{item.business.name}</td>
          <td><StatusBadge value={item.environment} /></td>
          <td>{item.type}</td>
          <td>{item.category}</td>
          <td>
            <StatusBadge value={item.status} />
          </td>
          <td>{formatMoney(Number(item.amount), item.currency)}</td>
          <td>{formatDate(item.createdAt)}</td>
        </>
      )}
    />
  );
}

export function InvoicesPage() {
  const result = useAsync(() => api.operation<Invoice[]>('business-as-a-service', 'invoices'), []);
  return (
    <DataPage
      title="Invoices"
      description="Billing exposure and due-date status across BAS tenants."
      result={result}
      headers={['Business', 'Environment', 'Cycle', 'Status', 'Subtotal', 'Paid', 'Due']}
      row={(item) => (
        <>
          <td>{item.business.name}</td>
          <td><StatusBadge value={item.environment} /></td>
          <td>{item.billingCycle}</td>
          <td>
            <StatusBadge value={item.status} />
          </td>
          <td>{formatMoney(Number(item.subtotal), item.currency)}</td>
          <td>{formatMoney(Number(item.paidAmount), item.currency)}</td>
          <td>{formatDate(item.dueAt)}</td>
        </>
      )}
    />
  );
}

export function IntegrationsPage() {
  const auth = useAuth();
  const keys = useAsync(
    () => api.operation<ApiKeyRecord[]>('business-as-a-service', 'api-keys'),
    [],
  );
  const webhooks = useAsync(
    () => api.operation<WebhookDelivery[]>('business-as-a-service', 'webhooks'),
    [],
  );
  const endpoints = useAsync(
    () => api.operation<WebhookEndpoint[]>('business-as-a-service', 'webhook-endpoints'),
    [],
  );
  const [selected, setSelected] = useState<WebhookDelivery>();
  const [credentialAction, setCredentialAction] = useState<{
    operation: 'api-keys-revoke' | 'webhooks-disable';
    id: string;
    title: string;
    description: string;
  }>();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const replay = async () => {
    if (!selected) return;
    try {
      await api.mutate('business-as-a-service', 'webhooks-replay', reason, {
        deliveryId: selected.id,
      });
      setSelected(undefined);
      setReason('');
      await webhooks.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Replay failed');
    }
  };
  const applyCredentialAction = async () => {
    if (!credentialAction) return;
    try {
      await api.mutate('business-as-a-service', credentialAction.operation, reason, {
        [credentialAction.operation === 'api-keys-revoke' ? 'apiKeyId' : 'endpointId']:
          credentialAction.id,
      });
      setCredentialAction(undefined);
      setReason('');
      await Promise.all([keys.reload(), endpoints.reload(), webhooks.reload()]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Credential action failed');
    }
  };
  return (
    <Page
      eyebrow="Business as a Service"
      title="API keys and webhooks"
      description="Credential lifecycle metadata and webhook delivery support. Secret material is never returned."
    >
      <h2>API keys</h2>
      {keys.loading ? (
        <LoadingState />
      ) : keys.error ? (
        <ErrorState error={keys.error} retry={keys.reload} />
      ) : (
        <div className="table-panel">
          <table>
            <thead>
              <tr>
                <th>Business</th>
                <th>Key</th>
                <th>Environment</th>
                <th>Status</th>
                <th>Last used</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {keys.data?.map((item) => (
                <tr key={item.id}>
                  <td>{item.business.name}</td>
                  <td>
                    <code>{item.publicKey}</code>
                  </td>
                  <td>{item.environment}</td>
                  <td>
                    <StatusBadge value={item.status} />
                  </td>
                  <td>{item.lastUsedAt ? formatDate(item.lastUsedAt) : 'Never'}</td>
                  <td>
                    {item.status === 'ACTIVE' && auth.can('bas.api-keys.revoke') && (
                      <button
                        className="text-link danger-link"
                        onClick={() => {
                          setError('');
                          setReason('');
                          setCredentialAction({
                            operation: 'api-keys-revoke',
                            id: item.id,
                            title: 'Revoke API key',
                            description: `Immediately revoke ${item.publicKey} for ${item.business.name}.`,
                          });
                        }}
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h2 className="section-title">Webhook endpoints</h2>
      {endpoints.loading ? (
        <LoadingState />
      ) : endpoints.error ? (
        <ErrorState error={endpoints.error} retry={endpoints.reload} />
      ) : !endpoints.data?.length ? (
        <EmptyState
          title="No webhook endpoints"
          description="No endpoints exist in the selected environment."
        />
      ) : (
        <div className="table-panel">
          <table aria-label="Webhook endpoints">
            <thead>
              <tr>
                <th>Business</th>
                <th>Endpoint</th>
                <th>Environment</th>
                <th>Status</th>
                <th>Events</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {endpoints.data.map((item) => (
                <tr key={item.id}>
                  <td>{item.business.name}</td>
                  <td>
                    <code>{new URL(item.url).host}</code>
                  </td>
                  <td>{item.environment}</td>
                  <td>
                    <StatusBadge value={item.enabled ? 'ACTIVE' : 'DISABLED'} />
                  </td>
                  <td>{Array.isArray(item.eventTypes) ? item.eventTypes.length : 0}</td>
                  <td>
                    {item.enabled && auth.can('bas.webhooks.manage') && (
                      <button
                        className="text-link danger-link"
                        onClick={() => {
                          setError('');
                          setReason('');
                          setCredentialAction({
                            operation: 'webhooks-disable',
                            id: item.id,
                            title: 'Disable webhook endpoint',
                            description: `Stop deliveries to ${new URL(item.url).host} for ${item.business.name}.`,
                          });
                        }}
                      >
                        Disable
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h2 className="section-title">Webhook deliveries</h2>
      {webhooks.loading ? (
        <LoadingState />
      ) : webhooks.error ? (
        <ErrorState error={webhooks.error} retry={webhooks.reload} />
      ) : (
        <div className="table-panel">
          <table>
            <thead>
              <tr>
                <th>Business</th>
                <th>Endpoint</th>
                <th>Status</th>
                <th>Environment</th>
                <th>Attempts</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {webhooks.data?.map((item) => (
                <tr key={item.id}>
                  <td>{item.endpoint.business.name}</td>
                  <td>
                    <code>{new URL(item.endpoint.url).host}</code>
                  </td>
                  <td>
                    <StatusBadge value={item.status} />
                  </td>
                  <td>{item.endpoint.environment}</td>
                  <td>{item.attempts}</td>
                  <td>{formatDate(item.createdAt)}</td>
                  <td>
                    <div className="inline-actions">
                      {['COMPLETED', 'DEAD'].includes(item.status) &&
                        auth.can('bas.webhooks.replay') && (
                          <button className="text-link" onClick={() => setSelected(item)}>
                            Replay
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selected && (
        <div className="modal-backdrop">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Replay webhook delivery"
          >
            <header>
              <div>
                <p className="eyebrow">High-risk support action</p>
                <h2>Replay webhook delivery</h2>
              </div>
              <button className="icon-control" onClick={() => setSelected(undefined)}>
                ×
              </button>
            </header>
            {error && <div className="form-error">{error}</div>}
            <p>
              This requeues delivery <code>{selected.id}</code> for{' '}
              {selected.endpoint.business.name}. Recent MFA verification is required.
            </p>
            <label>
              Business reason
              <textarea
                minLength={8}
                required
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <footer>
              <button
                className="button danger"
                disabled={reason.trim().length < 8}
                onClick={() => void replay()}
              >
                Confirm replay
              </button>
            </footer>
          </div>
        </div>
      )}
      {credentialAction && (
        <div className="modal-backdrop">
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={credentialAction.title}
          >
            <header>
              <div>
                <p className="eyebrow">Credential lifecycle</p>
                <h2>{credentialAction.title}</h2>
              </div>
              <button className="icon-control" onClick={() => setCredentialAction(undefined)}>
                ×
              </button>
            </header>
            {error && <div className="form-error">{error}</div>}
            <p>{credentialAction.description}</p>
            <label>
              Business reason
              <textarea
                minLength={8}
                required
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
            <p className="risk-note">
              This action is scoped to the environment selected in the header and is written to both
              audit trails.
            </p>
            <footer>
              <button className="button secondary" onClick={() => setCredentialAction(undefined)}>
                Cancel
              </button>
              <button
                className="button danger"
                disabled={reason.trim().length < 8}
                onClick={() => void applyCredentialAction()}
              >
                Confirm
              </button>
            </footer>
          </div>
        </div>
      )}
    </Page>
  );
}

export function PlatformAuditPage() {
  const result = useAsync(
    () => api.operation<PlatformAudit[]>('business-as-a-service', 'audit'),
    [],
  );
  return (
    <DataPage
      title="Platform audit"
      description="BAS-owned audit evidence correlated with control-plane request identifiers."
      result={result}
      headers={['Action', 'Entity', 'Entity ID', 'Request ID', 'Occurred']}
      row={(item) => (
        <>
          <td>
            <strong>{item.action}</strong>
          </td>
          <td>{item.entity}</td>
          <td>
            <code>{item.entityId?.slice(0, 12) ?? '—'}</code>
          </td>
          <td>
            <code>{item.requestId?.slice(0, 12) ?? '—'}</code>
          </td>
          <td>{formatDate(item.createdAt)}</td>
        </>
      )}
    />
  );
}

function DataPage<T extends { id: string }>({
  title,
  description,
  result,
  headers,
  row,
}: {
  title: string;
  description: string;
  result: ReturnType<typeof useAsync<T[]>>;
  headers: string[];
  row(value: T): React.ReactNode;
}) {
  return (
    <Page eyebrow="Business as a Service" title={title} description={description}>
      {result.loading ? (
        <LoadingState />
      ) : result.error ? (
        <ErrorState error={result.error} retry={result.reload} />
      ) : !result.data?.length ? (
        <EmptyState title={`No ${title.toLowerCase()}`} description="No records match this view." />
      ) : (
        <div className="table-panel">
          <table aria-label={`${title} records`}>
            <thead>
              <tr>
                {headers.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.data.map((value) => (
                <tr key={value.id}>{row(value)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}
