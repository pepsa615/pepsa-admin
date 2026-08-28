import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../app/AuthContext.js';
import { NotificationsMenu } from './NotificationsMenu.js';
import { api, setPlatformEnvironment } from '../core/api.js';
import { useAsync } from '../core/useAsync.js';
import { useEffect, useState } from 'react';

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
  const [environment, setEnvironment] = useState('production');
  useEffect(() => {
    if (selectedPlatform && !selectedPlatform.environments.some(({ key }) => key === environment)) {
      const fallback = selectedPlatform.environments[0]?.key;
      if (fallback) {
        setEnvironment(fallback);
        setPlatformEnvironment(fallback);
      }
    }
  }, [selectedPlatform, environment]);
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
          {selectedPlatform?.key === 'business-as-a-service' &&
            platformNavigation
              .filter(
                ([, , permission, operation]) =>
                  auth.can(permission) && supportedOperations.has(operation),
              )
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
            {selectedPlatform ? (
              <select
                className="environment"
                value={environment}
                onChange={(event) => {
                  setEnvironment(event.target.value);
                  setPlatformEnvironment(event.target.value);
                }}
                aria-label="Platform environment"
              >
                {selectedPlatform.environments.map((item) => (
                  <option key={item.id} value={item.key}>
                    {item.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="environment">Control plane</span>
            )}
            <NotificationsMenu />
          </div>
        </header>
        <Outlet key={`${selectedPlatform?.key ?? 'global'}:${environment}`} />
      </main>
    </div>
  );
}
