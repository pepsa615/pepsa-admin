import { Link } from 'react-router-dom';
import { api, type BasOverview } from '../core/api.js';
import { formatMoney } from '../core/format.js';
import { useAsync } from '../core/useAsync.js';
import { ErrorState, LoadingState, StatusBadge } from '../components/States.js';
import { Page } from '../components/Page.js';
import { useAuth } from '../app/AuthContext.js';

export function OverviewPage() {
  const auth = useAuth();
  const canReadBas = auth.can('bas.dashboard.read');
  const overview = useAsync(
    () =>
      canReadBas
        ? api.operation<BasOverview>('business-as-a-service', 'overview')
        : Promise.resolve(undefined),
    [canReadBas],
  );
  if (!canReadBas)
    return (
      <Page
        eyebrow="Control plane"
        title="Your administration workspace"
        description="You have global administration access but no BAS operational dashboard assignment."
      >
        <div className="state-card">
          <strong>No platform operations assigned</strong>
          <span>An access manager can grant an explicit platform membership and role.</span>
        </div>
      </Page>
    );
  if (overview.loading) return <LoadingState label="Loading control-plane overview" />;
  if (overview.error || !overview.data)
    return (
      <ErrorState error={overview.error ?? new Error('No data returned')} retry={overview.reload} />
    );
  const data = overview.data;
  return (
    <Page
      eyebrow="Control plane"
      title="Good operational visibility starts here."
      description="Live posture across your assigned Pepsa platforms."
    >
      <div className="metric-grid">
        <article className="metric">
          <span>Connected platforms</span>
          <strong>1</strong>
          <small>
            <StatusBadge value="available" /> All systems operational
          </small>
        </article>
        <article className="metric">
          <span>Businesses</span>
          <strong>{data.businesses.total}</strong>
          <small>{data.businesses.pendingReview} awaiting review</small>
        </article>
        <article className="metric">
          <span>Active orders</span>
          <strong>{data.orders.active}</strong>
          <small>{data.orders.exceptions} exceptions need attention</small>
        </article>
        <article className="metric">
          <span>Wallet funds</span>
          <strong>{formatMoney(data.finance.walletBalance, data.finance.currency)}</strong>
          <small>{formatMoney(data.finance.reservedBalance, data.finance.currency)} reserved</small>
        </article>
      </div>
      <div className="content-grid">
        <section className="panel panel--wide">
          <header className="panel-heading">
            <div>
              <p className="eyebrow">Business as a Service</p>
              <h2>Operational focus</h2>
            </div>
            <Link className="text-link" to="/p/business-as-a-service/overview">
              Open platform →
            </Link>
          </header>
          <div className="attention-list">
            <Link to="/p/business-as-a-service/businesses">
              <span className="attention-icon warning">!</span>
              <div>
                <strong>Business reviews</strong>
                <small>
                  {data.businesses.pendingReview} applications require an operator decision
                </small>
              </div>
              <b>{data.businesses.pendingReview}</b>
            </Link>
            <Link to="/p/business-as-a-service/orders">
              <span className="attention-icon danger">×</span>
              <div>
                <strong>Order exceptions</strong>
                <small>Failed orders across all BAS tenants</small>
              </div>
              <b>{data.orders.exceptions}</b>
            </Link>
          </div>
        </section>
        <aside className="panel">
          <p className="eyebrow">Security posture</p>
          <h2>Protected</h2>
          <ul className="check-list">
            <li>Mandatory MFA enabled</li>
            <li>Scoped access enforced</li>
            <li>Audit integrity chain active</li>
            <li>Signed platform context</li>
          </ul>
        </aside>
      </div>
    </Page>
  );
}
