import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../app/AuthContext.js';
import { NotificationsMenu } from './NotificationsMenu.js';
import { api } from '../core/api.js';
import { useAsync } from '../core/useAsync.js';

const globalNavigation = [
  ['/overview', 'Overview', '⌂', ''],
  ['/platforms', 'Platforms', '◇', 'admin.platforms.read'],
  ['/administrators', 'Administrators', '♙', 'admin.users.read'],
  ['/roles', 'Access control', '⌘', 'admin.roles.read'],
  ['/audit', 'Audit trail', '≡', 'admin.audit.read'],
  ['/operations', 'Operations', '↗', 'admin.operations.read'],
  ['/approvals', 'Approvals', '✓', 'admin.approvals.read'],
  ['/access-reviews', 'Access reviews', '◎', 'admin.reviews.read'],
  ['/emergency-access', 'Emergency access', '!', 'admin.emergency.request'],
] as const;
const platformNavigation = [
  ['/p/business-as-a-service/overview', 'BAS overview', 'bas.dashboard.read', 'overview'],
  ['/p/business-as-a-service/businesses', 'Businesses', 'bas.businesses.read', 'businesses'],
  ['/p/business-as-a-service/orders', 'Orders', 'bas.orders.read', 'orders'],
  ['/p/business-as-a-service/finance', 'Finance', 'bas.finance.read', 'finance'],
  ['/p/business-as-a-service/pricing', 'Pricing', 'bas.pricing.read', 'pricing'],
  [
    '/p/business-as-a-service/transactions',
    'Transactions',
    'bas.transactions.read',
    'transactions',
  ],
  ['/p/business-as-a-service/invoices', 'Invoices', 'bas.invoices.read', 'invoices'],
  ['/p/business-as-a-service/integrations', 'API & webhooks', 'bas.webhooks.read', 'webhooks'],
  ['/p/business-as-a-service/audit', 'Platform audit', 'bas.audit.read', 'audit'],
] as const;
const orderNavigation = [
  ['/p/pepsa-order/overview', 'Order overview', 'order.fleet.read', 'fleet-health'],
  ['/p/pepsa-order/partners', 'Partners', 'order.partners.read', 'partners-list'],
  ['/p/pepsa-order/fleet', 'Fleet', 'order.fleet.read', 'fleet-riders'],
  ['/p/pepsa-order/processing', 'Processing', 'order.processing.read', 'processing-pool'],
  ['/p/pepsa-order/dispatch', 'Dispatch', 'order.dispatch.read', 'dispatch-tasks'],
  ['/p/pepsa-order/policies', 'Policies', 'order.operations.policies.read', 'policies-active'],
  ['/p/pepsa-order/events', 'Events', 'order.events.read', 'events-list'],
  ['/p/pepsa-order/integrations', 'Integrations', 'order.integrations.read', 'integrations-list'],
] as const;
const paymentNavigation = [
  [
    '/p/pepsa-payment/overview',
    'Payment overview',
    'payment.sva.provisioning.read',
    'sva-provisioning-list',
  ],
  ['/p/pepsa-payment/platforms', 'Payment platforms', 'payment.platforms.read', 'platforms-list'],
  ['/p/pepsa-payment/settings', 'Settings', 'payment.settings.transfer', 'transfer-settings-get'],
  [
    '/p/pepsa-payment/sva',
    'SVA provisioning',
    'payment.sva.provisioning.read',
    'sva-provisioning-list',
  ],
  [
    '/p/pepsa-payment/checkout',
    'Checkout / DVA',
    'payment.checkout.provisioning.read',
    'checkout-provisioning-list',
  ],
  [
    '/p/pepsa-payment/kyc',
    'KYC encryption',
    'payment.kyc.encryption.rotate',
    'kyc-rotate-encryption',
  ],
] as const;

