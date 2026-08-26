import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/AppShell.js';
import { LoadingState, PermissionDeniedState } from '../components/States.js';
import type { ReactNode } from 'react';
import { AdministratorsPage } from '../pages/AdministratorsPage.js';
import { AuditPage } from '../pages/AuditPage.js';
import {
  BasOverviewPage,
  BusinessesPage,
  FinancePage,
  IntegrationsPage,
  InvoicesPage,
  OrdersPage,
  PlatformAuditPage,
  PricingPage,
  TransactionsPage,
} from '../pages/BasPages.js';
import { LoginPage } from '../pages/LoginPage.js';
import { OperationsPage } from '../pages/OperationsPage.js';
import { OverviewPage } from '../pages/OverviewPage.js';
import { PlatformsPage } from '../pages/PlatformsPage.js';
import { RolesPage } from '../pages/RolesPage.js';
import { AccessReviewsPage, ApprovalsPage, EmergencyAccessPage } from '../pages/GovernancePages.js';
import { ProfilePage } from '../pages/ProfilePage.js';
import { AuthProvider, useAuth } from './AuthContext.js';

function ProtectedRoutes() {
  const auth = useAuth();
  if (auth.loading)
    return (
      <div className="bootstrap">
        <LoadingState label="Securing your session" />
      </div>
    );
  if (!auth.session) return <Navigate to="/login" replace />;
  return <AppShell />;
}

function PermissionRoute({ permission, children }: { permission: string; children: ReactNode }) {
  const auth = useAuth();
  return auth.can(permission) ? children : <PermissionDeniedState />;
}

export function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoutes />}>
          <Route index element={<Navigate to="/overview" replace />} />
          <Route path="overview" element={<OverviewPage />} />
          <Route
            path="platforms"
            element={
              <PermissionRoute permission="admin.platforms.read">
                <PlatformsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="administrators"
            element={
              <PermissionRoute permission="admin.users.read">
                <AdministratorsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="roles"
            element={
              <PermissionRoute permission="admin.roles.read">
                <RolesPage />
              </PermissionRoute>
            }
          />
          <Route
            path="audit"
            element={
              <PermissionRoute permission="admin.audit.read">
                <AuditPage />
              </PermissionRoute>
            }
          />
          <Route
            path="operations"
            element={
              <PermissionRoute permission="admin.operations.read">
                <OperationsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="approvals"
            element={
              <PermissionRoute permission="admin.approvals.read">
                <ApprovalsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="access-reviews"
            element={
              <PermissionRoute permission="admin.reviews.read">
                <AccessReviewsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="emergency-access"
            element={
              <PermissionRoute permission="admin.emergency.request">
                <EmergencyAccessPage />
              </PermissionRoute>
            }
          />
          <Route path="profile" element={<ProfilePage />} />
          <Route
            path="p/business-as-a-service/overview"
            element={
              <PermissionRoute permission="bas.dashboard.read">
                <BasOverviewPage />
              </PermissionRoute>
            }
          />
          <Route
            path="p/business-as-a-service/businesses"
            element={
              <PermissionRoute permission="bas.businesses.read">
                <BusinessesPage />
              </PermissionRoute>
            }
          />
          <Route
            path="p/business-as-a-service/orders"
            element={
              <PermissionRoute permission="bas.orders.read">
                <OrdersPage />
              </PermissionRoute>
            }
          />
          <Route
            path="p/business-as-a-service/finance"
            element={
              <PermissionRoute permission="bas.finance.read">
                <FinancePage />
              </PermissionRoute>
            }
          />
          <Route
            path="p/business-as-a-service/pricing"
            element={
              <PermissionRoute permission="bas.pricing.read">
                <PricingPage />
              </PermissionRoute>
            }
          />
          <Route
            path="p/business-as-a-service/transactions"
            element={
              <PermissionRoute permission="bas.transactions.read">
                <TransactionsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="p/business-as-a-service/invoices"
            element={
              <PermissionRoute permission="bas.invoices.read">
                <InvoicesPage />
              </PermissionRoute>
            }
          />
          <Route
            path="p/business-as-a-service/integrations"
            element={
              <PermissionRoute permission="bas.webhooks.read">
                <IntegrationsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="p/business-as-a-service/audit"
            element={
              <PermissionRoute permission="bas.audit.read">
                <PlatformAuditPage />
              </PermissionRoute>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Routes>
    </AuthProvider>
  );
}
