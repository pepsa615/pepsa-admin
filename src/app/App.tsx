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
import {
  OrderDispatchPage,
  OrderEventsPage,
  OrderFleetPage,
  OrderIntegrationsPage,
  OrderOverviewPage,
  OrderPartnersPage,
  OrderPoliciesPage,
  OrderProcessingPage,
} from '../pages/OrderPages.js';
import {
  PaymentCheckoutPage,
  PaymentKycPage,
  PaymentPlatformsPage,
  PaymentSettingsPage,
  PaymentSvaPage,
} from '../pages/PaymentPages.js';
import {
  PaymentFinanceOverviewPage, PaymentLedgerPage, PaymentLeviesPage,
  PaymentProviderEventsPage, PaymentReconciliationPage, PaymentSettlementsPage,
  PaymentTransactionsPage,
} from '../pages/PaymentFinancePages.js';
import { LoginPage } from '../pages/LoginPage.js';
import { OperationsPage } from '../pages/OperationsPage.js';
import { OverviewPage } from '../pages/OverviewPage.js';
import { PlatformsPage } from '../pages/PlatformsPage.js';
import { RolesPage } from '../pages/RolesPage.js';
import { AccessReviewsPage, ApprovalsPage, EmergencyAccessPage } from '../pages/GovernancePages.js';
import { ProfilePage } from '../pages/ProfilePage.js';
import {
  VendorDetailPage,
  VendorDirectoryPage,
  VendorFeesPage,
  VendorOperationsPage,
  VendorOverviewPage,
  VendorPerformancePage,
  VendorProvisioningPage,
} from '../pages/VendorPages.js';
import { AuthProvider, useAuth } from './AuthContext.js';
import { RiderInsuranceClaimsPage, RiderWalletProvisioningPage } from '../pages/RiderPages.js';
import { RiderOnboardingDocumentsPage } from '../pages/RiderOnboardingDocumentsPage.js';

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
          <Route path="p/rider/overview" element={<Navigate to="/p/rider/wallet-provisioning" replace />} />
          <Route path="p/rider/wallet-provisioning" element={<PermissionRoute permission="rider.provisioning.read"><RiderWalletProvisioningPage /></PermissionRoute>} />
          <Route path="p/rider/insurance-claims" element={<PermissionRoute permission="rider.insurance.read"><RiderInsuranceClaimsPage /></PermissionRoute>} />
          <Route path="p/rider/onboarding-documents" element={<PermissionRoute permission="rider.onboarding.read"><RiderOnboardingDocumentsPage /></PermissionRoute>} />
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
          <Route
            path="p/pepsa-order/overview"
            element={
              <PermissionRoute permission="order.fleet.read">
                <OrderOverviewPage />
              </PermissionRoute>
            }
          />
          <Route
            path="p/pepsa-order/partners"
            element={
              <PermissionRoute permission="order.partners.read">
                <OrderPartnersPage />
              </PermissionRoute>
            }
          />
          <Route
            path="p/pepsa-order/fleet"
            element={
              <PermissionRoute permission="order.fleet.read">
                <OrderFleetPage />
              </PermissionRoute>
            }
          />
          <Route
            path="p/pepsa-order/processing"
            element={
              <PermissionRoute permission="order.processing.read">
                <OrderProcessingPage />
              </PermissionRoute>
            }
          />
          <Route
            path="p/pepsa-order/dispatch"
            element={
              <PermissionRoute permission="order.dispatch.read">
                <OrderDispatchPage />
              </PermissionRoute>
            }
          />
          <Route
            path="p/pepsa-order/policies"
            element={
              <PermissionRoute permission="order.operations.policies.read">
                <OrderPoliciesPage />
              </PermissionRoute>
            }
          />
          <Route
            path="p/pepsa-order/events"
            element={
              <PermissionRoute permission="order.events.read">
                <OrderEventsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="p/pepsa-order/integrations"
            element={
              <PermissionRoute permission="order.integrations.read">
                <OrderIntegrationsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="p/pepsa-payment/overview"
            element={
              <PermissionRoute permission="payment.finance.read">
                <PaymentFinanceOverviewPage />
              </PermissionRoute>
            }
          />
          <Route path="p/pepsa-payment/transactions" element={<PermissionRoute permission="payment.transactions.read"><PaymentTransactionsPage /></PermissionRoute>} />
          <Route path="p/pepsa-payment/ledger" element={<PermissionRoute permission="payment.ledger.read"><PaymentLedgerPage /></PermissionRoute>} />
          <Route path="p/pepsa-payment/levies" element={<PermissionRoute permission="payment.levies.read"><PaymentLeviesPage /></PermissionRoute>} />
          <Route path="p/pepsa-payment/reconciliation" element={<PermissionRoute permission="payment.reconciliation.read"><PaymentReconciliationPage /></PermissionRoute>} />
          <Route path="p/pepsa-payment/settlements" element={<PermissionRoute permission="payment.settlements.read"><PaymentSettlementsPage /></PermissionRoute>} />
          <Route path="p/pepsa-payment/provider-events" element={<PermissionRoute permission="payment.provider-events.read"><PaymentProviderEventsPage /></PermissionRoute>} />
          <Route
            path="p/pepsa-payment/platforms"
            element={
              <PermissionRoute permission="payment.platforms.read">
                <PaymentPlatformsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="p/pepsa-payment/settings"
            element={
              <PermissionRoute permission="payment.settings.transfer">
                <PaymentSettingsPage />
              </PermissionRoute>
            }
          />
          <Route
            path="p/pepsa-payment/sva"
            element={
              <PermissionRoute permission="payment.sva.provisioning.read">
                <PaymentSvaPage />
              </PermissionRoute>
            }
          />
          <Route
            path="p/pepsa-payment/checkout"
            element={
              <PermissionRoute permission="payment.checkout.provisioning.read">
                <PaymentCheckoutPage />
              </PermissionRoute>
            }
          />
          <Route
            path="p/pepsa-payment/kyc"
            element={
              <PermissionRoute permission="payment.kyc.encryption.rotate">
                <PaymentKycPage />
              </PermissionRoute>
            }
          />
          <Route
            path="p/vendor/overview"
            element={
              <PermissionRoute permission="vendor.dashboard.read">
                <VendorOverviewPage />
              </PermissionRoute>
            }
          />
          <Route
            path="p/vendor/vendors"
            element={
              <PermissionRoute permission="vendor.businesses.read">
                <VendorDirectoryPage />
              </PermissionRoute>
            }
          />
          <Route
            path="p/vendor/vendors/:vendorId"
            element={
              <PermissionRoute permission="vendor.businesses.read">
                <VendorDetailPage />
              </PermissionRoute>
            }
          />
          <Route
            path="p/vendor/reviews"
            element={
              <PermissionRoute permission="vendor.businesses.review">
                <VendorOperationsPage view="reviews" />
              </PermissionRoute>
            }
          />
          <Route
            path="p/vendor/dispatchers"
            element={
              <PermissionRoute permission="vendor.dispatchers.review">
                <VendorOperationsPage view="dispatchers" />
              </PermissionRoute>
            }
          />
          <Route
            path="p/vendor/operations"
            element={
              <PermissionRoute permission="vendor.operations.read">
                <VendorOperationsPage view="operations" />
              </PermissionRoute>
            }
          />
          <Route
            path="p/vendor/performance"
            element={
              <PermissionRoute permission="vendor.performance.read">
                <VendorPerformancePage />
              </PermissionRoute>
            }
          />
          <Route
            path="p/vendor/finance"
            element={
              <PermissionRoute permission="vendor.finance.read">
                <VendorOperationsPage view="finance" />
              </PermissionRoute>
            }
          />
          <Route
            path="p/vendor/provisioning"
            element={
              <PermissionRoute permission="vendor.integrations.payment.read">
                <VendorProvisioningPage />
              </PermissionRoute>
            }
          />
          <Route
            path="p/vendor/fees"
            element={
              <PermissionRoute permission="vendor.fees.read">
                <VendorFeesPage />
              </PermissionRoute>
            }
          />
          <Route
            path="p/vendor/exceptions"
            element={
              <PermissionRoute permission="vendor.exceptions.operate">
                <VendorOperationsPage view="exceptions" />
              </PermissionRoute>
            }
          />
          <Route
            path="p/vendor/audit"
            element={
              <PermissionRoute permission="vendor.audit.read">
                <VendorOperationsPage view="audit" />
              </PermissionRoute>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/overview" replace />} />
      </Routes>
    </AuthProvider>
  );
}
