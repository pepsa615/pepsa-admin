import { Page } from '../components/Page.js';
import { EmptyState, ErrorState, LoadingState, StatusBadge } from '../components/States.js';
import { api } from '../core/api.js';
import { formatDate, titleCase } from '../core/format.js';
import { useAsync } from '../core/useAsync.js';
import { useState, type FormEvent } from 'react';

export function AuditPage() {
  const [filters, setFilters] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('pepsa-admin-audit-filter') ?? '{}') as Record<
        string,
        string
      >;
    } catch {
      return {};
    }
  });
  const audit = useAsync(() => api.audit(filters), [JSON.stringify(filters)]);
  const [integrity, setIntegrity] = useState('');
  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = Object.fromEntries(
      [...new FormData(event.currentTarget)].filter(([, value]) => String(value)),
    );
    const next = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, String(value)]),
    );
    localStorage.setItem('pepsa-admin-audit-filter', JSON.stringify(next));
    setFilters(next);
  };
  const exportCsv = async () => {
    const result = await api.exportAudit(filters);
    const url = URL.createObjectURL(new Blob([result.content], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Page
      eyebrow="Security evidence"
      title="Audit trail"
      description="Append-only, hash-chained records of authentication, access, and operational activity."
      action={
        <div className="inline-actions">
          <button
            className="button secondary"
            onClick={() =>
              void api
                .verifyAudit()
                .then((result) =>
                  setIntegrity(
                    result.valid
                      ? `Verified · ${result.events ?? 0} events`
                      : `Integrity failure · ${result.failedAt}`,
                  ),
                )
            }
          >
            Verify chain
          </button>
          <button className="button primary" onClick={() => void exportCsv()}>
            Export CSV
          </button>
        </div>
      }
    >
      <form className="filter-bar" onSubmit={applyFilters}>
        <input
          name="action"
          aria-label="Action contains"
          placeholder="Action contains"
          defaultValue={filters.action}
        />
        <select name="outcome" aria-label="Outcome" defaultValue={filters.outcome ?? ''}>
          <option value="">All outcomes</option>
          <option>SUCCESS</option>
          <option>FAILURE</option>
          <option>DENIED</option>
        </select>
        <input name="from" type="datetime-local" aria-label="From" defaultValue={filters.from} />
        <input name="to" type="datetime-local" aria-label="To" defaultValue={filters.to} />
        <button className="button secondary">Apply and save</button>
      </form>
      {integrity && (
        <p className="integrity-status" role="status">
          {integrity}
        </p>
      )}
      {audit.loading ? (
        <LoadingState />
      ) : audit.error ? (
        <ErrorState error={audit.error} retry={audit.reload} />
      ) : !audit.data?.length ? (
        <EmptyState
          title="No audit events yet"
          description="Security and operator activity will appear here."
        />
      ) : (
        <div className="table-panel">
          <table aria-label="Audit events">
            <thead>
              <tr>
                <th>Event</th>
                <th>Actor</th>
                <th>Platform</th>
                <th>Outcome</th>
                <th>Occurred</th>
                <th>Request ID</th>
              </tr>
            </thead>
            <tbody>
              {audit.data.map((event) => (
                <tr key={event.id}>
                  <td>
                    <strong>{titleCase(event.action)}</strong>
                    <small>{event.reason}</small>
                  </td>
                  <td>
                    {event.actor?.name ?? 'System'}
                    <small>{event.actor?.email}</small>
                  </td>
                  <td>{event.platform?.name ?? 'Control plane'}</td>
                  <td>
                    <StatusBadge value={event.outcome} />
                  </td>
                  <td>{formatDate(event.createdAt)}</td>
                  <td>
                    <code>{event.requestId.slice(0, 12)}…</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}
