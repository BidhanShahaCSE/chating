import { ArrowUpRight } from 'lucide-react';
import { BrandMark } from './BrandMark.jsx';

const STARTER_PROMPTS = [
  'Compare REST, GraphQL, and gRPC for a real-time chat backend.',
  'Write a clean TypeScript debounce hook with cleanup and usage notes.',
  'Explain how Server-Sent Events handle streaming and reconnection.',
  'Create a concise checklist for securing an Express API in production.',
];

export function EmptyState({ model, onSelectPrompt, disabled = false }) {
  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col items-center justify-center px-4 py-10">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl text-[var(--accent)]">
        <BrandMark className="h-12 w-12" />
      </div>

      <h1 className="text-center text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-[1.75rem]">
        What would you like to work on?
      </h1>
      <p className="mt-2 max-w-md text-center text-sm text-[var(--text-secondary)]">
        Multi-turn streaming conversations powered by{' '}
        <span className="font-mono-code font-medium text-[var(--text-primary)]">{model}</span>.
      </p>

      <div className="mt-8 grid w-full grid-cols-1 gap-2.5 sm:grid-cols-2">
        {STARTER_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={disabled}
            onClick={() => onSelectPrompt(prompt)}
            className="group flex items-start justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3.5 text-left text-sm leading-snug text-[var(--text-primary)] transition-colors hover:border-[var(--accent)]/50 hover:bg-[var(--bg-hover)]/45 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>{prompt}</span>
            <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--text-secondary)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--accent)]" />
          </button>
        ))}
      </div>
    </div>
  );
}
