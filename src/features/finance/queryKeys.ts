export const financeQueryKeys = {
  root: ['finance'] as const,
  categories: {
    all: ['finance', 'categories'] as const,
    list: (userId?: string | null) => ['finance', 'categories', 'list', userId] as const,
  },
  dashboard: {
    all: ['finance', 'dashboard'] as const,
    detail: (userId?: string | null, monthDate?: string | null) =>
      ['finance', 'dashboard', 'detail', userId, monthDate] as const,
  },
  accounts: {
    all: ['finance', 'accounts'] as const,
    list: (userId?: string | null) => ['finance', 'accounts', 'list', userId] as const,
    overview: (userId?: string | null) => ['finance', 'accounts', 'overview', userId] as const,
  },
  transactions: {
    all: ['finance', 'transactions'] as const,
    feed: (userId?: string | null, filters?: Record<string, unknown>) =>
      ['finance', 'transactions', 'feed', userId, filters ?? null] as const,
  },
  cards: {
    all: ['finance', 'cards'] as const,
    list: (userId?: string | null) => ['finance', 'cards', 'list', userId] as const,
    invoices: (userId?: string | null, monthDate?: string | null) =>
      ['finance', 'cards', 'invoices', userId, monthDate] as const,
  },
  budgets: {
    all: ['finance', 'budgets'] as const,
    list: (userId?: string | null, monthDate?: string | null) =>
      ['finance', 'budgets', 'list', userId, monthDate] as const,
  },
  goals: {
    all: ['finance', 'goals'] as const,
    list: (userId?: string | null) => ['finance', 'goals', 'list', userId] as const,
  },
  reports: {
    all: ['finance', 'reports'] as const,
    summary: (userId?: string | null, rangeKey?: string | null) =>
      ['finance', 'reports', 'summary', userId, rangeKey] as const,
  },
  imports: {
    all: ['finance', 'imports'] as const,
    list: (userId?: string | null) => ['finance', 'imports', 'list', userId] as const,
  },
  preferences: {
    all: ['finance', 'preferences'] as const,
    detail: (userId?: string | null) => ['finance', 'preferences', 'detail', userId] as const,
    loginEvents: (userId?: string | null) => ['finance', 'preferences', 'login-events', userId] as const,
  },
  help: {
    all: ['finance', 'help'] as const,
    categories: () => ['finance', 'help', 'categories'] as const,
    articles: (search?: string | null, categoryCode?: string | null) =>
      ['finance', 'help', 'articles', search ?? null, categoryCode ?? null] as const,
  },
  about: {
    all: ['finance', 'about'] as const,
    content: () => ['finance', 'about', 'content'] as const,
  },
  support: {
    all: ['finance', 'support'] as const,
    conversations: (userId?: string | null) => ['finance', 'support', 'conversations', userId] as const,
    messages: (userId?: string | null, conversationId?: string | null) =>
      ['finance', 'support', 'messages', userId, conversationId] as const,
  },
  recurring: {
    all: ['finance', 'recurring'] as const,
    list: (userId?: string | null) => ['finance', 'recurring', 'list', userId] as const,
  },
  notifications: {
    all: ['finance', 'notifications'] as const,
    list: (userId?: string | null) => ['finance', 'notifications', 'list', userId] as const,
  },
};
