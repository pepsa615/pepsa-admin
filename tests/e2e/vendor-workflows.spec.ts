import { expect, test, type Page, type Route } from '@playwright/test';

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const vendorId = '11111111-1111-4111-8111-111111111111';
const platformId = '22222222-2222-4222-8222-222222222222';

async function mockVendorApi(page: Page) {
  const approvals: Array<Record<string, unknown>> = [];
  const mutations: Array<{ path: string; body: Record<string, unknown> }> = [];
  await page.route('**/admin-api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    if (path.endsWith('/auth/session'))
      return json(route, {
        data: {
          user: { id: 'admin-1', name: 'Ada Admin', email: 'ada@example.com' },
          permissions: [
            'vendor.dashboard.read',
            'vendor.businesses.read',
            'vendor.businesses.review',
            'vendor.businesses.status',
            'vendor.fees.read',
            'vendor.fees.manage',
            'vendor.operations.read',
            'vendor.finance.read',
            'vendor.exceptions.operate',
            'vendor.audit.read',
          ],
        },
      });
    if (path.endsWith('/auth/csrf')) return json(route, { data: { csrfToken: 'csrf' } });
    if (path.endsWith('/auth/step-up')) return route.fulfill({ status: 204 });
    if (path.endsWith('/notifications')) return json(route, { data: [] });
    if (path.endsWith('/platforms'))
      return json(route, {
        data: [
          { id: platformId, key: 'vendor', name: 'Vendor', status: 'ACTIVE', environments: [] },
        ],
      });
    if (path.endsWith('/platforms/vendor/capabilities'))
      return json(route, { data: { version: '1', operations: [] } });
    if (path.endsWith('/approvals') && method === 'GET') return json(route, { data: approvals });
    if (path.endsWith('/approvals') && method === 'POST') {
      const input = route.request().postDataJSON() as Record<string, unknown>;
      approvals.push({
        id: `approval-${approvals.length + 1}`,
        status: 'PENDING',
        action: input.action,
        payload: input.payload,
        reason: input.reason,
        expiresAt: input.expiresAt,
        requester: { id: 'admin-1', name: 'Ada Admin', email: 'ada@example.com' },
        platform: { id: platformId, key: 'vendor', name: 'Vendor' },
        decisions: [],
      });
      return json(route, { data: approvals.at(-1) });
    }
    if (path.endsWith('/operations/vendor/vendors-detail'))
      return json(route, {
        data: {
          id: vendorId,
          businessName: 'Kano Logistics',
          email: 'ops@kano.test',
          phone: '08000000000',
          type: 'BUSINESS',
          status: 'ACTIVE',
          paymentProvisioning: 'ACTIVE',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          applications: [],
          provisioningSagas: [],
          finance: {
            classification: 'PROJECTED',
            projectionCount: 1,
            totalAmountMinor: 500000,
            earningsMinor: 400000,
            outstandingFeeMinor: 2000,
          },
          performance: { orders: [], dispatches: [] },
          _count: {
            orders: 1,
            dispatches: 1,
            outboundManifests: 0,
            dispatchers: 1,
            inboundManifests: 0,
            customers: 1,
            users: 2,
          },
        },
      });
    if (path.endsWith('/operations/vendor/fee-policies-list'))
      return json(route, {
        data: [
          {
            id: 'fee-1',
            feeCode: 'RUNWAY_DISPATCH',
            scope: 'PLATFORM_DEFAULT',
            version: 1,
            calculationType: 'FLAT',
            currency: 'NGN',
            flatAmountMinor: 2000,
            deferralAllowed: true,
            status: 'DRAFT',
          },
        ],
      });
    if (path.endsWith('/operations/vendor/reviews-read'))
      return json(route, {
        data: {
          source: 'vendor',
          asOf: new Date().toISOString(),
          timezone: 'Africa/Lagos',
          currency: 'NGN',
          freshness: 'LIVE',
          dataQuality: 'COMPLETE',
          classification: 'AUTHORITATIVE',
          applications: [
            {
              id: 'application-1',
              version: 2,
              status: 'UNDER_REVIEW',
              submittedAt: new Date().toISOString(),
              vendor: { businessName: 'Kano Logistics', type: 'BUSINESS' },
            },
          ],
        },
      });
    if (path.endsWith('/operations/vendor/audit-read'))
      return json(route, {
        data: {
          source: 'vendor',
          asOf: new Date().toISOString(),
          timezone: 'Africa/Lagos',
          currency: 'NGN',
          freshness: 'LIVE',
          dataQuality: 'COMPLETE',
          classification: 'AUTHORITATIVE',
          events: [
            {
              id: 'event-1',
              actorId: 'system',
              action: 'checkout.paid',
              outcome: 'FAILED',
              requestId: 'request-event',
              createdAt: new Date().toISOString(),
            },
          ],
        },
      });
    if (path.includes('/operations/vendor/') && method === 'POST') {
      mutations.push({ path, body: route.request().postDataJSON() as Record<string, unknown> });
      return json(route, { data: { status: 'COMPLETED' } });
    }
    return json(route, { data: {} });
  });
  return { approvals, mutations };
}

