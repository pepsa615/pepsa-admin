import { expect, test, type Page, type Route } from '@playwright/test';

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const orderPlatform = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  key: 'pepsa-order',
  name: 'Pepsa Order',
  description: 'Pepsa order operations platform',
  status: 'ACTIVE',
  environments: [
    {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      key: 'production',
      name: 'Production',
      status: 'ACTIVE',
    },
  ],
};

const orderOperations = [
  { key: 'partners-list', method: 'GET', permission: 'order.partners.read', risk: 'low' },
  { key: 'partners-get', method: 'GET', permission: 'order.partners.read', risk: 'low' },
  { key: 'fleet-health', method: 'GET', permission: 'order.fleet.read', risk: 'low' },
  { key: 'fleet-riders', method: 'GET', permission: 'order.fleet.read', risk: 'low' },
  { key: 'fleet-refresh', method: 'POST', permission: 'order.fleet.sync', risk: 'medium' },
  { key: 'processing-pool', method: 'GET', permission: 'order.processing.read', risk: 'low' },
  { key: 'dispatch-tasks', method: 'GET', permission: 'order.dispatch.read', risk: 'low' },
  { key: 'metrics-read', method: 'GET', permission: 'order.events.read', risk: 'low' },
  { key: 'catalog-read', method: 'GET', permission: 'order.catalog.read', risk: 'low' },
  { key: 'partners-create', method: 'POST', permission: 'order.partners.write', risk: 'high' },
  {
    key: 'credentials-issue',
    method: 'POST',
    permission: 'order.credentials.issue',
    risk: 'critical',
  },
  {
    key: 'credentials-revoke',
    method: 'POST',
    permission: 'order.credentials.revoke',
    risk: 'critical',
  },
  {
    key: 'policies-active',
    method: 'GET',
    permission: 'order.operations.policies.read',
    risk: 'low',
  },
  {
    key: 'policies-publish',
    method: 'POST',
    permission: 'order.operations.policies.write',
    risk: 'critical',
  },
  { key: 'events-list', method: 'GET', permission: 'order.events.read', risk: 'low' },
  { key: 'integrations-list', method: 'GET', permission: 'order.integrations.read', risk: 'low' },
] as const;

async function mockOrderApi(page: Page, permissions: string[]) {
  await page.route('**/admin-api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();

    if (path.endsWith('/auth/session'))
      return json(route, {
        data: {
          user: { id: 'admin-id', name: 'Ada Admin', email: 'ada@example.com' },
          permissions,
        },
      });
    if (path.endsWith('/auth/csrf')) return json(route, { data: { csrfToken: 'csrf-token' } });
    if (path.endsWith('/auth/step-up')) return route.fulfill({ status: 204 });
    if (path.endsWith('/platforms')) return json(route, { data: [orderPlatform] });
    if (path.endsWith('/platforms/pepsa-order/capabilities'))
      return json(route, { data: { version: '1.0.0', operations: orderOperations } });
    if (path.endsWith('/platforms/pepsa-order/health'))
      return json(route, {
        data: { status: 'available', checkedAt: new Date().toISOString() },
      });
    if (path.endsWith('/notifications')) return json(route, { data: [] });

    if (path.endsWith('/approvals') && method === 'GET')
      return json(route, {
        data: [
          {
            id: 'approval-credentials-issue',
            action: 'operation.execute',
            riskLevel: 'CRITICAL',
            status: 'APPROVED',
            reason: 'Issue partner credential for sandbox onboarding',
            payload: {
              operation: 'credentials-issue',
              payload: {
                partnerId: 'partner-sandbox-1',
                scopes: ['orders:create', 'orders:read', 'payments:initiate'],
              },
            },
            approvalsRequired: 2,
            expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
            createdAt: new Date().toISOString(),
            requester: { id: 'admin-id', name: 'Ada Admin', email: 'ada@example.com' },
            platform: {
              id: orderPlatform.id,
              key: 'pepsa-order',
              name: 'Pepsa Order',
            },
            decisions: [],
          },
        ],
      });
    if (path.endsWith('/approvals') && method === 'POST')
      return json(route, {
        data: {
          id: 'approval-new',
          action: 'operation.execute',
          status: 'PENDING',
          riskLevel: 'CRITICAL',
          reason: 'requested',
          payload: {},
          approvalsRequired: 2,
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          createdAt: new Date().toISOString(),
          requester: { id: 'admin-id', name: 'Ada Admin', email: 'ada@example.com' },
          decisions: [],
        },
      });

    if (path.endsWith('/operations/pepsa-order/fleet-health'))
      return json(route, { data: { status: 'healthy', ridersOnline: 12 } });
    if (path.endsWith('/operations/pepsa-order/processing-pool'))
      return json(route, { data: { items: [{ id: 'pool-1', status: 'READY' }] } });
    if (path.endsWith('/operations/pepsa-order/dispatch-tasks'))
      return json(route, {
        data: {
          tasks: [
            { id: 'task-1', status: 'OPEN' },
            { id: 'task-2', status: 'OFFERED' },
          ],
        },
      });
    if (path.endsWith('/operations/pepsa-order/metrics-read'))
      return json(route, { data: { ordersPerMinute: 3 } });
    if (path.endsWith('/operations/pepsa-order/fleet-riders'))
      return json(route, {
        data: { riders: [{ id: 'rider-1', name: 'Rider One', status: 'ONLINE' }] },
      });
    if (path.endsWith('/operations/pepsa-order/fleet-refresh') && method === 'POST')
      return json(route, { data: { refreshed: true } });
    if (path.endsWith('/operations/pepsa-order/partners-list'))
      return json(route, {
        data: {
          items: [
            {
              partnerId: 'partner-sandbox-1',
              apiId: 'BAS',
              name: 'Sandbox Partner',
              active: true,
              createdAt: '2026-09-18T10:00:00.000Z',
            },
          ],
          page: 1,
          pageSize: 50,
          total: 1,
        },
      });
    if (path.includes('/operations/pepsa-order/partners-get'))
      return json(route, {
        data: {
          partnerId: 'partner-sandbox-1',
          apiId: 'BAS',
          name: 'Sandbox Partner',
          active: true,
          createdAt: '2026-09-18T10:00:00.000Z',
          users: [],
          costProfiles: [],
          credentials: [],
        },
      });
    if (path.endsWith('/operations/pepsa-order/catalog-read'))
      return json(route, {
        data: {
          categories: [{ code: 'MAIL_SMALL_PARCEL', name: 'Mail and Small Parcel' }],
          deliveryScopes: [{ code: 'LAST_MILE', name: 'Last Mile' }],
          mobilityTypes: [{ code: 'MOTORCYCLE', name: 'Motorcycle' }],
        },
      });
    if (path.endsWith('/operations/pepsa-order/credentials-issue') && method === 'POST')
      return json(route, { data: { credentialId: 'cred-1', token: 'ord_sandbox_issued' } });

    return json(route, { data: {} });
  });
}

