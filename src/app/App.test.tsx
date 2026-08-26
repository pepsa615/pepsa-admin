import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('admin authentication boundary', () => {
  it('renders the secure sign-in experience for an unauthenticated user', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } }),
          {
            status: 401,
            headers: { 'content-type': 'application/json' },
          },
        ),
      ),
    );

    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email address')).toBeInTheDocument();
  });

  it('renders a permission-denied state for a known deep link', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/auth/session'))
          return new Response(
            JSON.stringify({
              data: {
                user: { id: 'user-id', name: 'Read Only', email: 'read@example.com' },
                permissions: [],
              },
            }),
            { status: 200 },
          );
        if (url.endsWith('/platforms'))
          return new Response(JSON.stringify({ data: [] }), { status: 200 });
        return new Response(JSON.stringify({ data: { csrfToken: 'csrf' } }), { status: 200 });
      }),
    );
    render(
      <MemoryRouter initialEntries={['/audit']}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Permission denied');
  });

  it('provides an accessible password-recovery workflow', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ error: { code: 'UNAUTHENTICATED', message: 'Sign in required' } }),
            { status: 401 },
          ),
        ),
    );
    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Forgot your password?' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Recover your account' })).toBeVisible(),
    );
    expect(screen.getByLabelText('Email address')).toHaveAttribute('type', 'email');
  });

  it('finishes first-time MFA enrollment after recovery codes are acknowledged', async () => {
    let verified = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/auth/session'))
          return verified
            ? new Response(
                JSON.stringify({
                  data: {
                    user: { id: 'admin-id', name: 'New Admin', email: 'new@example.com' },
                    permissions: ['bas.dashboard.read'],
                  },
                }),
                { status: 200 },
              )
            : new Response(
                JSON.stringify({
                  error: { code: 'UNAUTHENTICATED', message: 'Sign in required' },
                }),
                { status: 401 },
              );
        if (url.endsWith('/auth/login'))
          return new Response(
            JSON.stringify({
              data: {
                requiresMfa: true,
                enrollment: {
                  secret: 'JBSWY3DPEHPK3PXP',
                  uri: 'otpauth://totp/Pepsa%20Admin:new@example.com?secret=JBSWY3DPEHPK3PXP',
                },
              },
            }),
            { status: 200 },
          );
        if (url.endsWith('/auth/mfa/verify')) {
          verified = true;
          return new Response(
            JSON.stringify({ data: { csrfToken: 'csrf', recoveryCodes: ['AAAA-BBBB-CCCC'] } }),
            { status: 200 },
          );
        }
        if (url.endsWith('/operations/business-as-a-service/overview'))
          return new Response(
            JSON.stringify({
              data: {
                businesses: { total: 0, pendingReview: 0 },
                orders: { total: 0, active: 0, exceptions: 0 },
                finance: { walletBalance: 0, reservedBalance: 0, currency: 'NGN' },
                generatedAt: new Date().toISOString(),
              },
            }),
            { status: 200 },
          );
        return new Response(JSON.stringify({ data: [] }), { status: 200 });
      }),
    );

    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>,
    );
    fireEvent.change(screen.getByLabelText('Email address'), {
      target: { value: 'new@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'A-strong-admin-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue securely' }));
    expect(await screen.findByText('First-time setup')).toBeVisible();
    expect(screen.getByText('Enter a setup key instead')).toBeVisible();
    expect(screen.getByLabelText('Authenticator code')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('Authenticator code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Verify and sign in' }));
    expect(await screen.findByRole('heading', { name: 'Save your recovery codes' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'I saved these codes' }));
    expect(
      await screen.findByRole('heading', { name: 'Good operational visibility starts here.' }),
    ).toBeVisible();
  });

  it('shows only assigned and destination-supported platform navigation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/auth/session'))
          return new Response(
            JSON.stringify({
              data: {
                user: { id: 'user-id', name: 'Scoped Admin', email: 'scoped@example.com' },
                permissions: ['bas.businesses.read', 'bas.orders.read'],
              },
            }),
            { status: 200 },
          );
        if (url.endsWith('/platforms'))
          return new Response(
            JSON.stringify({
              data: [
                {
                  id: 'platform-id',
                  key: 'business-as-a-service',
                  name: 'Business as a Service',
                  status: 'ACTIVE',
                  environments: [
                    {
                      id: 'environment-id',
                      key: 'production',
                      name: 'Production',
                      status: 'ACTIVE',
                    },
                  ],
                },
              ],
            }),
            { status: 200 },
          );
        if (url.endsWith('/platforms/business-as-a-service/capabilities'))
          return new Response(
            JSON.stringify({
              data: {
                version: '1.1.0',
                operations: [
                  {
                    key: 'businesses',
                    method: 'GET',
                    permission: 'bas.businesses.read',
                    risk: 'medium',
                  },
                ],
              },
            }),
            { status: 200 },
          );
        if (url.includes('/notifications'))
          return new Response(JSON.stringify({ data: [] }), { status: 200 });
        return new Response(JSON.stringify({ data: { csrfToken: 'csrf' } }), { status: 200 });
      }),
    );
    render(
      <MemoryRouter initialEntries={['/overview']}>
        <App />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole('link', { name: 'Businesses' }, { timeout: 15_000 }),
    ).toBeVisible();
    expect(screen.queryByRole('link', { name: 'Orders' })).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Platform environment' })).toHaveValue(
      'production',
    );
  });
});
