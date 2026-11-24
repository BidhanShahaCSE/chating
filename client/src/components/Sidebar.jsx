import { useEffect, useRef, useState } from 'react';
import {
  Check,
  MessageSquare,
  Moon,
  PanelLeftClose,
  Pencil,
  Plus,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import { groupConversationsByDate } from '../utils/storage.js';
import { BrandMark } from './BrandMark.jsx';

function ConversationRow({
  conversation,
  isActive,
  onSelect,
  onRename,
  onDelete,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(conversation.title);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const commitRename = () => {
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== conversation.title) {
      onRename(conversation.id, trimmed);
    } else {
      setDraftTitle(conversation.title);
    }
    setIsEditing(false);
  };

  const cancelRename = () => {
    setDraftTitle(conversation.title);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-1 rounded-lg bg-[var(--bg-elevated)] px-2 py-1.5 ring-1 ring-[var(--accent)]">
        <input
          ref={inputRef}
          type="text"
          value={draftTitle}
          maxLength={80}
          onChange={(e) => setDraftTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitRename();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              cancelRename();
            }
          }}
          onBlur={commitRename}
          aria-label="Rename conversation"
          className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none"
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={commitRename}
          className="rounded p-1 text-[var(--accent)] hover:bg-[var(--bg-hover)]"
          aria-label="Save conversation name"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={cancelRename}
          className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          aria-label="Cancel rename"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`group relative flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors ${
        isActive
          ? 'bg-[var(--bg-hover)] font-medium text-[var(--text-primary)]'
          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]/65 hover:text-[var(--text-primary)]'
      }`}
    >
      <button
        type="button"
        onClick={() => onSelect(conversation.id)}
        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        title={conversation.title}
      >
        <MessageSquare className="h-4 w-4 shrink-0 opacity-70" />
        <span className="truncate">{conversation.title}</span>
      </button>

      {confirmingDelete ? (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setConfirmingDelete(false);
              onDelete(conversation.id);
            }}
            className="rounded bg-rose-600 px-1.5 py-0.5 text-[11px] font-medium text-white transition-colors hover:bg-rose-700"
            aria-label="Confirm delete conversation"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(false)}
            className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            aria-label="Cancel delete conversation"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div
          className={`flex shrink-0 items-center gap-0.5 transition-opacity ${
            isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
          }`}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmingDelete(false);
              setDraftTitle(conversation.title);
              setIsEditing(true);
            }}
            className="rounded p-1 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            aria-label={`Rename ${conversation.title}`}
            title="Rename"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmingDelete(true);
            }}
            className="rounded p-1 text-[var(--text-secondary)] transition-colors hover:bg-rose-500/15 hover:text-rose-600 dark:hover:text-rose-400"
            aria-label={`Delete ${conversation.title}`}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  isOpen,
  onClose,
  onNewChat,
  conversations,
  activeConversationId,
  onSelectConversation,
  onRenameConversation,
  onDeleteConversation,
  theme,
  onToggleTheme,
  health,
  onShowSetupNotice,
}) {
  const grouped = groupConversationsByDate(conversations);

  const sidebarContent = (
    <div className="flex h-full w-[272px] flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-sidebar)]">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2.5 text-[var(--text-primary)]">
          <span className="text-[var(--accent)]">
            <BrandMark className="h-7 w-7" />
          </span>
          <span className="text-base font-semibold tracking-tight">Chating</span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
        >
          <PanelLeftClose className="h-4.5 w-4.5" />
        </button>
      </div>

      {/* New Chat Button */}
      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={onNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-3.5 py-2.5 text-sm font-medium text-[var(--accent-fg)] transition-colors hover:bg-[var(--accent-hover)]"
        >
          <Plus className="h-4 w-4" />
          <span>New chat</span>
        </button>
      </div>

      {/* Conversation History List */}
      <nav aria-label="Conversation history" className="flex-1 overflow-y-auto px-2.5 py-2">
        {grouped.length === 0 ? (
          <div className="px-2 py-6 text-center text-xs text-[var(--text-secondary)]">
            No conversations yet. Send a message to begin.
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map(([label, items]) => (
              <div key={label}>
                <div className="px-2.5 pb-1 text-[11px] font-semibold tracking-wide text-[var(--text-secondary)] uppercase">
                  {label}
                </div>
                <div className="space-y-0.5">
                  {items.map((conversation) => (
                    <ConversationRow
                      key={conversation.id}
                      conversation={conversation}
                      isActive={conversation.id === activeConversationId}
                      onSelect={onSelectConversation}
                      onRename={onRenameConversation}
                      onDelete={onDeleteConversation}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </nav>

      {/* Bottom Controls */}
      <div className="space-y-1.5 border-t border-[var(--border-subtle)] p-3">
        <button
          type="button"
          onClick={onToggleTheme}
          className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          <span className="flex items-center gap-2.5">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span>{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span>
          </span>
          <span className="text-xs opacity-75">{theme === 'dark' ? 'Dark' : 'Light'}</span>
        </button>

        <button
          type="button"
          onClick={onShowSetupNotice}
          className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          title="Check Gemini backend status"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${
                health.loading
                  ? 'bg-zinc-400'
                  : health.configured
                    ? 'bg-emerald-500'
                    : 'bg-amber-500'
              }`}
            />
            <span className="truncate font-medium">
              {health.loading
                ? 'Checking API…'
                : health.configured
                  ? 'Gemini API connected'
                  : 'API key required'}
            </span>
          </span>
          <span className="font-mono-code ml-2 shrink-0 truncate text-[11px] opacity-80">
            {health.model}
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop collapsible sidebar */}
      <aside
        className={`hidden md:block shrink-0 overflow-hidden transition-[width] duration-200 ease-out ${
          isOpen ? 'w-[272px]' : 'w-0'
        }`}
        aria-hidden={!isOpen}
      >
        {isOpen && sidebarContent}
      </aside>

      {/* Mobile slide-over drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden" role="dialog" aria-modal="true" aria-label="Chat history">
          <div
            className="fixed inset-0 bg-black/45 transition-opacity"
            onClick={onClose}
            aria-hidden="true"
          />
          <aside className="relative z-10 h-full">{sidebarContent}</aside>
        </div>
      )}
    </>
  );
}
