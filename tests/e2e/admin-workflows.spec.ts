import { expect, test, type Page, type Route } from '@playwright/test';

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const platform = {
  id: '11111111-1111-4111-8111-111111111111',
  key: 'business-as-a-service',
  name: 'Business as a Service',
  description: 'Pepsa business operations platform',
  status: 'ACTIVE',
  environments: [
    {
      id: '22222222-2222-4222-8222-222222222222',
      key: 'production',
      name: 'Production',
      status: 'ACTIVE',
    },
    {
      id: '33333333-3333-4333-8333-333333333333',
      key: 'sandbox',
      name: 'Sandbox',
      status: 'ACTIVE',
    },
  ],
};

async function mockSharedApi(page: Page, permissions: string[], initiallyAuthenticated = true) {
  let authenticated = initiallyAuthenticated;
  await page.route('**/admin-api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/session'))
      return authenticated
        ? json(route, {
            data: {
              user: { id: 'admin-id', name: 'Ada Admin', email: 'ada@example.com' },
              permissions,
            },
          })
        : json(route, { error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } }, 401);
    if (path.endsWith('/auth/login')) return json(route, { data: { requiresMfa: true } });
    if (path.endsWith('/auth/mfa/verify')) {
      authenticated = true;
      return json(route, { data: { csrfToken: 'csrf-token', recoveryCodes: [] } });
    }
    if (path.endsWith('/auth/csrf')) return json(route, { data: { csrfToken: 'csrf-token' } });
    if (path.endsWith('/auth/step-up')) return route.fulfill({ status: 204 });
    if (path.endsWith('/platforms')) return json(route, { data: [platform] });
    if (path.endsWith('/platforms/business-as-a-service/capabilities'))
      return json(route, {
        data: {
          version: '1.1.0',
          operations: [
            { key: 'overview', method: 'GET', permission: 'bas.dashboard.read', risk: 'low' },
            {
              key: 'businesses',
              method: 'GET',
              permission: 'bas.businesses.read',
              risk: 'medium',
            },
          ],
        },
      });
    if (path.endsWith('/platforms/business-as-a-service/health'))
      return json(route, {
        data: { status: 'available', checkedAt: new Date().toISOString() },
      });
    if (path.endsWith('/notifications')) return json(route, { data: [] });
    if (path.endsWith('/operations/business-as-a-service/overview'))
      return json(route, {
        data: {
          businesses: { total: 12, pendingReview: 2 },
          orders: { total: 20, active: 4, exceptions: 1 },
          finance: { walletBalance: 5000, reservedBalance: 250, currency: 'NGN' },
          generatedAt: new Date().toISOString(),
        },
      });
    return json(route, { data: {} });
  });
}

test('login, MFA, platform switching, environment scope, and denial', async ({ page }) => {
  await mockSharedApi(
    page,
    ['bas.dashboard.read', 'bas.businesses.read', 'bas.orders.read'],
    false,
  );
  await page.goto('/login');
  await page.getByLabel('Email address').fill('ada@example.com');
  await page.getByLabel('Password').fill('A-strong-admin-password');
  await page.getByRole('button', { name: 'Continue securely' }).click();
  await expect(page.getByRole('heading', { name: 'Enter your security code' })).toBeVisible();
  await page.getByLabel('Authenticator code').fill('123456');
  await page.getByRole('button', { name: 'Verify and sign in' }).click();
  await expect(
    page.getByRole('heading', { name: 'Good operational visibility starts here.' }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Businesses' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Orders' })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Platform environment' }).selectOption('sandbox');
  await expect(page.getByRole('combobox', { name: 'Platform environment' })).toHaveValue('sandbox');
  await page.goto('/audit');
  await expect(page.getByRole('alert')).toContainText('Permission denied');
});

test('step-up and approved credential rotation never expose a raw secret', async ({ page }) => {
  await mockSharedApi(page, ['admin.platforms.read', 'admin.platforms.manage']);
  let rotationBody: Record<string, unknown> | undefined;
  await page.route('**/admin-api/v1/platforms/*/credentials/rotate', async (route) => {
    rotationBody = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({ status: 204 });
  });
  await page.goto('/platforms');
  await page.getByRole('button', { name: 'Verify MFA' }).click();
  await page.getByLabel('Authenticator code').fill('123456');
  await page.getByRole('button', { name: 'Verify', exact: true }).click();
  await page.getByRole('button', { name: 'Rotate credentials' }).click();
  await page.getByLabel('New secret-manager reference').fill('vault://admin/platforms/bas/v2');
  await page.getByLabel('Approved request ID').fill('44444444-4444-4444-8444-444444444444');
  await page.getByLabel('Business reason').fill('Scheduled quarterly credential rotation');
  await page.getByRole('button', { name: 'Rotate reference' }).click();
  await expect
    .poll(() => rotationBody)
    .toEqual({
      configurationReference: 'vault://admin/platforms/bas/v2',
      approvalId: '44444444-4444-4444-8444-444444444444',
      reason: 'Scheduled quarterly credential rotation',
    });
  expect(JSON.stringify(rotationBody)).not.toContain('password');
  expect(JSON.stringify(rotationBody)).not.toContain('token');
});

test('invitation verifies identity by delivery token without an operator password', async ({
  page,
}) => {
  await mockSharedApi(page, ['admin.users.read', 'admin.users.manage']);
  let invitationBody: Record<string, unknown> | undefined;
  await page.route('**/admin-api/v1/administrators', async (route) => {
    if (route.request().method() === 'POST') {
      invitationBody = route.request().postDataJSON() as Record<string, unknown>;
      return json(route, {
        data: {
          id: '55555555-5555-4555-8555-555555555555',
          email: invitationBody.email,
          name: invitationBody.name,
          status: 'INVITED',
          developmentToken: 'development-invitation-token',
        },
      });
    }
    return json(route, { data: [] });
  });
  await page.goto('/administrators');
  await page.getByRole('button', { name: 'Invite administrator' }).click();
  await page.getByLabel('Full name').fill('Tunde Operator');
  await page.getByLabel('Work email').fill('tunde@example.com');
  await page.getByLabel('Business reason').fill('Approved operations team onboarding');
  await page.getByRole('button', { name: 'Send invitation' }).click();
  await expect(page.getByRole('status')).toContainText('Development invitation token');
  await expect
    .poll(() => invitationBody)
    .toEqual({
      name: 'Tunde Operator',
      email: 'tunde@example.com',
      reason: 'Approved operations team onboarding',
    });
  expect(invitationBody).not.toHaveProperty('password');
});
