import type { ReactNode } from 'react';
export function Page({
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="page">
      <header className="page-heading">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1>{title}</h1>
          {description && <p className="page-description">{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
