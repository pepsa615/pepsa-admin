import { expect, test, type Page, type Route } from '@playwright/test';

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const paymentPlatform = {
  id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  key: 'pepsa-payment',
  name: 'Pepsa Payment',
  description: 'Pepsa payment operations platform',
  status: 'ACTIVE',
  environments: [
    {
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      key: 'production',
      name: 'Production',
      status: 'ACTIVE',
    },
  ],
};

const paymentOperations = [
  { key: 'platforms-onboard', method: 'POST', permission: 'payment.platforms.write', risk: 'high' },
  {
    key: 'platforms-rotate-key',
    method: 'POST',
    permission: 'payment.platforms.keys.rotate',
    risk: 'critical',
  },
  { key: 'platforms-status', method: 'POST', permission: 'payment.platforms.status', risk: 'high' },
  {
    key: 'transfer-settings-get',
    method: 'GET',
    permission: 'payment.settings.transfer',
    risk: 'low',
  },
  {
    key: 'transfer-settings-patch',
    method: 'POST',
    permission: 'payment.settings.transfer',
    risk: 'high',
  },
  { key: 'vas-settings-get', method: 'GET', permission: 'payment.settings.vas', risk: 'low' },
  { key: 'vas-settings-patch', method: 'POST', permission: 'payment.settings.vas', risk: 'high' },
  {
    key: 'settlement-settings-get',
    method: 'GET',
    permission: 'payment.settings.settlement',
    risk: 'low',
  },
  {
    key: 'settlement-settings-patch',
    method: 'POST',
    permission: 'payment.settings.settlement',
    risk: 'high',
  },
  {
    key: 'sva-provisioning-list',
    method: 'GET',
    permission: 'payment.sva.provisioning.read',
    risk: 'medium',
  },
  {
    key: 'sva-provisioning-reconcile',
    method: 'POST',
    permission: 'payment.sva.provisioning.reconcile',
    risk: 'critical',
  },
  {
    key: 'checkout-provisioning-list',
    method: 'GET',
    permission: 'payment.checkout.provisioning.read',
    risk: 'medium',
  },
  {
    key: 'checkout-provisioning-reconcile',
    method: 'POST',
    permission: 'payment.checkout.provisioning.reconcile',
    risk: 'critical',
  },
  {
    key: 'kyc-rotate-encryption',
    method: 'POST',
    permission: 'payment.kyc.encryption.rotate',
    risk: 'critical',
  },
] as const;

async function mockPaymentApi(page: Page, permissions: string[]) {
  await page.route('**/admin-api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
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
    if (path.endsWith('/platforms')) return json(route, { data: [paymentPlatform] });
    if (path.endsWith('/platforms/pepsa-payment/capabilities'))
      return json(route, { data: { version: '1.0.0', operations: paymentOperations } });
    if (path.endsWith('/platforms/pepsa-payment/health'))
      return json(route, {
        data: { status: 'available', checkedAt: new Date().toISOString() },
      });
    if (path.endsWith('/notifications')) return json(route, { data: [] });

    if (path.endsWith('/approvals') && method === 'GET')
      return json(route, {
        data: [
          {
            id: 'approval-rotate',
            action: 'operation.execute',
            riskLevel: 'CRITICAL',
            status: 'APPROVED',
            reason: 'Scheduled quarterly platform API key rotation',
            payload: {
              operation: 'platforms-rotate-key',
              payload: { platformId: 'plat-sandbox-1' },
            },
            approvalsRequired: 2,
            expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
            createdAt: new Date().toISOString(),
            requester: { id: 'admin-id', name: 'Ada Admin', email: 'ada@example.com' },
            platform: {
              id: paymentPlatform.id,
              key: 'pepsa-payment',
              name: 'Pepsa Payment',
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

    if (path.endsWith('/operations/pepsa-payment/sva-provisioning-list'))
      return json(route, {
        data: { items: [{ userId: 'user-1', status: 'PENDING' }, { userId: 'user-2', status: 'FAILED' }] },
      });
    if (path.endsWith('/operations/pepsa-payment/checkout-provisioning-list'))
      return json(route, {
        data: { items: [{ checkoutId: 'chk-1', status: 'ACTIVE' }] },
      });
    if (path.endsWith('/operations/pepsa-payment/platforms-rotate-key') && method === 'POST')
      return json(route, { data: { apiKey: 'pp_live_rotated' } });

    return json(route, { data: {} });
  });
}

test('pepsa-payment overview read and rotate-key mutation with step-up', async ({ page }) => {
  test.setTimeout(90_000);
  await mockPaymentApi(page, [
    'payment.sva.provisioning.read',
    'payment.checkout.provisioning.read',
    'payment.platforms.write',
    'payment.platforms.keys.rotate',
  ]);

  let rotateBody: Record<string, unknown> | undefined;
  let rotateIdempotencyKey: string | undefined;
  await page.route('**/admin-api/v1/operations/pepsa-payment/platforms-rotate-key', async (route) => {
    if (route.request().method() === 'POST') {
      rotateBody = route.request().postDataJSON() as Record<string, unknown>;
      rotateIdempotencyKey = route.request().headers()['idempotency-key'];
      return json(route, { data: { apiKey: 'pp_live_rotated' } });
    }
    return route.fallback();
  });

  await page.goto('/p/pepsa-payment/overview');
  await expect(page.getByRole('heading', { name: 'Payment overview' })).toBeVisible();
  await expect(page.getByRole('main').getByText('SVA provisioning')).toBeVisible();
  await expect(page.getByRole('main').getByText('Checkout / DVA')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Payment overview' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Payment platforms' })).toBeVisible();

  await page.getByRole('link', { name: 'Payment platforms' }).click();
  await expect(page.getByRole('heading', { name: 'Platforms' })).toBeVisible();
  await page.getByRole('button', { name: 'Verify MFA' }).click();
  await page.getByLabel('Authenticator code').fill('123456');
  await page.getByRole('button', { name: 'Verify', exact: true }).click();
  await page.getByLabel('Platform ID').fill('plat-sandbox-1');
  await page.getByRole('button', { name: 'Rotate API key' }).click();
  await page.getByLabel('Business reason').fill('Scheduled quarterly platform API key rotation');
  await page.getByRole('button', { name: 'Rotate key', exact: true }).click();

  await expect.poll(() => rotateBody).toEqual({
    reason: 'Scheduled quarterly platform API key rotation',
    payload: { platformId: 'plat-sandbox-1' },
    approvalId: 'approval-rotate',
  });
  expect(rotateIdempotencyKey).toBeTruthy();
  await expect(page.getByText('pp_live_rotated')).toBeVisible();
});

test('pepsa-payment overview denies without sva read permission', async ({ page }) => {
  test.setTimeout(60_000);
  await mockPaymentApi(page, ['payment.settings.transfer']);
  await page.goto('/p/pepsa-payment/overview');
  await expect(page.getByRole('alert')).toContainText('Permission denied');
});