test('vendor suspension uses MFA, reason and dual-control approval', async ({ page }) => {
  const { approvals } = await mockVendorApi(page);
  await page.goto(`/p/vendor/vendors/${vendorId}`);
  await expect(page.getByRole('heading', { name: 'Kano Logistics' })).toBeVisible();
  await page.getByRole('button', { name: 'Verify MFA' }).click();
  await page.getByLabel('Authenticator code').fill('123456');
  await page.getByRole('button', { name: 'Verify', exact: true }).click();
  await page.getByLabel('Vendor action').selectOption('vendor-suspend');
  await page
    .getByLabel('Business reason')
    .fill('Confirmed fraud response and operations containment');
  await page.getByRole('button', { name: 'Submit protected action' }).click();
  await expect.poll(() => approvals.length).toBe(1);
  expect(approvals[0]?.payload).toEqual({ operation: 'vendor-suspend', payload: { vendorId } });
});

test('fee version workflow is typed and requests dual approval', async ({ page }) => {
  const { approvals } = await mockVendorApi(page);
  await page.goto('/p/vendor/fees');
  await page.getByRole('button', { name: 'Create fee version' }).click();
  await page.getByLabel('Flat amount (NGN)').fill('35');
  await page
    .getByLabel('Business reason')
    .fill('Approved Runway pricing update for the next window');
  await page.getByRole('button', { name: 'Request creation' }).click();
  await expect.poll(() => approvals.length).toBe(1);
  expect(approvals[0]?.payload).toEqual({
    operation: 'fee-policy-create',
    payload: {
      feeCode: 'RUNWAY_DISPATCH',
      scope: 'PLATFORM_DEFAULT',
      currency: 'NGN',
      calculationType: 'FLAT',
      flatAmountMinor: 3500,
      roundingRule: 'HALF_UP',
      deferralAllowed: true,
    },
  });
});

test('review and replay workbenches use typed reasoned operations', async ({ page }) => {
  const { mutations } = await mockVendorApi(page);
  await page.goto('/p/vendor/reviews');
  await page.getByRole('button', { name: 'Approve' }).click();
  await page
    .getByLabel('Business reason')
    .fill('Verified clean application evidence and ownership');
  await page.getByRole('button', { name: 'Confirm action' }).click();
  await expect.poll(() => mutations.length).toBe(1);
  expect(mutations[0]?.body).toMatchObject({
    payload: { applicationId: 'application-1', decision: 'APPROVE' },
  });

  await page.goto('/p/vendor/audit');
  await page.getByRole('button', { name: 'Replay' }).click();
  await page
    .getByLabel('Business reason')
    .fill('Recover the failed delivery after destination restoration');
  await page.getByRole('button', { name: 'Confirm action' }).click();
  await expect.poll(() => mutations.length).toBe(2);
  expect(mutations[1]?.body).toMatchObject({ payload: { eventId: 'event-1' } });
});
