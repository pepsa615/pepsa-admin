import { useState, type ReactNode } from 'react';
import { formatDate } from '../core/format.js';

export type JsonRecord = Record<string, unknown>;

export function asRecords(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value as JsonRecord[];
  if (value && typeof value === 'object') {
    const record = value as JsonRecord;
    for (const key of [
      'items',
      'data',
      'results',
      'rows',
      'records',
      'riders',
      'tasks',
      'integrations',
      'events',
      'platforms',
      'partners',
    ]) {
      if (Array.isArray(record[key])) return record[key] as JsonRecord[];
    }
  }
  return [];
}

/** Flatten provider-failures shape `{ outbox, webhooks, notifications }`. */
export function asFailureGroups(value: unknown): Array<{ label: string; rows: JsonRecord[] }> {
  if (!value || typeof value !== 'object') return [];
  const record = value as JsonRecord;
  const groups: Array<{ label: string; rows: JsonRecord[] }> = [];
  for (const [label, key] of [
    ['Outbox', 'outbox'],
    ['Webhooks', 'webhooks'],
    ['Notifications', 'notifications'],
  ] as const) {
    if (Array.isArray(record[key])) {
      groups.push({ label, rows: record[key] as JsonRecord[] });
    }
  }
  if (groups.length) {
    return groups.some((group) => group.rows.length > 0)
      ? groups.filter((group) => group.rows.length > 0)
      : [];
  }
  const flat = asRecords(value);
  return flat.length ? [{ label: 'Failures', rows: flat }] : [];
}

export function scalar(value: unknown) {
  if (value == null) return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  return '—';
}

export function pickString(record: JsonRecord | undefined, ...keys: string[]) {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  }
  return undefined;
}

export function DetailPanel(props: {
  title?: string;
  entries: Array<{ label: string; value: ReactNode }>;
}) {
  if (!props.entries.length) return null;
  return (
    <section className="review-section">
      {props.title ? <h3>{props.title}</h3> : null}
      <dl className="review-details">
        {props.entries.map((entry) => (
          <div key={entry.label}>
            <dt>{entry.label}</dt>
            <dd>{entry.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function ChipList(props: { title: string; items: Array<{ code?: string; name?: string }> }) {
  return (
    <section className="review-section">
      <h3>{props.title}</h3>
      {props.items.length ? (
        <div className="inline-actions" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
          {props.items.map((item, index) => (
            <span key={`${item.code ?? item.name ?? index}`} className="status-badge">
              {item.name ?? item.code ?? '—'}
              {item.code && item.name ? ` (${item.code})` : null}
            </span>
          ))}
        </div>
      ) : (
        <p className="muted">None</p>
      )}
    </section>
  );
}

export function ReasonModal(props: {
  title: string;
  description: string;
  confirmLabel: string;
  titleId?: string;
  busy?: boolean;
  error?: string;
  children?: ReactNode;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const titleId = props.titleId ?? 'ops-reason-title';
  return (
    <div className="modal-backdrop" role="presentation" onClick={props.onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id={titleId}>{props.title}</h2>
        </header>
        <p>{props.description}</p>
        {props.children}
        <label>
          Business reason
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            placeholder="Explain why this change is required"
          />
        </label>
        {props.error ? <p className="form-error">{props.error}</p> : null}
        <footer>
          <button className="button secondary" type="button" onClick={props.onClose}>
            Cancel
          </button>
          <button
            className="button primary"
            type="button"
            disabled={submitting || props.busy || reason.trim().length < 8}
            onClick={() => {
              setSubmitting(true);
              void props.onSubmit(reason.trim()).finally(() => setSubmitting(false));
            }}
          >
            {props.confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}

export function formatMaybeDate(value: unknown) {
  return typeof value === 'string' ? formatDate(value) : '—';
}
