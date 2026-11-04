import { useEffect, useRef } from 'react';

type Props = {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
};

function run(command: string, value?: string) {
  document.execCommand(command, false, value);
}

export function WordDocumentEditor({ value, onChange, disabled }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (ref.current.innerHTML !== value) ref.current.innerHTML = value || '';
  }, [value]);

  return (
    <div className={`word-editor${disabled ? ' is-disabled' : ''}`}>
      <div className="word-toolbar" role="toolbar" aria-label="Document formatting">
        <button type="button" className="button secondary" disabled={disabled} onClick={() => run('bold')}>
          Bold
        </button>
        <button type="button" className="button secondary" disabled={disabled} onClick={() => run('italic')}>
          Italic
        </button>
        <button type="button" className="button secondary" disabled={disabled} onClick={() => run('underline')}>
          Underline
        </button>
        <button type="button" className="button secondary" disabled={disabled} onClick={() => run('insertUnorderedList')}>
          Bullets
        </button>
        <button type="button" className="button secondary" disabled={disabled} onClick={() => run('insertOrderedList')}>
          Numbered
        </button>
        <button type="button" className="button secondary" disabled={disabled} onClick={() => run('formatBlock', 'h2')}>
          Heading
        </button>
        <button type="button" className="button secondary" disabled={disabled} onClick={() => run('formatBlock', 'p')}>
          Paragraph
        </button>
        <button type="button" className="button secondary" disabled={disabled} onClick={() => run('removeFormat')}>
          Clear
        </button>
      </div>
      <div
        ref={ref}
        className="word-canvas"
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={() => onChange(ref.current?.innerHTML ?? '')}
        role="textbox"
        aria-multiline="true"
        aria-label="Document body"
      />
    </div>
  );
}
