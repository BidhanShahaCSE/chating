import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, Moon, PanelLeftOpen, Plus, Sun } from 'lucide-react';
import { ApiSetupNotice } from './components/ApiSetupNotice.jsx';
import { ChatInput } from './components/ChatInput.jsx';
import { EmptyState } from './components/EmptyState.jsx';
import { MessageItem } from './components/MessageItem.jsx';
import { Sidebar } from './components/Sidebar.jsx';
import { fetchHealthStatus, streamChatResponse } from './services/chatApi.js';
import {
  createConversation,
  createId,
  deriveTitleFromPrompt,
  loadActiveConversationId,
  loadConversations,
  loadTheme,
  saveActiveConversationId,
  saveConversations,
  saveTheme,
} from './utils/storage.js';

export function App() {
  const [theme, setTheme] = useState(() => loadTheme());
  const [conversations, setConversations] = useState(() => {
    const existing = loadConversations();
    return existing.length > 0 ? existing : [createConversation()];
  });
  const [activeId, setActiveId] = useState(() => loadActiveConversationId());
  const [isSidebarOpen, setIsSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true,
  );
  const [inputValue, setInputValue] = useState('');
  const [streamingTarget, setStreamingTarget] = useState(null);
  const [health, setHealth] = useState({
    loading: true,
    configured: true,
    model: 'gemini-4-hydrogen',
    defaultModel: 'gemini-4-hydrogen',
    error: null,
  });
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const abortControllerRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const autoScrollEnabledRef = useRef(true);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? conversations[0] ?? null,
    [conversations, activeId],
  );

  useEffect(() => {
    if (activeConversation && activeConversation.id !== activeId) {
      setActiveId(activeConversation.id);
    }
  }, [activeConversation, activeId]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  useEffect(() => {
    saveActiveConversationId(activeConversation?.id ?? null);
  }, [activeConversation?.id]);

  const checkHealth = useCallback(async ({ reopenNotice = false } = {}) => {
    setIsCheckingHealth(true);
    try {
      const data = await fetchHealthStatus();
      setHealth({
        loading: false,
        configured: Boolean(data.configured),
        model: data.model || data.defaultModel || 'gemini-4-hydrogen',
        defaultModel: data.defaultModel || 'gemini-4-hydrogen',
        error: null,
      });
      if (reopenNotice) {
        setNoticeDismissed(false);
      }
    } catch {
      setHealth((prev) => ({
        ...prev,
        loading: false,
        configured: false,
        error: 'Could not reach the backend API on /api/health. Ensure the Express server is running.',
      }));
      if (reopenNotice) {
        setNoticeDismissed(false);
      }
    } finally {
      setIsCheckingHealth(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
    autoScrollEnabledRef.current = true;
    setShowScrollBottom(false);
  }, []);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const nearBottom = distanceFromBottom < 80;
    autoScrollEnabledRef.current = nearBottom;
    setShowScrollBottom(!nearBottom && container.scrollHeight > container.clientHeight + 40);
  }, []);

  useEffect(() => {
    if (autoScrollEnabledRef.current) {
      const container = scrollContainerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [activeConversation?.id, activeConversation?.messages]);

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const updateAssistantMessage = useCallback((convId, msgId, updater) => {
    setConversations((prev) =>
      prev.map((conv) => {
        if (conv.id !== convId) return conv;
        const nextMessages = conv.messages.map((msg) =>
          msg.id === msgId ? updater(msg) : msg,
        );
        return {
          ...conv,
          updatedAt: new Date().toISOString(),
          messages: nextMessages,
        };
      }),
    );
  }, []);

  const runStreamingTurn = useCallback(
    async ({ conversationId, assistantMessageId, historyForApi }) => {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setStreamingTarget({ conversationId, messageId: assistantMessageId });
      autoScrollEnabledRef.current = true;

      try {
        await streamChatResponse({
          messages: historyForApi,
          signal: controller.signal,
          onMeta: (meta) => {
            if (meta?.model) {
              setHealth((prev) => ({ ...prev, model: meta.model }));
            }
          },
          onDelta: (chunkText) => {
            updateAssistantMessage(conversationId, assistantMessageId, (msg) => ({
              ...msg,
              content: (msg.content || '') + chunkText,
              status: 'streaming',
              error: null,
            }));
          },
          onDone: () => {
            updateAssistantMessage(conversationId, assistantMessageId, (msg) => ({
              ...msg,
              status: 'completed',
              error: null,
            }));
          },
        });
      } catch (error) {
        if (error?.name === 'AbortError' || controller.signal.aborted) {
          updateAssistantMessage(conversationId, assistantMessageId, (msg) => ({
            ...msg,
            status: 'stopped',
            error: null,
          }));
        } else {
          if (error?.code === 'MISSING_API_KEY') {
            setHealth((prev) => ({ ...prev, configured: false }));
          }
          updateAssistantMessage(conversationId, assistantMessageId, (msg) => ({
            ...msg,
            status: 'error',
            error: error?.message || 'Unable to generate a response. Please try again.',
          }));
        }
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        setStreamingTarget(null);
      }
    },
    [updateAssistantMessage],
  );

  const handleSend = useCallback(
    async (overrideText) => {
      const prompt = String(overrideText ?? inputValue).trim();
      if (!prompt || streamingTarget) return;

      if (overrideText === undefined) {
        setInputValue('');
      }

      let targetConv = activeConversation;
      if (!targetConv) {
        targetConv = createConversation(deriveTitleFromPrompt(prompt));
      }

      const userMsg = {
        id: createId(),
        role: 'user',
        content: prompt,
        createdAt: new Date().toISOString(),
        status: 'completed',
      };

      const assistantMsg = {
        id: createId(),
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        status: 'loading',
        error: null,
      };

      const validPriorMessages = (targetConv.messages || []).filter(
        (m) => m.content && (m.role === 'user' || m.role === 'assistant'),
      );
      const historyForApi = [...validPriorMessages, userMsg];

      const isFirstUserMessage = validPriorMessages.length === 0;
      const nextTitle =
        isFirstUserMessage && targetConv.title === 'New chat'
          ? deriveTitleFromPrompt(prompt)
          : targetConv.title;

      const convId = targetConv.id;
      const now = new Date().toISOString();

      setConversations((prev) => {
        const exists = prev.some((c) => c.id === convId);
        const updated = exists
          ? prev.map((c) =>
              c.id === convId
                ? {
                    ...c,
                    title: nextTitle,
                    updatedAt: now,
                    messages: [...c.messages, userMsg, assistantMsg],
                  }
                : c,
            )
          : [
              {
                ...targetConv,
                title: nextTitle,
                updatedAt: now,
                messages: [userMsg, assistantMsg],
              },
              ...prev,
            ];
        return updated;
      });
      setActiveId(convId);

      await runStreamingTurn({
        conversationId: convId,
        assistantMessageId: assistantMsg.id,
        historyForApi,
      });
    },
    [activeConversation, inputValue, runStreamingTurn, streamingTarget],
  );

  const handleRegenerate = useCallback(
    async (targetMessageId) => {
      if (!activeConversation || streamingTarget) return;

      const msgs = activeConversation.messages;
      const idx =
        targetMessageId !== undefined
          ? msgs.findIndex((m) => m.id === targetMessageId)
          : msgs.length - 1;

      if (idx <= 0) return;

      const targetMsg = msgs[idx];
      if (!targetMsg || targetMsg.role !== 'assistant') return;

      const historyForApi = msgs
        .slice(0, idx)
        .filter((m) => m.content && (m.role === 'user' || m.role === 'assistant'));

      if (historyForApi.length === 0 || historyForApi[historyForApi.length - 1].role !== 'user') {
        return;
      }

      const convId = activeConversation.id;
      const truncated = msgs.slice(0, idx);
      const resetAssistantMsg = {
        ...targetMsg,
        content: '',
        status: 'loading',
        error: null,
        createdAt: new Date().toISOString(),
      };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? {
                ...c,
                updatedAt: new Date().toISOString(),
                messages: [...truncated, resetAssistantMsg],
              }
            : c,
        ),
      );

      await runStreamingTurn({
        conversationId: convId,
        assistantMessageId: resetAssistantMsg.id,
        historyForApi,
      });
    },
    [activeConversation, runStreamingTurn, streamingTarget],
  );

  const handleNewChat = useCallback(() => {
    stopGeneration();
    if (activeConversation && activeConversation.messages.length === 0) {
      if (window.innerWidth < 768) setIsSidebarOpen(false);
      return;
    }
    const fresh = createConversation();
    setConversations((prev) => [fresh, ...prev]);
    setActiveId(fresh.id);
    setInputValue('');
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, [activeConversation, stopGeneration]);

  const handleSelectConversation = useCallback(
    (id) => {
      if (id !== activeConversation?.id) {
        stopGeneration();
        setActiveId(id);
      }
      if (window.innerWidth < 768) {
        setIsSidebarOpen(false);
      }
    },
    [activeConversation?.id, stopGeneration],
  );

  const handleRenameConversation = useCallback((id, title) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c)),
    );
  }, []);

  const handleDeleteConversation = useCallback(
    (id) => {
      if (streamingTarget?.conversationId === id) {
        stopGeneration();
      }
      const filtered = conversations.filter((c) => c.id !== id);
      if (filtered.length === 0) {
        const replacement = createConversation();
        setConversations([replacement]);
        setActiveId(replacement.id);
        return;
      }
      setConversations(filtered);
      if (activeConversation?.id === id) {
        setActiveId(filtered[0].id);
      }
    },
    [activeConversation?.id, conversations, stopGeneration, streamingTarget?.conversationId],
  );

  const messages = useMemo(
    () => activeConversation?.messages ?? [],
    [activeConversation],
  );
  const lastAssistantIndex = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'assistant') return i;
    }
    return -1;
  }, [messages]);

  return (
    <div className="flex h-full w-full overflow-hidden bg-[var(--bg-app)] text-[var(--text-primary)]">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onNewChat={handleNewChat}
        conversations={conversations}
        activeConversationId={activeConversation?.id}
        onSelectConversation={handleSelectConversation}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversation}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        health={health}
        onShowSetupNotice={() => checkHealth({ reopenNotice: true })}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Navigation Header */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[var(--border-subtle)]/75 px-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            {!isSidebarOpen && (
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                aria-label="Open sidebar"
                title="Open sidebar"
              >
                <PanelLeftOpen className="h-4.5 w-4.5" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] md:hidden"
              aria-label="Open conversation history"
            >
              <PanelLeftOpen className="h-4.5 w-4.5" />
            </button>

            <h2 className="truncate text-sm font-semibold text-[var(--text-primary)]">
              {activeConversation?.title || 'New chat'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono-code hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-sidebar)] px-2.5 py-1 text-xs text-[var(--text-secondary)] sm:inline-block">
              {health.model}
            </span>

            <button
              type="button"
              onClick={handleNewChat}
              className="rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] md:hidden"
              aria-label="New chat"
              title="New chat"
            >
              <Plus className="h-4.5 w-4.5" />
            </button>

            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
              className="rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
            >
              {theme === 'dark' ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
            </button>
          </div>
        </header>

        {/* Main Message Viewport */}
        <main className="relative flex min-h-0 flex-1 flex-col">
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-4 py-5 sm:px-6"
          >
            {!noticeDismissed && (
              <ApiSetupNotice
                health={health}
                isChecking={isCheckingHealth}
                onRecheck={() => checkHealth({ reopenNotice: true })}
                onDismiss={() => setNoticeDismissed(true)}
              />
            )}

            {messages.length === 0 ? (
              <EmptyState
                model={health.model}
                disabled={Boolean(streamingTarget)}
                onSelectPrompt={(prompt) => handleSend(prompt)}
              />
            ) : (
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-6">
                {messages.map((message, index) => (
                  <MessageItem
                    key={message.id}
                    message={message}
                    isLastAssistant={index === lastAssistantIndex}
                    isStreamingGlobal={Boolean(streamingTarget)}
                    onRegenerate={() => handleRegenerate(message.id)}
                    onRetry={() => handleRegenerate(message.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {showScrollBottom && (
            <div className="pointer-events-none absolute right-0 bottom-3 left-0 flex justify-center">
              <button
                type="button"
                onClick={() => scrollToBottom('smooth')}
                className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] shadow-md transition-colors hover:bg-[var(--bg-hover)]"
                aria-label="Scroll to latest messages"
              >
                <ArrowDown className="h-3.5 w-3.5" />
                <span>Jump to bottom</span>
              </button>
            </div>
          )}
        </main>

        {/* Composer */}
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSend={() => handleSend()}
          onStop={stopGeneration}
          isStreaming={Boolean(streamingTarget)}
          model={health.model}
        />
      </div>
    </div>
  );
}

export default App;
