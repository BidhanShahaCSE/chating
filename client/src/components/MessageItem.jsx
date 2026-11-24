import { useState } from 'react';
import { AlertCircle, Check, Copy, RotateCw } from 'lucide-react';
import { BrandMark } from './BrandMark.jsx';
import { MarkdownRenderer } from './MarkdownRenderer.jsx';

export function MessageItem({
  message,
  isLastAssistant = false,
  isStreamingGlobal = false,
  onRegenerate,
  onRetry,
}) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = async () => {
    if (!message.content) return;
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard write unavailable
    }
  };

  if (isUser) {
    return (
      <div className="group flex justify-end">
        <div className="flex max-w-[85%] flex-col items-end gap-1.5 sm:max-w-[75%]">
          <div className="rounded-2xl rounded-br-sm bg-[var(--bg-user-bubble)] px-4 py-2.5 text-[0.95rem] leading-relaxed whitespace-pre-wrap break-words text-[var(--text-primary)]">
            {message.content}
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs text-[var(--text-secondary)] opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            aria-label="Copy user message"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-teal-600 dark:text-teal-400" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  const isLoading = message.status === 'loading' && !message.content;
  const isStreaming = message.status === 'streaming';
  const isStopped = message.status === 'stopped';
  const isError = message.status === 'error';

  return (
    <div className="flex items-start gap-3.5">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--accent)]">
        <BrandMark className="h-7 w-7" />
      </div>

      <div className="min-w-0 flex-1 space-y-2.5">
        {isLoading && (
          <div className="flex items-center gap-2 py-1.5 text-sm text-[var(--text-secondary)]" role="status" aria-live="polite">
            <span className="flex items-center gap-1" aria-hidden="true">
              <span className="typing-dot h-2 w-2 rounded-full bg-[var(--accent)]" />
              <span className="typing-dot h-2 w-2 rounded-full bg-[var(--accent)]" />
              <span className="typing-dot h-2 w-2 rounded-full bg-[var(--accent)]" />
            </span>
            <span>Generating response…</span>
          </div>
        )}

        {message.content && (
          <MarkdownRenderer content={message.content} isStreaming={isStreaming} />
        )}

        {isStopped && !message.content && (
          <p className="text-sm italic text-[var(--text-secondary)]">
            Generation stopped before any text was received.
          </p>
        )}

        {isError && (
          <div
            role="alert"
            className="flex flex-col gap-2.5 rounded-xl border border-rose-500/35 bg-rose-50/90 px-3.5 py-3 text-sm text-rose-900 dark:border-rose-400/30 dark:bg-rose-950/35 dark:text-rose-100"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <p className="leading-relaxed">{message.error || 'Failed to generate a response.'}</p>
            </div>
            {onRetry && !isStreamingGlobal && (
              <div>
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/35 bg-white/80 px-2.5 py-1 text-xs font-medium text-rose-900 transition-colors hover:bg-white dark:border-rose-400/30 dark:bg-rose-900/40 dark:text-rose-100 dark:hover:bg-rose-900/65"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  <span>Retry</span>
                </button>
              </div>
            )}
          </div>
        )}

        {!isLoading && !isStreaming && (message.content || isStopped) && (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {message.content && (
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                aria-label="Copy AI response"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            )}

            {isLastAssistant && onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                disabled={isStreamingGlobal}
                className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
                aria-label="Regenerate response"
              >
                <RotateCw className="h-3.5 w-3.5" />
                <span>Regenerate</span>
              </button>
            )}

            {isStopped && (
              <span className="ml-1 text-xs text-[var(--text-secondary)]">· Stopped</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
