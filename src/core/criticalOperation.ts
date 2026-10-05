import { api, type Approval } from './api.js';

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export type CriticalOperationResult =
  | { status: 'executed'; result: unknown }
  | { status: 'requested'; approvalId: string };

/**
 * Dual-control path for critical platform operations.
 * If a matching APPROVED request exists for this exact payload, executes mutate with approvalId.
 * Otherwise requests approval (approvalsRequired: 2) and returns without mutating.
 */
export async function executeCriticalOperation(input: {
  platformKey: string;
  operation: string;
  reason: string;
  payload: Record<string, unknown>;
  requesterId?: string;
}): Promise<CriticalOperationResult> {
  const platforms = await api.platforms();
  const platform = platforms.find(({ key }) => key === input.platformKey);
  if (!platform) throw new Error(`Platform ${input.platformKey} not found`);

  const approvalPayload = { operation: input.operation, payload: input.payload };
  const approvals = await api.approvals();
  const matching = findMatchingApproval(approvals, {
    platformId: platform.id,
    requesterId: input.requesterId,
    approvalPayload,
  });

  if (matching) {
    const result = await api.mutate(
      input.platformKey,
      input.operation,
      input.reason,
      input.payload,
      matching.id,
    );
    return { status: 'executed', result };
  }

  const created = await api.requestApproval({
    platformId: platform.id,
    action: 'operation.execute',
    riskLevel: 'CRITICAL',
    reason: input.reason,
    payload: approvalPayload,
    approvalsRequired: 2,
    expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
  });
  return { status: 'requested', approvalId: created.id };
}

export function findMatchingApproval(
  approvals: Approval[],
  input: {
    platformId: string;
    requesterId?: string;
    approvalPayload: Record<string, unknown>;
  },
) {
  return approvals.find(
    (approval) =>
      approval.action === 'operation.execute' &&
      approval.status === 'APPROVED' &&
      (approval.platform?.id ?? null) === input.platformId &&
      (!input.requesterId || approval.requester.id === input.requesterId) &&
      new Date(approval.expiresAt) > new Date() &&
      canonicalJson(approval.payload) === canonicalJson(input.approvalPayload),
  );
}

export function criticalRequestMessage(operation: string) {
  return `Dual approval requested for ${operation}. After two independent approvals, submit again with the same payload to execute.`;
}
