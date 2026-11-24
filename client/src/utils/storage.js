const CONVERSATIONS_KEY = 'chating.conversations.v1';
const ACTIVE_CONVERSATION_KEY = 'chating.activeConversationId.v1';
const THEME_KEY = 'chating.theme.v1';

export function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createConversation(title = 'New chat') {
  const now = new Date().toISOString();
  return {
    id: createId(),
    title,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

export function deriveTitleFromPrompt(text) {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'New chat';
  return cleaned.length > 46 ? `${cleaned.slice(0, 45).trimEnd()}…` : cleaned;
}

export function loadConversations() {
  try {
    const raw = localStorage.getItem(CONVERSATIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((conv) => conv && typeof conv.id === 'string' && Array.isArray(conv.messages))
      .map((conv) => ({
        ...conv,
        title: typeof conv.title === 'string' && conv.title.trim() ? conv.title : 'New chat',
        createdAt: conv.createdAt || new Date().toISOString(),
        updatedAt: conv.updatedAt || conv.createdAt || new Date().toISOString(),
        messages: conv.messages
          .filter((msg) => msg && typeof msg.id === 'string' && typeof msg.role === 'string')
          .map((msg) => {
            if (msg.status === 'streaming' || msg.status === 'loading') {
              return {
                ...msg,
                status: msg.content ? 'stopped' : 'error',
                error: msg.content
                  ? null
                  : msg.error || 'Generation was interrupted before completing.',
              };
            }
            return msg;
          }),
      }))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  } catch {
    return [];
  }
}

export function saveConversations(conversations) {
  try {
    localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
  } catch {
    // Ignore storage quota / privacy mode errors gracefully
  }
}

export function loadActiveConversationId() {
  try {
    return localStorage.getItem(ACTIVE_CONVERSATION_KEY) || null;
  } catch {
    return null;
  }
}

export function saveActiveConversationId(id) {
  try {
    if (id) {
      localStorage.setItem(ACTIVE_CONVERSATION_KEY, id);
    } else {
      localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export function loadTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
  } catch {
    // Ignore storage errors
  }

  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Ignore storage errors
  }
}

export function groupConversationsByDate(conversations) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  const startOfYesterday = startOfToday - oneDay;
  const startOfLastWeek = startOfToday - 7 * oneDay;

  const groups = {
    Today: [],
    Yesterday: [],
    'Previous 7 days': [],
    Older: [],
  };

  for (const conv of conversations) {
    const ts = new Date(conv.updatedAt || conv.createdAt).getTime();
    if (ts >= startOfToday) {
      groups.Today.push(conv);
    } else if (ts >= startOfYesterday) {
      groups.Yesterday.push(conv);
    } else if (ts >= startOfLastWeek) {
      groups['Previous 7 days'].push(conv);
    } else {
      groups.Older.push(conv);
    }
  }

  return Object.entries(groups).filter(([, items]) => items.length > 0);
}