export function AppShell() {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const platforms = useAsync(api.platforms, []);
  const platformKey = location.pathname.match(/^\/p\/([^/]+)/)?.[1] ?? platforms.data?.[0]?.key;
  const selectedPlatform = platforms.data?.find(({ key }) => key === platformKey);
  const capabilities = useAsync(
    () =>
      selectedPlatform
        ? api.platformCapabilities(selectedPlatform.key)
        : Promise.resolve({ version: '', operations: [] }),
    [selectedPlatform?.key],
  );
  const supportedOperations = new Set(capabilities.data?.operations.map(({ key }) => key) ?? []);
  const capabilitiesReady = Boolean(capabilities.data) && !capabilities.error;
  const navVisible = (permission: string, operation: string) => {
    if (!auth.can(permission)) return false;
    // Soft-filter by destination capabilities only when the catalogue loaded.
    // If the env is DISABLED or the adapter is unreachable, still show links so
    // operators can open pages / see enablement errors instead of an empty sidebar.
    if (!capabilitiesReady) return true;
    return supportedOperations.has(operation);
  };
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/pepsa-mark.svg" alt="" />
          <div>
            <strong>Pepsa Admin</strong>
            <span>Control plane</span>
          </div>
        </div>
        <nav aria-label="Primary navigation">
          <p className="nav-label">Global</p>
          {globalNavigation
            .filter(([, , , permission]) => !permission || auth.can(permission))
            .map(([to, label, icon]) => (
              <NavLink key={to} to={to}>
                <span aria-hidden="true">{icon}</span>
                {label}
              </NavLink>
            ))}
          {platforms.data?.length ? (
            <>
              <p className="nav-label">Assigned platform</p>
              <select
                className="platform-switcher"
                value={platformKey}
                onChange={(event) => navigate(`/p/${event.target.value}/overview`)}
              >
                {platforms.data.map((platform) => (
                  <option key={platform.id} value={platform.key}>
                    {platform.name}
                  </option>
                ))}
              </select>
            </>
          ) : null}
          {selectedPlatform && capabilities.error ? (
            <p className="nav-label" title={capabilities.error.message}>
              Platform API unavailable — check env ACTIVE + service URLs
            </p>
          ) : null}
          {selectedPlatform?.key === 'business-as-a-service' &&
            platformNavigation
              .filter(([, , permission, operation]) => navVisible(permission, operation))
              .map(([to, label]) => (
                <NavLink key={to} to={to}>
                  {label}
                </NavLink>
              ))}
          {selectedPlatform?.key === 'pepsa-order' &&
            orderNavigation
              .filter(([, , permission, operation]) => navVisible(permission, operation))
              .map(([to, label]) => (
                <NavLink key={to} to={to}>
                  {label}
                </NavLink>
              ))}
          {selectedPlatform?.key === 'pepsa-payment' &&
            paymentNavigation
              .filter(([, , permission, operation]) => navVisible(permission, operation))
              .map(([to, label]) => (
                <NavLink key={to} to={to}>
                  {label}
                </NavLink>
              ))}
        </nav>
        <div className="sidebar-user">
          <span className="avatar">{auth.session?.user.name.slice(0, 2).toUpperCase()}</span>
          <div>
            <strong>{auth.session?.user.name}</strong>
            <span>{auth.session?.user.email}</span>
          </div>
          <NavLink className="profile-link" to="/profile" title="Profile">
            ⚙
          </NavLink>
          <button title="Sign out" onClick={() => void auth.logout()}>
            ↪
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Pepsa</span>
            <b>/</b>
            <strong>
              {location.pathname.split('/').filter(Boolean).at(-1)?.replaceAll('-', ' ') ??
                'Overview'}
            </strong>
          </div>
          <div className="topbar-actions">
            <span
              className="environment"
              title="Staging vs production isolation is by deploy host, not an in-app switch"
            >
              {selectedPlatform ? selectedPlatform.name : 'Control plane'}
            </span>
            <NotificationsMenu />
          </div>
        </header>
        <Outlet key={selectedPlatform?.key ?? 'global'} />
      </main>
    </div>
  );
}
