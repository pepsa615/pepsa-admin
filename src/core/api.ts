const apiBaseUrl = import.meta.env.VITE_ADMIN_API_BASE_URL || '/admin-api/v1';
export type { paths as AdminApiPaths } from '../services/admin-api/generated.js';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export interface Session {
  user: { id: string; email: string; name: string };
  permissions: string[];
}
export interface Platform {
  id: string;
  key: string;
  name: string;
  description?: string;
  status: string;
  environments: Array<{ id: string; key: string; name: string; status: string }>;
}
export interface PlatformCapabilities {
  version: string;
  operations: Array<{
    key: string;
    method: 'GET' | 'POST';
    permission: string;
    risk: 'low' | 'medium' | 'high' | 'critical';
    async?: boolean;
  }>;
}
export interface Administrator {
  id: string;
  email: string;
  name: string;
  status: string;
  mfaStatus: string;
  lastLoginAt?: string;
  createdAt: string;
  memberships: Array<{ status: string; platform: Pick<Platform, 'id' | 'key' | 'name'> }>;
  assignments: Array<{
    id: string;
    role: { id: string; key: string; name: string };
    platform?: Pick<Platform, 'id' | 'key' | 'name'>;
    environmentId?: string;
    resourceScope?: Record<string, unknown>;
    expiresAt?: string;
  }>;
}
export interface AuditEvent {
  id: string;
  sequence: string;
  action: string;
  outcome: string;
  reason?: string;
  requestId: string;
  createdAt: string;
  actor?: { name: string; email: string };
  platform?: { key: string; name: string };
}
export interface BasOverview {
  businesses: { total: number; pendingReview: number };
  orders: { total: number; active: number; exceptions: number };
  finance: { walletBalance: number; reservedBalance: number; currency: string };
  generatedAt: string;
}
export interface Approval {
  id: string;
  action: string;
  riskLevel: string;
  status: string;
  reason: string;
  payload: Record<string, unknown>;
  approvalsRequired: number;
  expiresAt: string;
  createdAt: string;
  requester: { id: string; name: string; email: string };
  platform?: { id: string; key: string; name: string };
  decisions: Array<{
    id: string;
    decision: string;
    reason: string;
    createdAt: string;
    approver: { id: string; name: string; email: string };
  }>;
}
export interface AccessReview {
  id: string;
  name: string;
  status: string;
  dueAt: string;
  completedAt?: string;
  reviewer: { id: string; name: string; email: string };
  platform: { id: string; key: string; name: string };
  items: Array<{
    id: string;
    decision?: string;
    reason?: string;
    user: { id: string; name: string; email: string; status: string };
    assignment: { id: string; role: { id: string; key: string; name: string } };
  }>;
}
export interface EmergencyAccess {
  id: string;
  status: string;
  permissions: string[];
  reason: string;
  incidentId: string;
  requestedAt: string;
  expiresAt: string;
  user: { id: string; name: string; email: string };
  requester: { id: string; name: string; email: string };
  approver?: { id: string; name: string; email: string };
  platform: { id: string; key: string; name: string };
}
export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  href?: string;
  status: string;
  createdAt: string;
}
export interface AdminSession {
  id: string;
  adminUserId: string;
  userAgent?: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  revokedAt?: string;
  mfaVerifiedAt?: string;
  stepUpAt?: string;
}

let csrfToken = '';
let platformEnvironment = 'production';
export const setCsrfToken = (value: string) => {
  csrfToken = value;
};
export const setPlatformEnvironment = (value: string) => {
  platformEnvironment = value;
};

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      accept: 'application/json',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...(csrfToken && init.method && init.method !== 'GET' ? { 'x-csrf-token': csrfToken } : {}),
      ...(path.startsWith('/operations/') ? { 'x-platform-environment': platformEnvironment } : {}),
      ...init.headers,
    },
  });
  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => ({}))) as {
    data?: T;
    error?: { code?: string; message?: string };
  };
  if (!response.ok)
    throw new ApiError(
      response.status,
      body.error?.code ?? 'REQUEST_FAILED',
      body.error?.message ?? 'The request failed',
    );
  return body.data as T;
}

interface QueuedOperation {
  operationId: string;
  status: string;
}

const isQueuedOperation = (value: unknown): value is QueuedOperation =>
  Boolean(
    value &&
    typeof value === 'object' &&
    'operationId' in value &&
    typeof value.operationId === 'string',
  );

