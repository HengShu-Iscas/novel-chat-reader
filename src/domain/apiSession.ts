import type { ApiProvider } from "./types";

export type SessionKeyStore = {
  setKey(provider: ApiProvider, key: string): void;
  getKey(provider: ApiProvider): string | null;
  clearKey(provider: ApiProvider): void;
  exportPersistableSettings(): { configuredProviders: ApiProvider[] };
};

export function createSessionKeyStore(): SessionKeyStore {
  const keys = new Map<ApiProvider, string>();

  return {
    setKey(provider, key) {
      keys.set(provider, key);
    },
    getKey(provider) {
      return keys.get(provider) ?? null;
    },
    clearKey(provider) {
      keys.delete(provider);
    },
    exportPersistableSettings() {
      return { configuredProviders: [...keys.keys()].sort() };
    },
  };
}
