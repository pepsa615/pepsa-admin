import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../app/AuthContext.js';
import { Page } from '../components/Page.js';
import { StepUpDialog } from '../components/StepUpDialog.js';
import { WordDocumentEditor } from '../components/WordDocumentEditor.js';
import { EmptyState, ErrorState, LoadingState } from '../components/States.js';
import { api } from '../core/api.js';
import { useAsync } from '../core/useAsync.js';
import { INDEMNITY_HTML, INDEMNITY_TITLE } from '../content/indemnity.js';
import { PRIVACY_HTML, PRIVACY_TITLE } from '../content/privacy.js';

const PLATFORM = 'rider';

type DocumentKey = 'PRIVACY' | 'INDEMNITY' | 'TERMS' | 'SLIDDERS';

type OnboardingDocument = {
  key: DocumentKey;
  title: string;
  bodyHtml: string;
  slidesJson?: { list?: Array<{ title: string; message: string; image: string }> } | null;
  updatedBy?: string | null;
  updatedAt?: string;
};

const TABS: Array<{ key: DocumentKey; label: string }> = [
  { key: 'PRIVACY', label: 'Privacy policy' },
  { key: 'INDEMNITY', label: 'Indemnity' },
  { key: 'TERMS', label: 'Terms' },
  { key: 'SLIDDERS', label: 'Welcome slides' },
];

function unwrapDocuments(value: unknown): OnboardingDocument[] {
  if (Array.isArray(value)) return value as OnboardingDocument[];
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.data)) return record.data as OnboardingDocument[];
  }
  return [];
}

function unwrapDocument(value: unknown): OnboardingDocument | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const candidate = (
    record.data && typeof record.data === 'object' ? record.data : record
  ) as OnboardingDocument;
  return candidate?.key ? candidate : null;
}

export function RiderOnboardingDocumentsPage() {
  const auth = useAuth();
  const canManage = auth.can('rider.onboarding.manage');
  const list = useAsync(
    () => api.operation<unknown>(PLATFORM, 'onboarding-documents-list'),
    [],
  );
  const documents = useMemo(() => unwrapDocuments(list.data), [list.data]);
  const [activeKey, setActiveKey] = useState<DocumentKey>('PRIVACY');
  const [title, setTitle] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [slidesText, setSlidesText] = useState('[]');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [stepUp, setStepUp] = useState(false);

  const selected = documents.find((doc) => doc.key === activeKey) ?? null;

  useEffect(() => {
    if (!selected) return;
    setTitle(selected.title ?? '');
    setBodyHtml(selected.bodyHtml ?? '');
    setSlidesText(JSON.stringify(selected.slidesJson?.list ?? [], null, 2));
    setMessage('');
    setError('');
  }, [selected?.key, selected?.updatedAt]);

  const save = async () => {
    if (!canManage) return;
    const reason = window.prompt('Reason for updating this onboarding document');
    if (!reason?.trim()) return;

    setSaving(true);
    setError('');
    setMessage('');
    try {
      let slidesJson: OnboardingDocument['slidesJson'] | undefined;
      if (activeKey === 'SLIDDERS') {
        const parsed = JSON.parse(slidesText) as unknown;
        if (!Array.isArray(parsed)) throw new Error('Slides must be a JSON array');
        slidesJson = {
          list: parsed as Array<{ title: string; message: string; image: string }>,
        };
      }

      const saved = await api.mutate<unknown>(PLATFORM, 'onboarding-document-save', reason.trim(), {
        documentKey: activeKey,
        title: title.trim(),
        bodyHtml: activeKey === 'SLIDDERS' ? '' : bodyHtml,
        slidesJson,
      });
      const doc = unwrapDocument(saved);
      setMessage(doc ? `${doc.title} saved.` : 'Document saved.');
      await list.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save document');
    } finally {
      setSaving(false);
    }
  };

  const applyTemplate = () => {
    if (activeKey === 'SLIDDERS') {
      setSlidesText(
        JSON.stringify(
          [
            {
              title: 'Welcome to Pepsa Dispatch',
              message: 'Accept deliveries, navigate efficiently, and get paid securely.',
              image: 'https://pepsabas.pepsa.co/logo.png',
            },
            {
              title: 'Stay in control',
              message: 'Go online when ready, manage orders, and track your earnings.',
              image: 'https://pepsabas.pepsa.co/logo.png',
            },
            {
              title: 'Secure onboarding',
              message: 'Confirm your details, set your PIN, and complete verification.',
              image: 'https://pepsabas.pepsa.co/logo.png',
            },
          ],
          null,
          2,
        ),
      );
      setTitle('Welcome slides');
      return;
    }
    if (activeKey === 'PRIVACY') {
      setTitle(PRIVACY_TITLE);
      setBodyHtml(PRIVACY_HTML);
      return;
    }
    if (activeKey === 'INDEMNITY') {
      setTitle(INDEMNITY_TITLE);
      setBodyHtml(INDEMNITY_HTML);
      return;
    }
    setTitle('Terms and Condition');
    setBodyHtml(
      '<h2>Pepsa Rider Terms of Operation</h2><p><strong>Effective Date:</strong> Update this template.</p><ol><li>Keep credentials confidential.</li><li>Follow traffic and safety laws.</li></ol>',
    );
  };

  return (
    <Page
      eyebrow="Rider"
      title="Onboarding documents"
      description="Edit privacy, indemnity, terms, and welcome slides shown in the Rider app. Content is published immediately to onboarding screens."
      action={
        <button className="button secondary" onClick={() => setStepUp(true)}>
          Verify MFA
        </button>
      }
    >
      {message ? <p className="banner success">{message}</p> : null}
      {error ? <p className="banner danger">{error}</p> : null}

      {list.loading ? (
        <LoadingState />
      ) : list.error ? (
        <ErrorState error={list.error} retry={list.reload} />
      ) : !documents.length ? (
        <EmptyState
          title="No onboarding documents"
          description="Rider backend has not seeded onboarding templates yet."
        />
      ) : (
        <div className="table-panel">
          <div className="inline-actions" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`button ${activeKey === tab.key ? 'primary' : 'secondary'}`}
                onClick={() => setActiveKey(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <label className="stack-field">
            <span>Title</span>
            <input
              value={title}
              disabled={!canManage || saving}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          {activeKey === 'SLIDDERS' ? (
            <label className="stack-field">
              <span>Slides JSON template</span>
              <textarea
                className="word-slides-json"
                value={slidesText}
                disabled={!canManage || saving}
                onChange={(event) => setSlidesText(event.target.value)}
                rows={16}
              />
            </label>
          ) : (
            <WordDocumentEditor
              value={bodyHtml}
              onChange={setBodyHtml}
              disabled={!canManage || saving}
            />
          )}

          <div className="inline-actions" style={{ marginTop: 16 }}>
            <button
              type="button"
              className="button secondary"
              disabled={!canManage || saving}
              onClick={applyTemplate}
            >
              Load template
            </button>
            <button
              type="button"
              className="button primary"
              disabled={!canManage || saving || !title.trim()}
              onClick={() => void save()}
            >
              {saving ? 'Saving…' : 'Save document'}
            </button>
          </div>
          {selected?.updatedAt ? (
            <p className="muted" style={{ marginTop: 12 }}>
              Last updated {new Date(selected.updatedAt).toLocaleString()}
              {selected.updatedBy ? ` by ${selected.updatedBy}` : ''}
            </p>
          ) : null}
        </div>
      )}

      {stepUp ? <StepUpDialog close={() => setStepUp(false)} /> : null}
    </Page>
  );
}
