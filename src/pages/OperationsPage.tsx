import { Page } from '../components/Page.js';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '../components/States.js';
import { api } from '../core/api.js';
import { formatDate, titleCase } from '../core/format.js';
import { useAsync } from '../core/useAsync.js';
import { useEffect } from 'react';

interface Operation {
  id: string;
  type: string;
  status: string;
  reason: string;
  requestedAt: string;
  actor: { name: string };
  platform: { name: string };
}
export function OperationsPage() {
  const operations = useAsync(() => api.operations() as Promise<Operation[]>, []);
  useEffect(() => {
    const timer = window.setInterval(() => void operations.reload(), 5_000);
    return () => window.clearInterval(timer);
  }, [operations.reload]);
  return (
    <Page
      eyebrow="Orchestration"
      title="Platform operations"
      description="Idempotent cross-platform mutations and their end-to-end outcomes."
    >
      {operations.loading ? (
        <LoadingState />
      ) : operations.error ? (
        <ErrorState error={operations.error} retry={operations.reload} />
      ) : !operations.data?.length ? (
        <EmptyState
          title="No operations yet"
          description="Tracked platform mutations will appear here."
        />
      ) : (
        <div className="table-panel">
          <table aria-label="Platform operations">
            <thead>
              <tr>
                <th>Operation</th>
                <th>Platform</th>
                <th>Actor</th>
                <th>Status</th>
                <th>Reason</th>
                <th>Requested</th>
              </tr>
            </thead>
            <tbody>
              {operations.data.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{titleCase(item.type)}</strong>
                  </td>
                  <td>{item.platform.name}</td>
                  <td>{item.actor.name}</td>
                  <td>
                    <StatusBadge value={item.status} />
                  </td>
                  <td>{item.reason}</td>
                  <td>{formatDate(item.requestedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}