async function waitForOperation<T>(operationId: string, timeoutMs = 30_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const operation = await request<{
      status: string;
      resultSummary?: T;
      errorCode?: string;
    }>(`/operations/records/${operationId}`);
    if (operation.status === 'SUCCEEDED') return operation.resultSummary as T;
    if (operation.status === 'FAILED')
      throw new ApiError(409, operation.errorCode ?? 'OPERATION_FAILED', 'The operation failed');
    await new Promise((resolve) => window.setTimeout(resolve, 350));
  }
  throw new ApiError(
    504,
    'OPERATION_TIMEOUT',
    'The operation is still queued. Confirm that the admin worker is running.',
  );
}

export const api = {
  health: (signal?: AbortSignal) =>
    request<{ status: string; service: string }>('/health/live', { signal }),
  login: (email: string, password: string) =>
    request<{ requiresMfa: true; enrollment?: { secret: string; uri: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  requestPasswordRecovery: (email: string) =>
    request<{ developmentToken?: string }>('/auth/password-recovery', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, password: string, mfaCode: string) =>
    request<void>('/auth/password-reset', {
      method: 'POST',
      body: JSON.stringify({ token, password, mfaCode }),
    }),
  verifyMfa: async (code: string) => {
    const data = await request<{ csrfToken: string; recoveryCodes: string[] }>('/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    setCsrfToken(data.csrfToken);
    return data;
  },
  recoverMfa: async (code: string) => {
    const data = await request<{ csrfToken: string; recoveryCodes: string[] }>(
      '/auth/mfa/recover',
      { method: 'POST', body: JSON.stringify({ code }) },
    );
    setCsrfToken(data.csrfToken);
    return data;
  },
  stepUp: (code: string) =>
    request<void>('/auth/step-up', { method: 'POST', body: JSON.stringify({ code }) }),
  session: () => request<Session>('/auth/session'),
  csrf: async () => {
    const data = await request<{ csrfToken: string }>('/auth/csrf');
    setCsrfToken(data.csrfToken);
  },
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  platforms: () => request<Platform[]>('/platforms'),
  platformHealth: (key: string) =>
    request<{ status: string; checkedAt: string }>(`/platforms/${key}/health`),
  platformCapabilities: (key: string) =>
    request<PlatformCapabilities>(`/platforms/${key}/capabilities`),
  createPlatform: (input: {
    key: string;
    name: string;
    description?: string;
    adapterType: string;
    reason: string;
  }) => request<Platform>('/platforms', { method: 'POST', body: JSON.stringify(input) }),
  updatePlatform: (
    id: string,
    input: {
      name?: string;
      description?: string;
      status?: string;
      reason: string;
    },
  ) => request<Platform>(`/platforms/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
  rotatePlatformCredentials: (
    id: string,
    input: { configurationReference: string; approvalId: string; reason: string },
  ) =>
    request<void>(`/platforms/${id}/credentials/rotate`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  addPlatformEnvironment: (
    id: string,
    input: { key: string; name: string; endpointReference?: string; reason: string },
  ) => request(`/platforms/${id}/environments`, { method: 'POST', body: JSON.stringify(input) }),
  operation: <T>(platform: string, operation: string, query = '') =>
    request<T>(`/operations/${platform}/${operation}${query}`),
  mutate: async <T>(
    platform: string,
    operation: string,
    reason: string,
    payload: Record<string, unknown>,
    approvalId?: string,
  ) => {
    const result = await request<T | QueuedOperation>(`/operations/${platform}/${operation}`, {
      method: 'POST',
      headers: { 'idempotency-key': crypto.randomUUID() },
      body: JSON.stringify({ reason, payload, approvalId }),
    });
    return isQueuedOperation(result) ? waitForOperation<T>(result.operationId) : result;
  },
  administrators: () => request<Administrator[]>('/administrators'),
  invite: (input: { email: string; name: string; reason: string }) =>
    request<{ id: string; email: string; name: string; status: string; developmentToken?: string }>(
      '/administrators',
      { method: 'POST', body: JSON.stringify(input) },
    ),
  updateAdministratorStatus: (userId: string, status: string, reason: string) =>
    request<void>(`/administrators/${userId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, reason }),
    }),
  setMembership: (
    userId: string,
    platformId: string,
    status: string,
    reason: string,
    expiresAt?: string,
  ) =>
    request(`/administrators/${userId}/membership`, {
      method: 'PUT',
      body: JSON.stringify({ platformId, status, reason, expiresAt }),
    }),
  assignRole: (
    userId: string,
    input: {
      roleId: string;
      platformId?: string;
      environmentId?: string;
      resourceScope?: Record<string, unknown>;
      expiresAt?: string;
      approvalId?: string;
      reason: string;
    },
  ) =>
    request(`/administrators/${userId}/assignments`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  resendInvitation: (userId: string, reason: string) =>
    request<{ accepted: boolean; developmentToken?: string }>(
      `/administrators/${userId}/resend-invitation`,
      { method: 'POST', body: JSON.stringify({ reason }) },
    ),
  revokeAssignment: (assignmentId: string, reason: string) =>
    request(`/assignments/${assignmentId}/revoke`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  audit: (filters: Record<string, string> = {}) =>
    request<AuditEvent[]>(`/audit?${new URLSearchParams(filters)}`),
  exportAudit: (filters: Record<string, string> = {}) =>
    request<{ filename: string; content: string }>(`/audit/export?${new URLSearchParams(filters)}`),
  verifyAudit: () =>
    request<{ valid: boolean; events?: number; failedAt?: string }>('/audit/verify'),
  roles: (platformId?: string) =>
    request<
      Array<{
        id: string;
        key: string;
        name: string;
        description?: string;
        permissions: Array<{
          permission: { key: string; riskLevel: string; delegatable: boolean };
        }>;
      }>
    >(`/roles${platformId ? `?platformId=${platformId}` : ''}`),
  permissions: (platformId?: string) =>
    request<
      Array<{
        id: string;
        key: string;
        description?: string;
        riskLevel: string;
        delegatable: boolean;
      }>
    >(`/permissions${platformId ? `?platformId=${platformId}` : ''}`),
  createRole: (input: {
    platformId?: string;
    key: string;
    name: string;
    description?: string;
    permissionIds: string[];
    approvalId?: string;
    reason: string;
  }) => request('/roles', { method: 'POST', body: JSON.stringify(input) }),
  operations: () => request<unknown[]>('/operations'),
  operationStatus: (id: string) => request<unknown>(`/operations/records/${id}`),
  approvals: () => request<Approval[]>('/approvals'),
  requestApproval: (input: {
    platformId?: string;
    action: string;
    riskLevel: 'HIGH' | 'CRITICAL';
    reason: string;
    payload: Record<string, unknown>;
    approvalsRequired: number;
    expiresAt: string;
  }) => request<Approval>('/approvals', { method: 'POST', body: JSON.stringify(input) }),
  decideApproval: (id: string, decision: 'APPROVE' | 'REJECT', reason: string) =>
    request<Approval>(`/approvals/${id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, reason }),
    }),
  cancelApproval: (id: string, reason: string) =>
    request<void>(`/approvals/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  accessReviews: () => request<AccessReview[]>('/access-reviews'),
  createAccessReview: (input: { platformId: string; name: string; dueAt: string }) =>
    request<AccessReview>('/access-reviews', { method: 'POST', body: JSON.stringify(input) }),
  decideReviewItem: (
    reviewId: string,
    itemId: string,
    decision: 'KEEP' | 'REVOKE',
    reason: string,
  ) =>
    request<AccessReview>(`/access-reviews/${reviewId}/items/${itemId}/decision`, {
      method: 'POST',
      body: JSON.stringify({ decision, reason }),
    }),
  emergencyAccess: () => request<EmergencyAccess[]>('/emergency-access'),
  requestEmergencyAccess: (input: {
    adminUserId: string;
    platformId: string;
    permissions: string[];
    reason: string;
    incidentId: string;
    expiresAt: string;
  }) =>
    request<EmergencyAccess>('/emergency-access', { method: 'POST', body: JSON.stringify(input) }),
  decideEmergencyAccess: (id: string, approve: boolean, reason: string) =>
    request<EmergencyAccess>(`/emergency-access/${id}/decision`, {
      method: 'POST',
      body: JSON.stringify({ approve, reason }),
    }),
  revokeEmergencyAccess: (id: string, reason: string) =>
    request<void>(`/emergency-access/${id}/revoke`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  notifications: (unread = false) =>
    request<Notification[]>(`/notifications${unread ? '?unread=true' : ''}`),
  readNotification: (id: string) => request<void>(`/notifications/${id}/read`, { method: 'POST' }),
  readAllNotifications: () => request<void>('/notifications/read-all', { method: 'POST' }),
  sessions: (userId?: string) =>
    request<AdminSession[]>(`/sessions${userId ? `?userId=${userId}` : ''}`),
  revokeSession: (id: string, reason: string) =>
    request<void>(`/sessions/${id}/revoke`, { method: 'POST', body: JSON.stringify({ reason }) }),
};

export const getServiceHealth = api.health;
