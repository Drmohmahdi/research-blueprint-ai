const RESEARCH_KEY_PREFIXES = [
  'rb_projects',
  'rb_comments_',
  'rb_monitoring_',
  'rb_literature_',
  'rb_methodology_chat_',
  'rb_chat_',
  'rb_local_runs_',
  'rb_prisma_counts_',
] as const;

export const legacyResearchStorageEnabled = !import.meta.env.PROD;

const isResearchKey = (key: string) =>
  RESEARCH_KEY_PREFIXES.some(prefix => key.startsWith(prefix));

export const researchStorage = {
  getItem(key: string): string | null {
    return legacyResearchStorageEnabled ? window.localStorage.getItem(key) : null;
  },
  setItem(key: string, value: string): void {
    if (legacyResearchStorageEnabled) window.localStorage.setItem(key, value);
  },
  removeItem(key: string): void {
    window.localStorage.removeItem(key);
  },
};

export const purgeLegacyResearchStorage = (): void => {
  if (legacyResearchStorageEnabled) return;
  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);
    if (key && isResearchKey(key)) window.localStorage.removeItem(key);
  }
};