test('pepsa-order overview read and fleet refresh mutation', async ({ page }) => {
  test.setTimeout(90_000);
  await mockOrderApi(page, [
    'order.fleet.read',
    'order.fleet.sync',
    'order.processing.read',
    'order.dispatch.read',
    'order.events.read',
  ]);

  let refreshBody: Record<string, unknown> | undefined;
  let refreshIdempotencyKey: string | undefined;
  await page.route('**/admin-api/v1/operations/pepsa-order/fleet-refresh', async (route) => {
    if (route.request().method() === 'POST') {
      refreshBody = route.request().postDataJSON() as Record<string, unknown>;
      refreshIdempotencyKey = route.request().headers()['idempotency-key'];
      return json(route, { data: { refreshed: true } });
    }
    return route.fallback();
  });

  await page.goto('/p/pepsa-order/overview');
  await expect(page.getByRole('heading', { name: 'Order overview' })).toBeVisible();
  await expect(page.getByText('Fleet health')).toBeVisible();
  await expect(page.getByText('healthy').first()).toBeVisible();
  await expect(page.getByText('Processing pool')).toBeVisible();
  await expect(page.getByText('Dispatch tasks')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Order overview' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Fleet' })).toBeVisible();

  await page.getByRole('link', { name: 'Fleet' }).click();
  await expect(page.getByRole('heading', { name: 'Fleet' })).toBeVisible();
  await page.getByRole('button', { name: 'Refresh fleet' }).click();
  await page.getByLabel('Business reason').fill('Scheduled fleet inventory refresh');
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();

  await expect
    .poll(() => refreshBody)
    .toEqual({
      reason: 'Scheduled fleet inventory refresh',
      payload: {},
    });
  expect(refreshIdempotencyKey).toBeTruthy();
});

test('pepsa-order overview denies without fleet read permission', async ({ page }) => {
  test.setTimeout(60_000);
  await mockOrderApi(page, ['order.partners.read']);
  await page.goto('/p/pepsa-order/overview');
  await expect(page.getByRole('alert')).toContainText('Permission denied');
});

test('pepsa-order credentials-issue mutation requires approvalId', async ({ page }) => {
  test.setTimeout(90_000);
  await mockOrderApi(page, [
    'order.partners.read',
    'order.catalog.read',
    'order.credentials.issue',
    'order.credentials.revoke',
  ]);

  let issueBody: Record<string, unknown> | undefined;
  let issueIdempotencyKey: string | undefined;
  await page.route('**/admin-api/v1/operations/pepsa-order/credentials-issue', async (route) => {
    if (route.request().method() === 'POST') {
      issueBody = route.request().postDataJSON() as Record<string, unknown>;
      issueIdempotencyKey = route.request().headers()['idempotency-key'];
      return json(route, { data: { credentialId: 'cred-1', token: 'ord_sandbox_issued' } });
    }
    return route.fallback();
  });

  await page.goto('/p/pepsa-order/partners');
  await expect(page.getByRole('heading', { name: 'Partners and credentials' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Order partners' })).toBeVisible();
  await expect(page.getByText('Sandbox Partner')).toBeVisible();
  await expect(page.locator('pre.code-block')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open' }).click();
  await page.getByRole('button', { name: 'Verify MFA' }).click();
  await page.getByLabel('Authenticator code').fill('123456');
  await page.getByRole('button', { name: 'Verify', exact: true }).click();
  await page.getByRole('button', { name: 'Issue credential' }).click();
  const dialog = page.getByRole('dialog', { name: 'Issue partner credential' });
  await dialog
    .getByLabel('Business reason')
    .fill('Issue partner credential for sandbox onboarding');
  await dialog.getByRole('button', { name: 'Issue credential' }).click();

  await expect
    .poll(() => issueBody)
    .toEqual({
      reason: 'Issue partner credential for sandbox onboarding',
      payload: {
        partnerId: 'partner-sandbox-1',
        scopes: ['orders:create', 'orders:read', 'payments:initiate'],
      },
      approvalId: 'approval-credentials-issue',
    });
  expect(issueIdempotencyKey).toBeTruthy();
  await expect(page.getByText('Credential issue submitted.')).toBeVisible();
});
