import type { HirayaDatabase } from '@hiraya/types';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Icons } from '../icons';
import { dispatchAssistant, runAssistant } from '../lib/assistant';
import type { ViewId } from '../lib/views';

type ChatLine = { id: string; from: 'you' | 'hiraya'; text: string };

export function AssistantDock({
  store,
  onView,
  onOpenMessages,
}: {
  store: HirayaDatabase;
  onView: (id: ViewId) => void;
  onOpenMessages: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [lines, setLines] = useState<ChatLine[]>([
    {
      id: 'intro',
      from: 'hiraya',
      text: 'I can take you around the desk. Try “open teachers” or “find student” and a name.',
    },
  ]);
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' });
  }, [lines, open]);

  function send(event?: FormEvent) {
    event?.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const result = runAssistant(text, store);
    setDraft('');
    setLines((current) => [
      ...current,
      { id: `u-${Date.now()}`, from: 'you', text },
      { id: `a-${Date.now()}`, from: 'hiraya', text: result.reply },
    ]);
    if (result.openMessages) onOpenMessages();
    if (result.view && result.view !== 'messages') onView(result.view);
    window.setTimeout(() => dispatchAssistant(result), 120);
  }

  return (
    <div className={open ? 'assistant-dock is-open' : 'assistant-dock'}>
      {open ? (
        <section className="assistant-panel" aria-label="HIRAYA assistant">
          <header>
            <div>
              <strong>HIRAYA assistant</strong>
              <span>Navigate the desk. I do not change records.</span>
            </div>
            <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Close assistant">
              ×
            </button>
          </header>
          <div className="assistant-log" ref={log}>
            {lines.map((line) => (
              <p key={line.id} className={line.from === 'you' ? 'is-you' : 'is-bot'}>
                {line.text}
              </p>
            ))}
          </div>
          <form onSubmit={send}>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Open a page or find someone…"
              aria-label="Ask the assistant"
              autoComplete="off"
            />
            <button type="submit">Go</button>
          </form>
        </section>
      ) : null}
      <button
        type="button"
        className="assistant-fab"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? 'Hide assistant' : 'Open assistant'}
        title="HIRAYA assistant"
      >
        <Icons.chat width={22} height={22} />
      </button>
    </div>
  );
}
