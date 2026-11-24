import { KeyRound, RefreshCw, X } from 'lucide-react';

export function ApiSetupNotice({
  health,
  isChecking,
  onRecheck,
  onDismiss,
}) {
  if (health.loading || health.configured) {
    return null;
  }

  return (
    <div
      role="status"
      className="mx-auto mb-3 w-full max-w-3xl rounded-xl border border-amber-500/35 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-400/30 dark:bg-amber-950/35 dark:text-amber-100"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
          <div className="space-y-1">
            <p className="font-semibold">
              {health.error
                ? 'Backend connection unavailable'
                : 'Gemini API key required to start chatting'}
            </p>
            <p className="text-xs leading-relaxed text-amber-900/90 dark:text-amber-200/90">
              {health.error ? (
                health.error
              ) : (
                <>
                  Add your key to <code className="font-mono-code font-semibold">.env</code> as{' '}
                  <code className="font-mono-code font-semibold">GEMINI_API_KEY=your_key</code>{' '}
                  (get one in Google AI Studio) and restart the backend server.
                </>
              )}
            </p>
            <div className="pt-1">
              <button
                type="button"
                onClick={onRecheck}
                disabled={isChecking}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-600/30 bg-white/75 px-2.5 py-1 text-xs font-medium text-amber-950 transition-colors hover:bg-white disabled:opacity-60 dark:border-amber-300/25 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                <span>{isChecking ? 'Checking…' : 'Recheck status'}</span>
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg p-1 text-amber-800/80 transition-colors hover:bg-amber-200/50 hover:text-amber-950 dark:text-amber-200/75 dark:hover:bg-amber-800/40 dark:hover:text-white"
          aria-label="Dismiss configuration notice"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
