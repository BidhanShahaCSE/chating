import { useEffect, useRef } from 'react';
import { ArrowUp, Square } from 'lucide-react';

export function ChatInput({
  value,
  onChange,
  onSend,
  onStop,
  isStreaming,
  model,
}) {
  const textareaRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const nextHeight = Math.min(el.scrollHeight, 200);
    el.style.height = `${Math.max(nextHeight, 44)}px`;
  }, [value]);

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (!isStreaming && value.trim()) {
        onSend();
      }
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (isStreaming) {
      onStop();
      return;
    }
    if (value.trim()) {
      onSend();
    }
  };

  return (
    <div className="border-t border-[var(--border-subtle)]/70 bg-[var(--bg-app)] px-3 pt-3 pb-4 sm:px-6">
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2 shadow-sm transition-colors focus-within:border-[var(--accent)]"
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message Chating…"
          aria-label="Message input"
          className="max-h-[200px] min-h-[44px] flex-1 resize-none bg-transparent px-2.5 py-2.5 text-[0.95rem] leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/75 focus:outline-none"
        />

        {isStreaming ? (
          <button
            type="button"
            onClick={onStop}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white transition-colors hover:bg-rose-700"
            aria-label="Stop generating"
            title="Stop generating"
          >
            <Square className="h-4 w-4 fill-current" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!value.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--accent-fg)] transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="Send message"
            title="Send message"
          >
            <ArrowUp className="h-4.5 w-4.5" />
          </button>
        )}
      </form>

      <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-[var(--text-secondary)]">
        Enter to send · Shift+Enter for new line · Model:{' '}
        <span className="font-mono-code">{model}</span>
      </p>
    </div>
  );
}
