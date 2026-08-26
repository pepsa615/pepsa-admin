export function LoadingState({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="state-card" role="status">
      <span className="spinner" />
      {label}…
    </div>
  );
}
export function ErrorState({ error, retry }: { error: Error; retry?: () => void }) {
  return (
    <div className="state-card state-card--error" role="alert">
      <strong>We couldn’t load this view</strong>
      <span>{error.message}</span>
      {retry && (
        <button className="button secondary" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}
export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="state-card">
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}
export function PermissionDeniedState() {
  return (
    <div className="state-card state-card--error" role="alert">
      <strong>Permission denied</strong>
      <span>
        Your account is not authorized for this view. Request the required scoped role from an
        access manager.
      </span>
    </div>
  );
}
export function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`status status--${value.toLowerCase().replaceAll('_', '-')}`}>
      {value.replaceAll('_', ' ')}
    </span>
  );
}
